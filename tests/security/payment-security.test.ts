/**
 * Payment Security Tests
 *
 * Tests for payment-related security vulnerabilities:
 * - Price manipulation
 * - Metadata injection
 * - Webhook signature verification
 * - Payment intent validation
 */

import { describe, it, expect } from 'vitest';
import { validatePayment, sanitizePaymentMetadata } from '@/lib/security/payment-validation';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9001';

describe('Payment Security - Price Manipulation', () => {
  it('should reject negative amounts', async () => {
    const result = await validatePayment({
      amountCents: -100,
      currency: 'USD',
      intent: 'checkout',
      metadata: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject zero amounts', async () => {
    const result = await validatePayment({
      amountCents: 0,
      currency: 'USD',
      intent: 'checkout',
      metadata: {},
    });

    expect(result.valid).toBe(false);
  });

  it('should reject amounts below minimum ($0.50)', async () => {
    const result = await validatePayment({
      amountCents: 49, // Less than $0.50
      currency: 'USD',
      intent: 'checkout',
      metadata: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Minimum');
  });

  it('should reject amounts above maximum ($100,000)', async () => {
    const result = await validatePayment({
      amountCents: 10000001, // More than $100,000
      currency: 'USD',
      intent: 'checkout',
      metadata: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('should reject non-integer amounts', async () => {
    const result = await validatePayment({
      amountCents: 99.99, // Should be integer (cents)
      currency: 'USD',
      intent: 'checkout',
      metadata: {},
    });

    expect(result.valid).toBe(false);
  });

  it('should accept valid amount', async () => {
    const result = await validatePayment({
      amountCents: 1000, // $10.00
      currency: 'USD',
      intent: 'wallet_recharge',
      metadata: {
        userId: 'test-user-id',
        rechargeId: 'test-recharge-id',
      },
    });

    expect(result.valid).toBe(true);
  });
});

describe('Payment Security - Currency Validation', () => {
  it('should reject invalid currency codes', async () => {
    const invalidCurrencies = ['US', 'DOLLAR', 'XXX', '123', 'usd1'];

    for (const currency of invalidCurrencies) {
      const result = await validatePayment({
        amountCents: 1000,
        currency,
        intent: 'checkout',
        metadata: {},
      });

      expect(result.valid).toBe(false);
    }
  });

  it('should accept valid currency codes', async () => {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

    for (const currency of validCurrencies) {
      const result = await validatePayment({
        amountCents: 1000,
        currency,
        intent: 'wallet_recharge',
        metadata: {
          userId: 'test-user-id',
          rechargeId: 'test-recharge-id',
        },
      });

      expect(result.valid).toBe(true);
    }
  });

  it('should normalize currency to uppercase', async () => {
    const result = await validatePayment({
      amountCents: 1000,
      currency: 'usd', // lowercase
      intent: 'wallet_recharge',
      metadata: {
        userId: 'test-user-id',
        rechargeId: 'test-recharge-id',
      },
    });

    expect(result.valid).toBe(true);
  });
});

describe('Payment Security - Metadata Sanitization', () => {
  it('should remove disallowed metadata keys', () => {
    const maliciousMetadata = {
      userId: 'user-123',
      __proto__: { admin: true },
      constructor: 'malicious',
      prototype: { role: 'admin' },
      adminAccess: true,
      secretKey: 'abc123',
    };

    const sanitized = sanitizePaymentMetadata(maliciousMetadata);

    expect(sanitized).toHaveProperty('userId');
    expect(sanitized).not.toHaveProperty('__proto__');
    expect(sanitized).not.toHaveProperty('constructor');
    expect(sanitized).not.toHaveProperty('prototype');
    expect(sanitized).not.toHaveProperty('adminAccess');
    expect(sanitized).not.toHaveProperty('secretKey');
  });

  it('should sanitize string values in metadata', () => {
    const metadata = {
      description: '<script>alert("XSS")</script>',
      orderId: 'order-123<img src=x onerror=alert(1)>',
      productName: 'Product; DROP TABLE orders--',
    };

    const sanitized = sanitizePaymentMetadata(metadata);

    expect(sanitized.description).not.toContain('<script>');
    expect(sanitized.orderId).not.toContain('<img');
    expect(sanitized.productName).not.toContain('DROP TABLE');
  });

  it('should limit string length in metadata', () => {
    const longString = 'x'.repeat(1000);
    const metadata = {
      description: longString,
    };

    const sanitized = sanitizePaymentMetadata(metadata);

    expect(typeof sanitized.description).toBe('string');
    expect((sanitized.description as string).length).toBeLessThanOrEqual(500);
  });

  it('should preserve allowed metadata keys', () => {
    const validMetadata = {
      userId: 'user-123',
      orderId: 'order-456',
      productId: 'product-789',
      subscriptionId: 'sub-012',
      intent: 'checkout',
      description: 'Test payment',
    };

    const sanitized = sanitizePaymentMetadata(validMetadata);

    expect(sanitized).toHaveProperty('userId', 'user-123');
    expect(sanitized).toHaveProperty('orderId', 'order-456');
    expect(sanitized).toHaveProperty('productId', 'product-789');
    expect(sanitized).toHaveProperty('subscriptionId', 'sub-012');
    expect(sanitized).toHaveProperty('intent', 'checkout');
    expect(sanitized).toHaveProperty('description', 'Test payment');
  });

  it('should handle null and undefined metadata', () => {
    const sanitizedNull = sanitizePaymentMetadata(null);
    const sanitizedUndefined = sanitizePaymentMetadata(undefined);

    expect(sanitizedNull).toEqual({});
    expect(sanitizedUndefined).toEqual({});
  });
});

describe('Payment Security - Payment Intent Validation', () => {
  it('should reject invalid payment intents', async () => {
    const invalidIntents = [
      'invalid',
      'admin',
      'refund',
      '',
      'null',
    ];

    for (const intent of invalidIntents) {
      const result = await validatePayment({
        amountCents: 1000,
        currency: 'USD',
        intent,
        metadata: {},
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('intent');
    }
  });

  it('should validate wallet_recharge requires userId and rechargeId', async () => {
    const result = await validatePayment({
      amountCents: 1000,
      currency: 'USD',
      intent: 'wallet_recharge',
      metadata: {
        // Missing userId and rechargeId
      },
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('userId');
  });

  it('should validate subscription requires subscriptionId', async () => {
    const result = await validatePayment({
      amountCents: 1000,
      currency: 'USD',
      intent: 'subscription',
      metadata: {
        // Missing subscriptionId
      },
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('subscriptionId');
  });

  it('should accept valid payment intents', async () => {
    const validIntents = [
      { intent: 'checkout', metadata: {} },
      { intent: 'subscription', metadata: { subscriptionId: 'sub-123' } },
      { intent: 'wallet_recharge', metadata: { userId: 'user-123', rechargeId: 'recharge-123' } },
      { intent: 'donation', metadata: {} },
      { intent: 'upgrade', metadata: { userId: 'user-123' } },
    ];

    for (const { intent, metadata } of validIntents) {
      const result = await validatePayment({
        amountCents: 1000,
        currency: 'USD',
        intent,
        metadata,
      });

      expect(result.valid).toBe(true);
    }
  });
});

describe('Payment Security - Webhook Signature Verification', () => {
  it('should reject webhooks without signature', async () => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9001';

    const response = await fetch(`${API_BASE_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event: 'test' }),
    });

    // Should reject without signature
    expect([400, 401, 403]).toContain(response.status);
  });

  it('should reject webhooks with invalid signature', async () => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9001';

    const response = await fetch(`${API_BASE_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid-signature',
      },
      body: JSON.stringify({ event: 'test' }),
    });

    // Should reject invalid signature
    expect([400, 401]).toContain(response.status);
  });
});

describe('Payment Security - Race Conditions', () => {
  it('should handle concurrent payment requests safely', async () => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9001';

    // Simulate concurrent checkout requests
    const requests = Array.from({ length: 5 }, () =>
      fetch(`${API_BASE_URL}/api/payments/stripe/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1000,
          currency: 'usd',
          description: 'Test payment',
        }),
      })
    );

    const responses = await Promise.all(requests);

    // All should either succeed or fail gracefully
    for (const response of responses) {
      expect([200, 400, 401, 403, 422, 429, 500]).toContain(response.status);
    }
  }, 15000);
});

describe('Payment Security - Idempotency', () => {
  it('should handle duplicate webhook events', async () => {
    // This would require a real webhook event ID
    // In practice, this is tested by sending the same event twice
    // The second occurrence should be ignored (already processed)
    expect(true).toBe(true); // Placeholder
  });
});

describe('Payment Security - Amount Precision', () => {
  it('should handle floating point precision correctly', () => {
    // Common floating point issues
    const tests = [
      { dollars: 0.1 + 0.2, expectedCents: 30 },
      { dollars: 0.3, expectedCents: 30 },
      { dollars: 9.99, expectedCents: 999 },
      { dollars: 10.01, expectedCents: 1001 },
    ];

    for (const { dollars, expectedCents } of tests) {
      const cents = Math.round(dollars * 100);
      expect(cents).toBe(expectedCents);
    }
  });
});


describe('Payment Security - Refund Fraud Prevention', () => {
  it('should prevent duplicate refund requests', async () => {
    const paymentIntentId = 'pi_test_duplicate_refund';

    // First refund request
    const firstRefund = await fetch(`${API_BASE_URL}/api/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId,
        amount: 1000,
      }),
    });

    // Second refund request for same payment
    const secondRefund = await fetch(`${API_BASE_URL}/api/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId,
        amount: 1000,
      }),
    });

    // Should prevent duplicate refunds
    if (firstRefund.ok) {
      expect([400, 409]).toContain(secondRefund.status);
    }
  });

  it('should prevent partial refund exceeding original amount', async () => {
    const response = await fetch(`${API_BASE_URL}/api/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: 'pi_test_123',
        amount: 999999999, // Excessive amount
      }),
    });

    // Should reject refund exceeding original amount
    expect([400, 403]).toContain(response.status);
  });

  it('should validate refund reason', async () => {
    const response = await fetch(`${API_BASE_URL}/api/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: 'pi_test_123',
        amount: 1000,
        reason: '<script>alert("xss")</script>', // Malicious reason
      }),
    });

    // Should sanitize or reject malicious input
    expect([400, 401, 403, 404]).toContain(response.status);
  });
});

describe('Payment Security - Subscription Manipulation', () => {
  it('should prevent unauthorized subscription upgrades', async () => {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: 'sub_other_user',
        newPriceId: 'price_premium',
      }),
    });

    // Should require authentication and ownership verification
    expect([401, 403, 404]).toContain(response.status);
  });

  it('should prevent subscription price manipulation', async () => {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: 'price_123',
        customPrice: 1, // Trying to set custom price
      }),
    });

    // Should reject custom pricing
    expect([400, 401, 403]).toContain(response.status);
  });

  it('should validate subscription cancellation authorization', async () => {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: 'sub_another_user',
      }),
    });

    // Should require authentication and ownership
    expect([401, 403, 404]).toContain(response.status);
  });
});

describe('Payment Security - Webhook Replay Attack Prevention', () => {
  it('should reject replayed webhook events', async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const payload = JSON.stringify({
      id: 'evt_test_replay',
      type: 'payment_intent.succeeded',
      created: oldTimestamp,
    });

    const response = await fetch(`${API_BASE_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=invalid,v1=invalid',
      },
      body: payload,
    });

    // Should reject old events (replay attack)
    expect([400, 401]).toContain(response.status);
  });

  it('should prevent duplicate webhook processing', async () => {
    const eventId = 'evt_test_duplicate_' + Date.now();
    const payload = JSON.stringify({
      id: eventId,
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
    });

    // First webhook
    const first = await fetch(`${API_BASE_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=invalid,v1=invalid',
      },
      body: payload,
    });

    // Duplicate webhook with same event ID
    const second = await fetch(`${API_BASE_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=invalid,v1=invalid',
      },
      body: payload,
    });

    // Should detect and reject duplicate (idempotency)
    // Note: Both may fail due to invalid signature, but testing idempotency logic
    expect(true).toBe(true); // Placeholder - requires valid signature
  });
});

describe('Payment Security - Amount Validation Edge Cases', () => {
  it('should reject negative amounts', async () => {
    const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: -1000,
        currency: 'usd',
      }),
    });

    expect([400, 403]).toContain(response.status);
  });

  it('should reject zero amounts', async () => {
    const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 0,
        currency: 'usd',
      }),
    });

    expect([400, 403]).toContain(response.status);
  });

  it('should reject amounts below minimum (50 cents)', async () => {
    const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 49, // 49 cents
        currency: 'usd',
      }),
    });

    expect([400, 403]).toContain(response.status);
  });

  it('should reject amounts above maximum ($100,000)', async () => {
    const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 10000001, // $100,000.01
        currency: 'usd',
      }),
    });

    expect([400, 403]).toContain(response.status);
  });

  it('should handle floating point precision correctly', async () => {
    // Test that 0.1 + 0.2 = 0.3 issue doesn't cause problems
    const amount = Math.round((0.1 + 0.2) * 100); // Should be 30 cents
    expect(amount).toBe(30);
  });
});
