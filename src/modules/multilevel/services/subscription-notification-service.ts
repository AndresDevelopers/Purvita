import { getDefaultAppName } from '@/lib/config/app-config';
import { sendEmail } from '@/lib/services/email-service';
import type { Locale } from '@/i18n/dictionaries';
import { availableLocales, getDictionary } from '@/i18n/dictionaries';
import { sanitizeAppNameForEmailDomain } from '@/i18n/dictionaries/default';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionCancellationReason } from '../observers/subscription-event-bus';

interface ProfileRow {
  name?: string | null;
  email?: string | null;
}

const resolveLocale = (locale?: string | null): Locale => {
  if (!locale) {
    return 'en';
  }

  if (availableLocales.includes(locale as Locale)) {
    return locale as Locale;
  }

  const normalized = locale.split('-')[0];
  if (availableLocales.includes(normalized as Locale)) {
    return normalized as Locale;
  }

  return 'en';
};

const resolveFromAddress = (appName: string) => {
  const fromName = process.env.CONTACT_FROM_NAME?.trim() || appName;
  const fromEmailEnv = process.env.CONTACT_FROM_EMAIL?.trim();
  if (fromEmailEnv) {
    return `${fromName} <${fromEmailEnv}>`;
  }

  const domain = `${sanitizeAppNameForEmailDomain(appName)}.app`;
  return `${fromName} <no-reply@${domain}>`;
};

const replaceTokens = (template: string, replacements: Record<string, string>) =>
  Object.entries(replacements).reduce(
    (acc, [token, value]) => acc.replace(new RegExp(`{{\\s*${token}\\s*}}`, 'gi'), value),
    template,
  );

interface RenewalSuccessParams {
  userId: string;
  amountCents: number;
  currency: string;
  nextBillingDate: string;
  gateway: string;
  locale?: string | null;
}

interface RenewalFailureParams {
  userId: string;
  amountCents: number;
  currency: string;
  reason: string;
  gateway: string;
  locale?: string | null;
}

interface PaymentMethodUpdateParams {
  userId: string;
  gateway: string;
  lastFour?: string;
  locale?: string | null;
}

