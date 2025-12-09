import { sendEmail } from '@/lib/services/email-service';
import type { SupabaseClient } from '@supabase/supabase-js';

interface PaymentReminderParams {
  userEmail: string;
  userName: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  daysUntilDue: number;
  locale?: string;
}

interface PaymentConfirmationParams {
  userEmail: string;
  userName: string;
  amountCents: number;
  currency: string;
  paidAt: string;
  method: string;
  transactionId?: string;
  locale?: string;
}

/**
 * Service to send payment-related email notifications
 * Handles payment reminders and payment confirmations
 */
export class PaymentNotificationService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Check if user has order notifications enabled
   */
  private async hasOrderNotificationsEnabled(userEmail: string): Promise<boolean> {
    try {
      // Get user ID from email
      const { data: profile } = await this.client
        .from('profiles')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (!profile) {
        return true; // Default to enabled if user not found
      }

      // Check notification preferences
      const { data: preferences } = await this.client
        .from('notification_preferences')
        .select('order_notifications')
        .eq('user_id', profile.id)
        .single();

      // Default to true if no preferences found
      return preferences?.order_notifications ?? true;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminder(params: PaymentReminderParams): Promise<void> {
    try {
      // Check if user has notifications enabled
      const notificationsEnabled = await this.hasOrderNotificationsEnabled(params.userEmail);
      
      if (!notificationsEnabled) {
        console.log(`Payment reminder skipped for ${params.userEmail} - notifications disabled`);
        return;
      }

      const amount = (params.amountCents / 100).toFixed(2);
      const dueDate = new Date(params.dueDate).toLocaleDateString(params.locale || 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const isSpanish = params.locale?.startsWith('es');
      
      const subject = isSpanish
        ? `Recordatorio: Pago próximo - ${params.daysUntilDue} ${params.daysUntilDue === 1 ? 'día' : 'días'}`
        : `Reminder: Upcoming Payment - ${params.daysUntilDue} ${params.daysUntilDue === 1 ? 'day' : 'days'}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              ${isSpanish ? '💰 Recordatorio de Pago' : '💰 Payment Reminder'}
            </h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">
              ${isSpanish ? `Hola ${params.userName},` : `Hello ${params.userName},`}
            </h2>
            
            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              ${isSpanish 
                ? `Este es un recordatorio de que tu pago está programado para <strong>${dueDate}</strong> (en ${params.daysUntilDue} ${params.daysUntilDue === 1 ? 'día' : 'días'}).`
                : `This is a reminder that your payment is scheduled for <strong>${dueDate}</strong> (in ${params.daysUntilDue} ${params.daysUntilDue === 1 ? 'day' : 'days'}).`
              }
            </p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #666; font-size: 14px;">
                    ${isSpanish ? 'Monto:' : 'Amount:'}
                  </td>
                  <td style="padding: 10px 0; text-align: right; font-size: 24px; font-weight: bold; color: #667eea;">
                    ${amount} ${params.currency}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-size: 14px; border-top: 1px solid #dee2e6;">
                    ${isSpanish ? 'Fecha de vencimiento:' : 'Due Date:'}
                  </td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #333; border-top: 1px solid #dee2e6;">
                    ${dueDate}
                  </td>
                </tr>
              </table>
            </div>

            <p style="font-size: 14px; color: #777; margin-top: 30px;">
              ${isSpanish
                ? 'Asegúrate de tener fondos suficientes disponibles para el procesamiento automático del pago.'
                : 'Please ensure you have sufficient funds available for automatic payment processing.'
              }
            </p>

            <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #777; text-align: center;">
                ${isSpanish
                  ? `Estás recibiendo este correo porque tienes las notificaciones de pago habilitadas. Puedes administrar tus preferencias de notificación en la configuración de tu cuenta.`
                  : `You're receiving this email because you have payment notifications enabled. You can manage your notification preferences in your account settings.`
                }
              </p>
            </div>
          </div>
        </div>
      `;

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await sendEmail({
        from: fromAddress,
        to: params.userEmail,
        subject,
        html,
      });

      console.log(`Payment reminder sent to ${params.userEmail} for ${amount} ${params.currency} due on ${dueDate}`);
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      // Don't throw - we don't want to fail the main operation if email fails
    }
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(params: PaymentConfirmationParams): Promise<void> {
    try {
      // Check if user has notifications enabled
      const notificationsEnabled = await this.hasOrderNotificationsEnabled(params.userEmail);
      
      if (!notificationsEnabled) {
        console.log(`Payment confirmation skipped for ${params.userEmail} - notifications disabled`);
        return;
      }

      const amount = (params.amountCents / 100).toFixed(2);
      const paidDate = new Date(params.paidAt).toLocaleDateString(params.locale || 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const isSpanish = params.locale?.startsWith('es');
      
      const subject = isSpanish
        ? `✅ Pago Confirmado - ${amount} ${params.currency}`
        : `✅ Payment Confirmed - ${amount} ${params.currency}`;

      const methodLabels: Record<string, { en: string; es: string }> = {
        stripe: { en: 'Stripe', es: 'Stripe' },
        paypal: { en: 'PayPal', es: 'PayPal' },
        wallet: { en: 'Wallet', es: 'Billetera' },
        bank_transfer: { en: 'Bank Transfer', es: 'Transferencia Bancaria' },
        cash: { en: 'Cash', es: 'Efectivo' },
        check: { en: 'Check', es: 'Cheque' },
        other: { en: 'Other', es: 'Otro' },
      };

      const methodLabel = methodLabels[params.method]?.[isSpanish ? 'es' : 'en'] || params.method;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              ${isSpanish ? '✅ Pago Confirmado' : '✅ Payment Confirmed'}
            </h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">
              ${isSpanish ? `¡Gracias ${params.userName}!` : `Thank you ${params.userName}!`}
            </h2>
            
            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              ${isSpanish 
                ? 'Hemos recibido tu pago exitosamente. Aquí están los detalles:'
                : 'We have successfully received your payment. Here are the details:'
              }
            </p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #666; font-size: 14px;">
                    ${isSpanish ? 'Monto:' : 'Amount:'}
                  </td>
                  <td style="padding: 10px 0; text-align: right; font-size: 24px; font-weight: bold; color: #11998e;">
                    ${amount} ${params.currency}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-size: 14px; border-top: 1px solid #dee2e6;">
                    ${isSpanish ? 'Método de pago:' : 'Payment Method:'}
                  </td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #333; border-top: 1px solid #dee2e6;">
                    ${methodLabel}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666; font-size: 14px; border-top: 1px solid #dee2e6;">
                    ${isSpanish ? 'Fecha:' : 'Date:'}
                  </td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #333; border-top: 1px solid #dee2e6;">
                    ${paidDate}
                  </td>
                </tr>
                ${params.transactionId ? `
                <tr>
                  <td style="padding: 10px 0; color: #666; font-size: 14px; border-top: 1px solid #dee2e6;">
                    ${isSpanish ? 'ID de transacción:' : 'Transaction ID:'}
                  </td>
                  <td style="padding: 10px 0; text-align: right; font-family: monospace; font-size: 12px; color: #666; border-top: 1px solid #dee2e6;">
                    ${params.transactionId}
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #155724; font-size: 14px;">
                ${isSpanish
                  ? '✓ Tu pago ha sido procesado exitosamente y tu cuenta ha sido actualizada.'
                  : '✓ Your payment has been processed successfully and your account has been updated.'
                }
              </p>
            </div>

            <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #777; text-align: center;">
                ${isSpanish
                  ? `¿Preguntas? Contáctanos en ${process.env.CONTACT_REPLY_TO_EMAIL || 'support@purvita.com'}`
                  : `Questions? Contact us at ${process.env.CONTACT_REPLY_TO_EMAIL || 'support@purvita.com'}`
                }
              </p>
            </div>
          </div>
        </div>
      `;

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await sendEmail({
        from: fromAddress,
        to: params.userEmail,
        subject,
        html,
      });

      console.log(`Payment confirmation sent to ${params.userEmail} for ${amount} ${params.currency}`);
    } catch (error) {
      console.error('Error sending payment confirmation:', error);
      // Don't throw - we don't want to fail the main operation if email fails
    }
  }
}

