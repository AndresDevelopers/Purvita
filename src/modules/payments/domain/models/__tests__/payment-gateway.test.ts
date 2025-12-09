import { describe, expect, it } from 'vitest';

import { mapRecordToSettings, type PaymentGatewayRecord } from '../payment-gateway';

const buildRecord = (overrides: Partial<PaymentGatewayRecord> = {}): PaymentGatewayRecord => ({
  provider: 'stripe',
  status: 'active',
  is_active: true,
  credentials: {
    clientId: 'acct_live',
    publishableKey: 'pk_live_value',
    secret: 'sk_live_secret_value',
    webhookSecret: 'whsec_live_value',
    connectClientId: null,
    testClientId: 'acct_test',
    testPublishableKey: 'pk_test_value',
    testSecret: 'sk_test_secret_value',
    testWebhookSecret: 'whsec_test_value',
    testConnectClientId: null,
    mode: 'production',
  },
  created_at: null,
  updated_at: '2024-02-01T00:00:00.000Z',
  ...overrides,
});

describe('mapRecordToSettings', () => {
  it('exposes masked previews for stored secrets', () => {
    const settings = mapRecordToSettings(buildRecord());

    expect(settings.secretPreview).toBe('••••alue');
    expect(settings.webhookSecretPreview).toBe('••••alue');
    expect(settings.testSecretPreview).toBe('••••alue');
    expect(settings.testWebhookSecretPreview).toBe('••••alue');
    expect(settings.mode).toBe('production');
  });

  it('returns null previews when no secret is stored', () => {
    const record = buildRecord({
      credentials: {
        clientId: null,
        publishableKey: 'pk_live_value',
        secret: null,
        webhookSecret: null,
        connectClientId: null,
        testClientId: null,
        testPublishableKey: 'pk_test_value',
        testSecret: null,
        testWebhookSecret: null,
        testConnectClientId: null,
        mode: 'test',
      },
    });

    const settings = mapRecordToSettings(record);

    expect(settings.secretPreview).toBeNull();
    expect(settings.webhookSecretPreview).toBeNull();
    expect(settings.testSecretPreview).toBeNull();
    expect(settings.testWebhookSecretPreview).toBeNull();
    expect(settings.mode).toBe('test');
  });

  it('masks short secrets with placeholder dots only', () => {
    const record = buildRecord({
      credentials: {
        clientId: null,
        publishableKey: 'pk_live_value',
        secret: 'abc',
        webhookSecret: 'a',
        connectClientId: null,
        testClientId: null,
        testPublishableKey: 'pk_test_value',
        testSecret: 'abcd',
        testWebhookSecret: null,
        testConnectClientId: null,
        mode: 'test',
      },
    });

    const settings = mapRecordToSettings(record);

    expect(settings.secretPreview).toBe('••••');
    expect(settings.webhookSecretPreview).toBe('••••');
    expect(settings.testSecretPreview).toBe('••••');
    expect(settings.testWebhookSecretPreview).toBeNull();
  });
});
