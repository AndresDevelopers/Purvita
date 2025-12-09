import { EnvironmentService } from '@/lib/config/environment';
import { getSiteModeConfiguration } from './site-mode-service';

export type ComingSoonSubscriptionResult = 'subscribed' | 'already_subscribed';

export class ComingSoonInactiveError extends Error {
  constructor(message = 'Coming soon mode is not active') {
    super(message);
    this.name = 'ComingSoonInactiveError';
  }
}

export class ComingSoonConfigurationError extends Error {
  constructor(message = 'Coming soon configuration is incomplete') {
    super(message);
    this.name = 'ComingSoonConfigurationError';
  }
}

export class MailchimpRequestError extends Error {
  constructor(message = 'Mailchimp rejected the request') {
    super(message);
    this.name = 'MailchimpRequestError';
  }
}

const encodeMailchimpAuth = (apiKey: string): string => {
  const token = Buffer.from(`any:${apiKey}`).toString('base64');
  return `Basic ${token}`;
};

interface MailchimpResponseBody {
  title?: string;
  detail?: string;
  status?: number;
}

export const subscribeToComingSoonWaitlist = async (
  email: string,
): Promise<ComingSoonSubscriptionResult> => {
  const configuration = await getSiteModeConfiguration();

  if (configuration.activeMode !== 'coming_soon') {
    throw new ComingSoonInactiveError();
  }

  const activeSettings = configuration.modes.find((mode) => mode.mode === 'coming_soon');

  if (!activeSettings) {
    throw new ComingSoonConfigurationError('Unable to resolve coming soon settings');
  }

  // Check if Mailchimp integration is enabled
  if (!activeSettings.mailchimpEnabled) {
    throw new ComingSoonConfigurationError('Mailchimp integration is not enabled');
  }

  const mailchimpAudienceId = activeSettings.mailchimpAudienceId;
  const mailchimpServerPrefix = activeSettings.mailchimpServerPrefix;

  if (!mailchimpAudienceId || !mailchimpServerPrefix) {
    throw new ComingSoonConfigurationError('Mailchimp audience information is missing');
  }

  const env = EnvironmentService.getInstance();
  const { mailchimpApiKey } = env.getConfig();
  const apiKey = mailchimpApiKey;

  if (!apiKey) {
    throw new ComingSoonConfigurationError('Mailchimp API key is not configured');
  }

  const endpoint = `https://${mailchimpServerPrefix}.api.mailchimp.com/3.0/lists/${mailchimpAudienceId}/members`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: encodeMailchimpAuth(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        tags: ['coming-soon'],
      }),
    });
  } catch (error) {
    console.error('[ComingSoonService] Failed to reach Mailchimp', error);
    throw new MailchimpRequestError('We could not connect to Mailchimp');
  }

  const body = (await response.json().catch(() => null)) as MailchimpResponseBody | null;

  if (response.ok) {
    return 'subscribed';
  }

  if (response.status === 400 && body?.title === 'Member Exists') {
    return 'already_subscribed';
  }

  console.error('[ComingSoonService] Mailchimp returned an error', {
    status: response.status,
    body,
  });

  throw new MailchimpRequestError(body?.detail ?? 'Unexpected response from Mailchimp');
};
