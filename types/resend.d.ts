declare module 'resend' {
  export interface ResendSendPayload {
    from: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
  }

  export interface ResendSendResponse {
    data?: unknown;
    error?: { message?: string } | null;
  }

  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(payload: ResendSendPayload): Promise<ResendSendResponse>;
    };
  }
}
