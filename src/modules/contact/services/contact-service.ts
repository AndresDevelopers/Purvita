import { sendEmail, emailProviderStatus } from '@/lib/services/email-service';
import { createContactModule } from '../factories/contact-module';
import {
  ContactSettingsUpdateSchema,
  DEFAULT_CONTACT_SETTINGS,
  type ContactSettings,
  type ContactSettingsResponse,
  type ContactSettingsUpdateInput,
} from '../domain/models/contact-settings';
import {
  ContactMessageSchema,
  type ContactMessageInput,
} from '../domain/models/contact-message';
import { getLandingContent } from '@/modules/site-content/services/site-content-service';
import type { Locale } from '@/i18n/config';
import { validateUrlsInText } from '@/lib/security/url-threat-validator';

const getRepository = () => createContactModule().repository;

const sanitizeEmailList = (value: string[]): string[] =>
  value
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const resolveSettings = (stored: ContactSettings | null): ContactSettings => {
  const envFromName = process.env.CONTACT_FROM_NAME?.trim();
  const envFromEmail = process.env.CONTACT_FROM_EMAIL?.trim();
  const envReplyTo = process.env.CONTACT_REPLY_TO_EMAIL?.trim();
  const envSubjectPrefix = process.env.CONTACT_SUBJECT_PREFIX?.trim();

  const base = stored ?? DEFAULT_CONTACT_SETTINGS;

  return {
    ...DEFAULT_CONTACT_SETTINGS,
    ...base,
    fromName: base.fromName || envFromName || DEFAULT_CONTACT_SETTINGS.fromName,
    fromEmail: envFromEmail || base.fromEmail || DEFAULT_CONTACT_SETTINGS.fromEmail,
    replyToEmail: base.replyToEmail ?? envReplyTo ?? null,
    subjectPrefix: base.subjectPrefix ?? envSubjectPrefix ?? DEFAULT_CONTACT_SETTINGS.subjectPrefix,
    ccEmails: sanitizeEmailList(base.ccEmails),
    bccEmails: sanitizeEmailList(base.bccEmails),
  };
};

export const getContactSettings = async (): Promise<ContactSettings> => {
  const repository = getRepository();
  const stored = await repository.fetchSettings();
  return resolveSettings(stored);
};

export const getContactSettingsWithStatus = async (): Promise<ContactSettingsResponse> => {
  const settings = await getContactSettings();
  const environment = emailProviderStatus();

  return { settings, environment };
};

export const updateContactSettings = async (
  input: ContactSettingsUpdateInput,
): Promise<ContactSettingsResponse> => {
  const repository = getRepository();
  const payload = ContactSettingsUpdateSchema.parse({
    ...input,
    ccEmails: sanitizeEmailList(input.ccEmails),
    bccEmails: sanitizeEmailList(input.bccEmails),
  });

  const updated = await repository.upsertSettings(payload);
  const resolved = resolveSettings(updated);

  return { settings: resolved, environment: emailProviderStatus() };
};

const buildContactSubject = (settings: ContactSettings, senderName: string) => {
  const prefix = settings.subjectPrefix ? `${settings.subjectPrefix.trim()} ` : '';
  return `${prefix}New contact message from ${senderName}`.trim();
};

const buildContactBody = (message: ContactMessageInput, locale: Locale) => {
  return [
    'You have received a new contact request from your landing page.',
    '',
    `Name: ${message.name}`,
    `Email: ${message.email}`,
    `Locale: ${locale}`,
    '',
    'Message:',
    message.message,
  ].join('\n');
};

const buildContactHtml = (message: ContactMessageInput, locale: Locale) => {
  const paragraph = (value: string) => `<p>${value}</p>`;
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  return [
    '<div>',
    paragraph('You have received a new contact request from your landing page.'),
    '<ul>',
    `<li><strong>Name:</strong> ${escapeHtml(message.name)}</li>`,
    `<li><strong>Email:</strong> ${escapeHtml(message.email)}</li>`,
    `<li><strong>Locale:</strong> ${escapeHtml(locale)}</li>`,
    '</ul>',
    paragraph('<strong>Message:</strong>'),
    `<pre style="white-space: pre-wrap; font-family: system-ui, sans-serif;">${escapeHtml(message.message)}</pre>`,
    '</div>',
  ].join('');
};

const applyTemplateVariables = (template: string, message: ContactMessageInput) =>
  template
    .replace(/{{\s*name\s*}}/gi, message.name)
    .replace(/{{\s*email\s*}}/gi, message.email);

export const submitContactMessage = async (input: ContactMessageInput): Promise<void> => {
  const repository = getRepository();
  const payload = ContactMessageSchema.parse({
    name: input.name,
    email: input.email,
    message: input.message,
  });
  const locale: Locale = input.locale ?? 'en';

  // Validar URLs maliciosas en el mensaje de contacto
  const urlValidation = await validateUrlsInText(payload.message, {
    action: 'contact_form_submission',
    userEmail: payload.email,
  });

  if (!urlValidation.isValid) {
    throw new Error(
      'Your message contains suspicious content and cannot be submitted. Please remove any suspicious links and try again.'
    );
  }

  const [settings, landing] = await Promise.all([
    getContactSettings(),
    getLandingContent(locale),
  ]);

  const recipient = settings.recipientEmailOverride || landing.contact.recipientEmail;

  if (!recipient) {
    throw new Error('Contact recipient email is not configured.');
  }

  const fromAddress = `${settings.fromName} <${settings.fromEmail}>`;
  const replyTo = settings.replyToEmail ?? payload.email;
  const subject = buildContactSubject(settings, payload.name);
  const messageForTemplates: ContactMessageInput = {
    ...payload,
    locale,
  };
  const text = buildContactBody(messageForTemplates, locale);
  const html = buildContactHtml(messageForTemplates, locale);

  try {
    await sendEmail({
      from: fromAddress,
      to: recipient,
      subject,
      text,
      html,
      replyTo: replyTo,
      cc: settings.ccEmails,
      bcc: settings.bccEmails,
    });

    await repository.logMessage({
      locale,
      name: payload.name,
      email: payload.email,
      message: payload.message,
      recipientEmail: recipient,
      subject,
      status: 'sent',
      errorMessage: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email provider error';

    await repository.logMessage({
      locale,
      name: payload.name,
      email: payload.email,
      message: payload.message,
      recipientEmail: recipient,
      subject,
      status: 'failed',
      errorMessage: message,
    });

    throw error;
  }

  if (
    settings.autoResponseEnabled &&
    settings.autoResponseSubject &&
    settings.autoResponseBody
  ) {
    const autoSubject = applyTemplateVariables(settings.autoResponseSubject, messageForTemplates);
    const autoBody = applyTemplateVariables(settings.autoResponseBody, messageForTemplates);

    try {
      await sendEmail({
        from: fromAddress,
        to: payload.email,
        subject: autoSubject,
        text: autoBody,
      });
    } catch (error) {
      console.warn('[ContactService] Auto-response email failed:', error);
    }
  }
};
