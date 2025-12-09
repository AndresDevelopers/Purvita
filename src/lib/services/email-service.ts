const missingResendModuleMessagePattern = /(Cannot\s+find\s+module\s+'resend'|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND)/;

const loadResendClient = async () => {
  try {
    const mod = await import('resend');
    if (typeof mod?.Resend !== 'function') {
      throw new Error('Resend SDK installed but invalid export.');
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('Email provider is not configured. Missing RESEND_API_KEY.');
    }
    return new mod.Resend(apiKey);
  } catch (error) {
    if (error instanceof Error && missingResendModuleMessagePattern.test(error.message)) {
      return null;
    }
    throw error;
  }
};

type ResendClient = Awaited<ReturnType<typeof loadResendClient>>;

let cachedClientPromise: Promise<ResendClient | null> | null = null;

const getClient = async (): Promise<ResendClient | null> => {
  if (!cachedClientPromise) {
    cachedClientPromise = loadResendClient();
  }
  return cachedClientPromise;
};

export interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
  cc?: string[];
  bcc?: string[];
}

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const client = await getClient();

  if (!client) {
    console.warn('Resend SDK is not installed. Email sending skipped.');
    return;
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const ccList = Array.isArray(options.cc) ? options.cc : options.cc ? [options.cc] : [];
  const bccList = Array.isArray(options.bcc) ? options.bcc : options.bcc ? [options.bcc] : [];
  const replyToList = Array.isArray(options.replyTo)
    ? options.replyTo
    : options.replyTo
      ? [options.replyTo]
      : [];

  if (!options.text && !options.html) {
    throw new Error('Email provider requires either text or HTML content.');
  }

  const textBody = options.text ?? options.html ?? '';
  const htmlBody = options.html ?? undefined;

  const payload: Parameters<typeof client.emails.send>[0] = {
    from: options.from,
    to: recipients,
    subject: options.subject,
    text: textBody,
  };

  if (htmlBody) {
    payload.html = htmlBody;
  }

  if (replyToList.length === 1) {
    payload.replyTo = replyToList[0];
  } else if (replyToList.length > 1) {
    payload.replyTo = replyToList;
  }

  if (ccList.length === 1) {
    payload.cc = ccList[0];
  } else if (ccList.length > 1) {
    payload.cc = ccList;
  }

  if (bccList.length === 1) {
    payload.bcc = bccList[0];
  } else if (bccList.length > 1) {
    payload.bcc = bccList;
  }

  const response = await client.emails.send(payload);

  if (response.error) {
    throw new Error(response.error.message ?? 'Failed to send email');
  }
};

export const emailProviderStatus = () => ({
  hasEmailProvider: Boolean(process.env.RESEND_API_KEY),
  fromAddressConfigured: Boolean(process.env.CONTACT_FROM_EMAIL),
  fromNameConfigured: Boolean(process.env.CONTACT_FROM_NAME),
});
