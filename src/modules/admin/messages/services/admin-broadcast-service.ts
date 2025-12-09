import { emailProviderStatus, sendEmail } from '@/lib/services/email-service';
import type {
  AdminBroadcastAudience,
  AdminBroadcastOverview,
  AdminBroadcastRecordInput,
  AdminBroadcastResult,
  AdminBroadcastSendRequest,
  AdminBroadcastSnapshot,
  BroadcastRecipient,
} from '../domain/models/admin-broadcast';
import { AdminBroadcastSendRequestSchema } from '../domain/models/admin-broadcast';
import type { AdminBroadcastRepository } from '../domain/contracts/admin-broadcast-repository';

interface AdminBroadcastEnvironment {
  brandName: string;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
}

export interface AdminBroadcastServiceDependencies {
  repository: AdminBroadcastRepository;
  environment: AdminBroadcastEnvironment;
  emailSender?: typeof sendEmail;
}

export class AdminBroadcastService {
  private readonly repository: AdminBroadcastRepository;
  private readonly environment: AdminBroadcastEnvironment;
  private readonly emailSender: typeof sendEmail;

  constructor(private readonly deps: AdminBroadcastServiceDependencies) {
    this.repository = deps.repository;
    this.environment = deps.environment;
    this.emailSender = deps.emailSender ?? sendEmail;
  }

  async getOverview(): Promise<AdminBroadcastOverview> {
    const snapshot = await this.repository.getSnapshot();
    return this.attachEnvironment(snapshot);
  }

  async getSnapshot(): Promise<AdminBroadcastSnapshot> {
    return this.repository.getSnapshot();
  }

  async previewAudience(audience: AdminBroadcastAudience): Promise<{ count: number; sample: BroadcastRecipient[] }> {
    const recipients = await this.repository.getRecipients(audience);
    return {
      count: recipients.length,
      sample: recipients.slice(0, 8),
    };
  }

  async sendBroadcast(
    input: AdminBroadcastSendRequest,
    context: { senderId: string; senderEmail: string | null },
  ): Promise<AdminBroadcastResult> {
    const payload = AdminBroadcastSendRequestSchema.parse(input);
    const snapshot = await this.repository.getRecipients(payload);

    if (snapshot.length === 0) {
      throw new Error('No recipients match the selected audience.');
    }

    const provider = emailProviderStatus();

    if (!provider.hasEmailProvider) {
      throw new Error('Email provider is not configured.');
    }

    const fromName = this.environment.fromName || `${this.environment.brandName} Team`;
    const fromEmail = this.environment.fromEmail;

    if (!fromEmail) {
      throw new Error('Sender email is not configured. Please configure CONTACT_FROM_EMAIL.');
    }

    const fromAddress = `${fromName} <${fromEmail}>`;
    const replyTo = this.environment.replyTo ?? fromEmail;

    const html = this.renderHtmlBody(payload.body);
    const successes: BroadcastRecipient[] = [];
    const failures: Array<{ recipient: BroadcastRecipient; error: Error }> = [];

    for (const recipient of snapshot) {
      try {
        await this.emailSender({
          from: fromAddress,
          to: recipient.email,
          subject: payload.subject,
          text: payload.body,
          html,
          replyTo,
        });
        successes.push(recipient);
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error('Failed to send email');
        failures.push({ recipient, error: normalized });
      }
    }

    const record: AdminBroadcastRecordInput = {
      request: payload,
      senderId: context.senderId,
      senderEmail: context.senderEmail,
      recipients: successes,
      failures,
    };

    const resultPayload = {
      intendedCount: snapshot.length,
      deliveredCount: successes.length,
      failedCount: failures.length,
      failures: failures.map(({ recipient, error }) => ({
        email: recipient.email,
        reason: error.message,
      })),
    };

    const broadcastId = await this.repository.saveBroadcast(record, resultPayload);

    return {
      ...resultPayload,
      broadcastId,
    };
  }

  private attachEnvironment(snapshot: AdminBroadcastSnapshot): AdminBroadcastOverview {
    const provider = emailProviderStatus();

    return {
      ...snapshot,
      environment: {
        hasEmailProvider: provider.hasEmailProvider,
        fromNameConfigured: Boolean(this.environment.fromName) || provider.fromNameConfigured,
        fromEmailConfigured: Boolean(this.environment.fromEmail) || provider.fromAddressConfigured,
      },
    };
  }

  private renderHtmlBody(body: string): string {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const paragraphs = body
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
      .map(
        (paragraph) =>
          `<p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:#1f2937;">${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`,
      )
      .join('');

    const footer = `
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;">
        ${escapeHtml(this.environment.brandName)} Admin · ${escapeHtml(this.environment.fromEmail ?? '')}
      </p>
    `;

    return `<div style="font-family:'Inter',system-ui,-apple-system,Segoe UI,sans-serif;padding:8px 0;">${paragraphs}${footer}</div>`;
  }
}

