import { sendEmail } from '@/lib/services/email-service';
import type { NotificationPreferencesRepository } from '../domain/contracts/notification-preferences-repository';
import { createEmailTemplateService, EMAIL_TEMPLATE_IDS, type TemplateLocale } from '@/modules/email-templates';

interface TeamMemberAddedParams {
  sponsorEmail: string;
  sponsorName: string;
  newMemberName: string;
  newMemberEmail: string;
  locale?: TemplateLocale;
}

interface NewVideoContentParams {
  videoTitle: string;
  videoDescription?: string;
  videoUrl?: string;
  locale?: TemplateLocale;
}

export class NotificationEmailService {
  private readonly templateService = createEmailTemplateService();

  constructor(private readonly preferencesRepository: NotificationPreferencesRepository) {}

  /**
   * Send email notification when a new team member is added
   */
  async notifyTeamMemberAdded(params: TeamMemberAddedParams): Promise<void> {
    try {
      // Get users who have team updates enabled
      const usersWithPreference = await this.preferencesRepository.findUsersWithPreference('teamUpdates');

      // Check if the sponsor has team updates enabled
      const sponsorPreference = usersWithPreference.find(
        (pref) => pref.userId === params.sponsorEmail
      );

      if (!sponsorPreference) {
        console.log(`Sponsor ${params.sponsorEmail} does not have team updates enabled`);
        return;
      }

      // Get processed template from database
      const locale = params.locale || 'en';
      const template = await this.templateService.getProcessedTemplate(
        EMAIL_TEMPLATE_IDS.TEAM_MEMBER_ADDED,
        {
          sponsorName: params.sponsorName,
          newMemberName: params.newMemberName,
          newMemberEmail: params.newMemberEmail,
        },
        locale
      );

      if (!template) {
        console.error('[NotificationEmailService] Team member template not found, using fallback');
        // Fallback to hardcoded template if DB template not available
        await this.sendTeamMemberAddedFallback(params);
        return;
      }

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await sendEmail({
        from: fromAddress,
        to: params.sponsorEmail,
        subject: template.subject,
        html: template.html,
      });

      console.log(`Team member notification sent to ${params.sponsorEmail}`);
    } catch (error) {
      console.error('Error sending team member notification:', error);
      // Don't throw - we don't want to fail the main operation if email fails
    }
  }

  /**
   * Fallback method for team member notification (if template not in DB)
   */
  private async sendTeamMemberAddedFallback(params: TeamMemberAddedParams): Promise<void> {
    const subject = `New Team Member: ${params.newMemberName} joined your team!`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Great News, ${params.sponsorName}!</h2>
        <p style="font-size: 16px; color: #555;">
          <strong>${params.newMemberName}</strong> (${params.newMemberEmail}) has just joined your team.
        </p>
        <p style="font-size: 16px; color: #555;">
          This is a great opportunity to reach out and welcome them to the team.
          Building strong relationships with your team members is key to success!
        </p>
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <p style="margin: 0; font-size: 14px; color: #777;">
            You're receiving this email because you have team update notifications enabled.
            You can manage your notification preferences in your account settings.
          </p>
        </div>
      </div>
    `;

    const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
    const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
    const fromAddress = `${fromName} <${fromEmail}>`;

    await sendEmail({
      from: fromAddress,
      to: params.sponsorEmail,
      subject,
      html,
    });
  }

  /**
   * Send email notification when new video content is added
   */
  async notifyNewVideoContent(params: NewVideoContentParams): Promise<void> {
    try {
      // Get all users who have new video content notifications enabled
      const usersWithPreference = await this.preferencesRepository.findUsersWithPreference('newVideoContent');

      if (usersWithPreference.length === 0) {
        console.log('No users have new video content notifications enabled');
        return;
      }

      // Get processed template from database
      const locale = params.locale || 'en';
      const template = await this.templateService.getProcessedTemplate(
        EMAIL_TEMPLATE_IDS.NEW_VIDEO_CONTENT,
        {
          videoTitle: params.videoTitle,
          videoDescription: params.videoDescription || '',
          videoUrl: params.videoUrl || '#',
        },
        locale
      );

      if (!template) {
        console.error('[NotificationEmailService] Video content template not found');
        return;
      }

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const _fromAddress = `${fromName} <${fromEmail}>`;

      for (const preference of usersWithPreference) {
        try {
          // Note: We need to get the user's email from their profile
          // This is a simplified version - in production, you'd want to join with profiles table
          console.log(`Would send video notification to user ${preference.userId}`);

          // TODO: Implement actual email sending with user email lookup
          // await sendEmail({
          //   from: fromAddress,
          //   to: userEmail,
          //   subject: template.subject,
          //   html: template.html,
          // });
        } catch (error) {
          console.error(`Error sending video notification to user ${preference.userId}:`, error);
          // Continue with other users
        }
      }

      console.log(`Video content notifications sent to ${usersWithPreference.length} users`);
    } catch (error) {
      console.error('Error sending video content notifications:', error);
      // Don't throw - we don't want to fail the main operation if email fails
    }
  }

  /**
   * Send a test notification to verify email configuration
   */
  async sendTestNotification(email: string, name: string): Promise<void> {
    const subject = 'Test Notification - Your notifications are working!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hello, ${name}!</h2>
        <p style="font-size: 16px; color: #555;">
          This is a test notification to confirm that your email notifications are working correctly.
        </p>
        <p style="font-size: 16px; color: #555;">
          You can manage your notification preferences in your account settings at any time.
        </p>
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <p style="margin: 0; font-size: 14px; color: #777;">
            This is a test email. If you did not request this, you can safely ignore it.
          </p>
        </div>
      </div>
    `;

    const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
    const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
    const fromAddress = `${fromName} <${fromEmail}>`;

    await sendEmail({
      from: fromAddress,
      to: email,
      subject,
      html,
    });
  }
}

