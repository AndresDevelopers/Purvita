import { describe, expect, it } from 'vitest';

import type {
  PaymentGatewayRecord,
  PaymentGatewayUpdateInput,
} from '../../../domain/models/payment-gateway';
import { __TESTING__ } from '../supabase-payment-gateway-repository';

const { mergeCredentials } = __TESTING__;

const buildExistingRecord = (overrides: Partial<PaymentGatewayRecord> = {}): PaymentGatewayRecord => ({
  provider: 'stripe',
  status: 'active',
  is_active: true,
  credentials: {
    clientId: null,
    publishableKey: 'pk_live_existing',
    secret: 'sk_live_existing',
    webhookSecret: 'whsec_live_existing',
    connectClientId: null,
    testClientId: 'acct_test_existing',
    testPublishableKey: 'pk_test_existing',
    testSecret: 'sk_test_existing',
    testWebhookSecret: 'whsec_test_existing',
    testConnectClientId: null,
    mode: 'production',
  },
  created_at: null,
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('mergeCredentials', () => {
  it('updates live secrets when new values are provided', () => {
    const existing = buildExistingRecord({
      credentials: {
        clientId: null,
        publishableKey: 'pk_live_existing',
        secret: 'sk_live_existing',
        webhookSecret: 'whsec_live_existing',
        connectClientId: null,
        testClientId: 'acct_test_existing',
        testPublishableKey: 'pk_test_existing',
        testSecret: 'sk_test_existing',
        testWebhookSecret: 'whsec_test_existing',
        testConnectClientId: null,
        mode: 'production',
      },
    });

    const input: PaymentGatewayUpdateInput = {
      provider: 'stripe',
      status: 'active',
      publishableKey: 'pk_live_new',
      secret: 'sk_live_new',
      webhookSecret: 'whsec_live_new',
    };

    const result = mergeCredentials(existing, input);

    expect(result.secret).toBe('sk_live_new');
    expect(result.webhookSecret).toBe('whsec_live_new');
    expect(result.publishableKey).toBe('pk_live_new');
    expect(result.testSecret).toBe('sk_test_existing');
    expect(result.testWebhookSecret).toBe('whsec_test_existing');
    expect(result.mode).toBe('production');
  });

  it('retains stored live secrets when request omits them', () => {
    const existing = buildExistingRecord();
    const input: PaymentGatewayUpdateInput = {
      provider: 'stripe',
      status: 'inactive',
      publishableKey: 'pk_live_existing',
    };

    const result = mergeCredentials(existing, input);

    expect(result.secret).toBe('sk_live_existing');
    expect(result.webhookSecret).toBe('whsec_live_existing');
    expect(result.mode).toBe('production');
  });

  it('preserves existing test credentials when no new values are provided', () => {
    const existing = buildExistingRecord();
    const input: PaymentGatewayUpdateInput = {
      provider: 'stripe',
      status: 'active',
    };

    const result = mergeCredentials(existing, input);

    expect(result.testClientId).toBe('acct_test_existing');
    expect(result.testPublishableKey).toBe('pk_test_existing');
    expect(result.testSecret).toBe('sk_test_existing');
    expect(result.testWebhookSecret).toBe('whsec_test_existing');
    expect(result.mode).toBe('production');
  });

  it('updates test credentials when new values are provided', () => {
    const existing = buildExistingRecord();
    const input: PaymentGatewayUpdateInput = {
      provider: 'stripe',
      status: 'inactive',
      testClientId: 'acct_test_new',
      testPublishableKey: 'pk_test_new',
      testSecret: 'sk_test_new',
      testWebhookSecret: 'whsec_test_new',
    };

    const result = mergeCredentials(existing, input);

    expect(result.testClientId).toBe('acct_test_new');
    expect(result.testPublishableKey).toBe('pk_test_new');
    expect(result.testSecret).toBe('sk_test_new');
    expect(result.testWebhookSecret).toBe('whsec_test_new');
  });

  it('clears test secrets when blank strings are submitted', () => {
    const existing = buildExistingRecord();
    const input: PaymentGatewayUpdateInput = {
      provider: 'stripe',
      status: 'active',
      testSecret: '  ',
      testWebhookSecret: '\n',
    };

    const result = mergeCredentials(existing, input);

    expect(result.testSecret).toBeNull();
    expect(result.testWebhookSecret).toBeNull();
  });

  it('switches mode when explicitly provided', () => {
    const existing = buildExistingRecord();
    const input: PaymentGatewayUpdateInput = {
      provider: 'stripe',
      status: 'active',
      mode: 'test',
    };

    const result = mergeCredentials(existing, input);

    expect(result.mode).toBe('test');
  });
});