export class SubscriptionNotificationService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Check if user has subscription notifications enabled
   */
  private async hasSubscriptionNotificationsEnabled(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('notification_preferences')
        .select('subscription_notifications')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[SubscriptionNotification] Error checking preferences:', error);
        return true; // Default to enabled on error
      }

      // If no preferences exist, default to enabled
      if (!data) {
        return true;
      }

      return data.subscription_notifications ?? true;
    } catch (error) {
      console.error('[SubscriptionNotification] Error in hasSubscriptionNotificationsEnabled:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Format currency amount
   */
  private formatAmount(amountCents: number, currency: string): string {
    const amount = amountCents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  /**
   * Format date
   */
  private formatDate(dateString: string, locale: string = 'en'): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  async sendCancellationEmail(params: {
    userId: string;
    reason: SubscriptionCancellationReason;
    locale?: string | null;
  }): Promise<void> {
    const appName = getDefaultAppName();
    const locale = resolveLocale(params.locale);
    const dictionary = getDictionary(locale, appName);
    const emailCopy = dictionary.subscriptionManagement?.email?.cancellation;

    const reasonCopy =
      params.reason === 'payment_failure'
        ? emailCopy?.paymentFailure
        : emailCopy?.userRequested;

    const fromAddress = resolveFromAddress(appName);

    let profile: ProfileRow | null = null;
    try {
      const { data } = await this.client
        .from('profiles')
        .select('name,email')
        .eq('id', params.userId)
        .maybeSingle();
      profile = (data as ProfileRow | null) ?? null;
    } catch (error) {
      console.error('Failed to fetch profile for cancellation email', error);
    }

    let recipientEmail = profile?.email ?? null;
    let recipientName = profile?.name ?? null;

    if (!recipientEmail) {
      try {
        const { data } = await this.client.auth.admin.getUserById(params.userId);
        recipientEmail = data?.user?.email ?? null;
        const metadataName = data?.user?.user_metadata?.full_name ?? data?.user?.user_metadata?.name;
        if (!recipientName && typeof metadataName === 'string') {
          recipientName = metadataName;
        }
      } catch (error) {
        console.error('Failed to fetch auth user for cancellation email', error);
      }
    }

    if (!recipientEmail) {
      console.warn('Skipping cancellation email: missing recipient email for user', params.userId);
      return;
    }

    const friendlyName = recipientName?.trim().length ? recipientName.trim() : 'there';
    const replacements = {
      name: friendlyName,
      appName,
    };

    const subjectTemplate = reasonCopy?.subject ?? `Your ${appName} subscription has been cancelled`;
    const greetingTemplate = reasonCopy?.greeting ?? 'Hi {{name}}';
    const bodyLines: string[] = Array.isArray(reasonCopy?.message) && reasonCopy?.message.length
      ? [...reasonCopy.message]
      : [
          'We processed your cancellation request and stopped future charges.',
          'Sign back in whenever you want to reactivate your membership.',
        ];
    const footerTemplate = reasonCopy?.footer ?? `Thank you for being part of ${appName}.`;

    const textSegments = [
      replaceTokens(greetingTemplate, replacements),
      '',
      ...bodyLines.map((line) => replaceTokens(line, replacements)),
      '',
      replaceTokens(footerTemplate, replacements),
    ];

    const textBody = textSegments.join('\n');

    try {
      await sendEmail({
        from: fromAddress,
        to: recipientEmail,
        subject: replaceTokens(subjectTemplate, replacements),
        text: textBody,
      });
    } catch (error) {
      console.error('Failed to send cancellation email', error);
    }
  }

  /**
   * Send email notification for payment method update
   */
  async sendPaymentMethodUpdateEmail(params: PaymentMethodUpdateParams): Promise<void> {
    // Check if user has subscription notifications enabled
    const notificationsEnabled = await this.hasSubscriptionNotificationsEnabled(params.userId);

    if (!notificationsEnabled) {
      console.log(`[SubscriptionNotification] Payment method update email skipped for user ${params.userId} - notifications disabled`);
      return;
    }

    const appName = getDefaultAppName();
    const _locale = resolveLocale(params.locale);
    const fromAddress = resolveFromAddress(appName);

    let profile: ProfileRow | null = null;
    try {
      const { data } = await this.client
        .from('profiles')
        .select('name,email')
        .eq('id', params.userId)
        .maybeSingle();
      profile = (data as ProfileRow | null) ?? null;
    } catch (error) {
      console.error('Failed to fetch profile for payment method update email', error);
    }

    let recipientEmail = profile?.email ?? null;
    let recipientName = profile?.name ?? null;

    if (!recipientEmail) {
      try {
        const { data } = await this.client.auth.admin.getUserById(params.userId);
        recipientEmail = data?.user?.email ?? null;
        const metadataName = data?.user?.user_metadata?.full_name ?? data?.user?.user_metadata?.name;
        if (!recipientName && typeof metadataName === 'string') {
          recipientName = metadataName;
        }
      } catch (error) {
        console.error('Failed to fetch auth user for payment method update email', error);
      }
    }

    if (!recipientEmail) {
      console.warn('Skipping payment method update email: missing recipient email for user', params.userId);
      return;
    }

    const friendlyName = recipientName?.trim().length ? recipientName.trim() : 'there';
    const gatewayName = params.gateway === 'stripe' ? 'Credit Card' :
                        params.gateway === 'paypal' ? 'PayPal' :
                        'Wallet';

    const subject = `Payment Method Updated - ${appName}`;
    const textBody = `Hi ${friendlyName},

Your payment method for your ${appName} subscription has been successfully updated.

Updated Payment Method: ${gatewayName}
${params.lastFour ? `Card ending in: ${params.lastFour}` : ''}
Status: Active

Important: This payment method will be used for your next automatic renewal. You were not charged at this time.

Your subscription will automatically renew at the end of your current billing period using this payment method.

If you did not make this change, please contact support immediately.

Thank you for being part of ${appName}.`;

    try {
      await sendEmail({
        from: fromAddress,
        to: recipientEmail,
        subject,
        text: textBody,
      });
      console.log(`[SubscriptionNotification] Payment method update email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send payment method update email', error);
    }
  }

  /**
   * Send email notification for successful renewal
   */
  async sendRenewalSuccessEmail(params: RenewalSuccessParams): Promise<void> {
    // Check if user has subscription notifications enabled
    const notificationsEnabled = await this.hasSubscriptionNotificationsEnabled(params.userId);

    if (!notificationsEnabled) {
      console.log(`[SubscriptionNotification] Renewal success email skipped for user ${params.userId} - notifications disabled`);
      return;
    }

    const appName = getDefaultAppName();
    const locale = resolveLocale(params.locale);
    const fromAddress = resolveFromAddress(appName);

    let profile: ProfileRow | null = null;
    try {
      const { data } = await this.client
        .from('profiles')
        .select('name,email')
        .eq('id', params.userId)
        .maybeSingle();
      profile = (data as ProfileRow | null) ?? null;
    } catch (error) {
      console.error('Failed to fetch profile for renewal success email', error);
    }

    let recipientEmail = profile?.email ?? null;
    let recipientName = profile?.name ?? null;

    if (!recipientEmail) {
      try {
        const { data } = await this.client.auth.admin.getUserById(params.userId);
        recipientEmail = data?.user?.email ?? null;
        const metadataName = data?.user?.user_metadata?.full_name ?? data?.user?.user_metadata?.name;
        if (!recipientName && typeof metadataName === 'string') {
          recipientName = metadataName;
        }
      } catch (error) {
        console.error('Failed to fetch auth user for renewal success email', error);
      }
    }

    if (!recipientEmail) {
      console.warn('Skipping renewal success email: missing recipient email for user', params.userId);
      return;
    }

    const friendlyName = recipientName?.trim().length ? recipientName.trim() : 'there';
    const amount = this.formatAmount(params.amountCents, params.currency);
    const nextBillingDate = this.formatDate(params.nextBillingDate, locale);
    const gatewayName = params.gateway === 'stripe' ? 'Credit Card' :
                        params.gateway === 'paypal' ? 'PayPal' :
                        'Wallet';

    const subject = `Subscription Renewed Successfully - ${appName}`;
    const textBody = `Hi ${friendlyName},

Your ${appName} subscription has been successfully renewed!

Renewal Details:
- Amount Charged: ${amount}
- Payment Method: ${gatewayName}
- Next Billing Date: ${nextBillingDate}

Thank you for continuing your membership with ${appName}. Your subscription is now active for another billing period.

If you have any questions about this charge, please contact our support team.

Thank you for being part of ${appName}.`;

    try {
      await sendEmail({
        from: fromAddress,
        to: recipientEmail,
        subject,
        text: textBody,
      });
      console.log(`[SubscriptionNotification] Renewal success email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send renewal success email', error);
    }
  }

  /**
   * Send email notification for failed renewal
   */
  async sendRenewalFailureEmail(params: RenewalFailureParams): Promise<void> {
    // Check if user has subscription notifications enabled
    const notificationsEnabled = await this.hasSubscriptionNotificationsEnabled(params.userId);

    if (!notificationsEnabled) {
      console.log(`[SubscriptionNotification] Renewal failure email skipped for user ${params.userId} - notifications disabled`);
      return;
    }

    const appName = getDefaultAppName();
    const _locale = resolveLocale(params.locale);
    const fromAddress = resolveFromAddress(appName);

    let profile: ProfileRow | null = null;
    try {
      const { data } = await this.client
        .from('profiles')
        .select('name,email')
        .eq('id', params.userId)
        .maybeSingle();
      profile = (data as ProfileRow | null) ?? null;
    } catch (error) {
      console.error('Failed to fetch profile for renewal failure email', error);
    }

    let recipientEmail = profile?.email ?? null;
    let recipientName = profile?.name ?? null;

    if (!recipientEmail) {
      try {
        const { data } = await this.client.auth.admin.getUserById(params.userId);
        recipientEmail = data?.user?.email ?? null;
        const metadataName = data?.user?.user_metadata?.full_name ?? data?.user?.user_metadata?.name;
        if (!recipientName && typeof metadataName === 'string') {
          recipientName = metadataName;
        }
      } catch (error) {
        console.error('Failed to fetch auth user for renewal failure email', error);
      }
    }

    if (!recipientEmail) {
      console.warn('Skipping renewal failure email: missing recipient email for user', params.userId);
      return;
    }

    const friendlyName = recipientName?.trim().length ? recipientName.trim() : 'there';
    const amount = this.formatAmount(params.amountCents, params.currency);
    const gatewayName = params.gateway === 'stripe' ? 'Credit Card' :
                        params.gateway === 'paypal' ? 'PayPal' :
                        'Wallet';

    const subject = `Action Required: Subscription Renewal Failed - ${appName}`;
    const textBody = `Hi ${friendlyName},

We were unable to process your automatic subscription renewal for ${appName}.

Renewal Attempt Details:
- Amount: ${amount}
- Payment Method: ${gatewayName}
- Reason: ${params.reason}

What happens next?
- Your subscription is now in a "Past Due" status
- You still have access to your account for now
- Please update your payment method to avoid service interruption

To update your payment method, visit: ${process.env.NEXT_PUBLIC_APP_URL}/subscription

If you need assistance, please contact our support team.

Thank you for being part of ${appName}.`;

    try {
      await sendEmail({
        from: fromAddress,
        to: recipientEmail,
        subject,
        text: textBody,
      });
      console.log(`[SubscriptionNotification] Renewal failure email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send renewal failure email', error);
    }
  }
}
