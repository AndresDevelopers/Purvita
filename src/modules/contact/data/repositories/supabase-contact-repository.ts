import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactRepository } from '../../domain/contracts/contact-repository';
import {
  ContactSettingsSchema,
  ContactSettingsUpdateSchema,
  DEFAULT_CONTACT_SETTINGS,
  type ContactSettings,
  type ContactSettingsUpdateInput,
} from '../../domain/models/contact-settings';
import {
  ContactMessageLogSchema,
  type ContactMessageLogEntry,
} from '../../domain/models/contact-message';

const SETTINGS_COLUMNS =
  'id, from_name, from_email, reply_to_email, recipient_email_override, cc_emails, bcc_emails, subject_prefix, auto_response_enabled, auto_response_subject, auto_response_body, created_at, updated_at';

interface ContactSettingsRow {
  id: string;
  from_name: string | null;
  from_email: string | null;
  reply_to_email: string | null;
  recipient_email_override: string | null;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  subject_prefix: string | null;
  auto_response_enabled: boolean | null;
  auto_response_subject: string | null;
  auto_response_body: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ContactMessageRow {
  locale: string;
  name: string;
  email: string;
  message: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message: string | null;
}

export interface SupabaseContactRepositoryDependencies {
  adminClient: SupabaseClient;
}

const normalizeEmailArray = (value: string[] | null | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .map((item) => (item ? item.trim() : ''))
    .filter((item): item is string => item.length > 0);
};

const mapSettingsRow = (row: Partial<ContactSettingsRow> | null): ContactSettings | null => {
  if (!row) {
    return null;
  }

  return ContactSettingsSchema.parse({
    id: row.id ?? 'global',
    fromName: row.from_name ?? DEFAULT_CONTACT_SETTINGS.fromName,
    fromEmail: row.from_email ?? DEFAULT_CONTACT_SETTINGS.fromEmail,
    replyToEmail: row.reply_to_email,
    recipientEmailOverride: row.recipient_email_override,
    ccEmails: normalizeEmailArray(row.cc_emails ?? null),
    bccEmails: normalizeEmailArray(row.bcc_emails ?? null),
    subjectPrefix: row.subject_prefix,
    autoResponseEnabled: row.auto_response_enabled ?? false,
    autoResponseSubject: row.auto_response_subject,
    autoResponseBody: row.auto_response_body,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  });
};

export class SupabaseContactRepository implements ContactRepository {
  constructor(private readonly deps: SupabaseContactRepositoryDependencies) {}

  private get client(): SupabaseClient {
    return this.deps.adminClient;
  }

  async fetchSettings(): Promise<ContactSettings | null> {
    try {
      const { data, error } = await this.client
        .from('contact_settings')
        .select(SETTINGS_COLUMNS)
        .eq('id', 'global')
        .maybeSingle();

      if (error) {
        if (
          error.code === 'PGRST116' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('relation')
        ) {
          return null;
        }

        throw new Error(`[ContactRepository] Failed to load contact settings: ${error.message}`);
      }

      return mapSettingsRow((data as ContactSettingsRow | null) ?? null);
    } catch (err) {
      console.warn('[ContactRepository] Unexpected error loading settings, returning defaults.', err);
      return null;
    }
  }

  async upsertSettings(input: ContactSettingsUpdateInput): Promise<ContactSettings> {
    const payload = ContactSettingsUpdateSchema.parse({
      ...input,
      ccEmails: input.ccEmails.map((item) => item.trim()).filter((item) => item.length > 0),
      bccEmails: input.bccEmails.map((item) => item.trim()).filter((item) => item.length > 0),
    });

    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from('contact_settings')
      .upsert(
        {
          id: 'global',
          from_name: payload.fromName,
          from_email: payload.fromEmail,
          reply_to_email: payload.replyToEmail,
          recipient_email_override: payload.recipientEmailOverride,
          cc_emails: payload.ccEmails,
          bcc_emails: payload.bccEmails,
          subject_prefix: payload.subjectPrefix,
          auto_response_enabled: payload.autoResponseEnabled,
          auto_response_subject: payload.autoResponseSubject,
          auto_response_body: payload.autoResponseBody,
          updated_at: now,
        },
        { onConflict: 'id' },
      )
      .select(SETTINGS_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new Error(`[ContactRepository] Failed to update contact settings: ${error.message}`);
    }

    return mapSettingsRow((data as ContactSettingsRow | null) ?? null) ?? DEFAULT_CONTACT_SETTINGS;
  }

  async logMessage(entry: ContactMessageLogEntry): Promise<void> {
    const payload = ContactMessageLogSchema.parse(entry);

    try {
      const { error } = await this.client.from('contact_messages').insert<ContactMessageRow>({
        locale: payload.locale,
        name: payload.name,
        email: payload.email,
        message: payload.message,
        recipient_email: payload.recipientEmail,
        subject: payload.subject,
        status: payload.status,
        error_message: payload.errorMessage ?? null,
      });

      if (error) {
        if (
          error.code === 'PGRST116' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('relation')
        ) {
          console.warn('[ContactRepository] contact_messages table missing, skipping log.');
          return;
        }

        console.warn('[ContactRepository] Failed to log contact message:', error.message);
      }
    } catch (err) {
      console.warn('[ContactRepository] Unexpected error logging message:', err);
    }
  }
}
