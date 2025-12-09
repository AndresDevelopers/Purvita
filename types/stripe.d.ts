declare module 'stripe' {
  interface StripeEventData {
    object: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface StripeEvent {
    id: string;
    type: string;
    data: StripeEventData;
    [key: string]: unknown;
  }

  interface StripeOptions {
    apiVersion?: string;
  }

  interface CheckoutSession {
    id: string;
    url: string | null;
    [key: string]: unknown;
  }

  interface StripeCheckoutSessionsApi {
    create(params: Record<string, unknown>): Promise<CheckoutSession>;
  }

  interface StripeCheckoutApi {
    sessions: StripeCheckoutSessionsApi;
  }

  interface StripeWebhooksApi {
    constructEvent(payload: string | Buffer, header: string, secret: string): StripeEvent;
  }

  export default class Stripe {
    constructor(apiKey: string, options?: StripeOptions);
    checkout: StripeCheckoutApi;
    webhooks: StripeWebhooksApi;
  }

  export namespace Stripe {
    export type Event = StripeEvent;
  }
}
