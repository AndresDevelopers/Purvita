import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  PaymentGatewaySettings,
  PaymentGatewayUpdateInput,
  PaymentProvider,
} from '../domain/models/payment-gateway';

interface UsePaymentGatewayFormProps {
  provider: PaymentProvider;
  initialSettings?: PaymentGatewaySettings;
  copy: {
    fieldRequiredMessage: string;
    secretRequiredMessage?: string;
    publishableKeyRequiredMessage?: string;
  };
}

/**
 * Custom hook for managing payment gateway form state and validation
 * 
 * @param props - Configuration object containing provider, settings, and copy text
 * @returns Form state, handlers, and utility functions
 */
export const usePaymentGatewayForm = ({
  provider,
  initialSettings,
  copy,
}: UsePaymentGatewayFormProps) => {
  const [status, setStatus] = useState<PaymentGatewaySettings['status']>('inactive');
  const [clientId, setClientId] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [secret, setSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialSettings?.status ?? 'inactive');
    setClientId(initialSettings?.clientId ?? '');
    setPublishableKey(initialSettings?.publishableKey ?? '');
    setSecret('');
    setWebhookSecret('');
    setFormError(null);
  }, [initialSettings]);

  /**
   * Validates the payment gateway form based on provider and status
   * Includes format validation for API keys and secrets
   * 
   * @returns Error message if validation fails, null if valid
   */
  const validateForm = useCallback((): string | null => {
    if (status === 'active') {
      // PayPal validation
      if (provider === 'paypal') {
        const trimmedClientId = clientId.trim();
        if (!trimmedClientId) {
          return copy.fieldRequiredMessage;
        }
        // PayPal Client IDs are typically 80 characters
        if (trimmedClientId.length < 50) {
          return 'Invalid PayPal Client ID format';
        }
      }

      // Stripe validation
      if (provider === 'stripe') {
        const trimmedKey = publishableKey.trim();
        if (!trimmedKey) {
          return copy.publishableKeyRequiredMessage ?? copy.fieldRequiredMessage;
        }
        // Stripe publishable keys start with pk_test_ or pk_live_
        if (!trimmedKey.startsWith('pk_test_') && !trimmedKey.startsWith('pk_live_')) {
          return 'Invalid Stripe publishable key format';
        }
      }

      // Secret validation (both providers)
      if (!initialSettings?.hasSecret) {
        const trimmedSecret = secret.trim();
        if (!trimmedSecret) {
          return copy.secretRequiredMessage ?? copy.fieldRequiredMessage;
        }
        
        // Basic length check
        if (trimmedSecret.length < 20) {
          return 'Secret key appears to be invalid (too short)';
        }

        // Provider-specific secret validation
        if (provider === 'stripe' && !trimmedSecret.startsWith('sk_')) {
          return 'Invalid Stripe secret key format';
        }
      }
    }
    return null;
  }, [status, provider, clientId, publishableKey, secret, initialSettings, copy]);

  /**
   * Sanitizes API credentials by trimming whitespace only
   * Does NOT remove special characters as they're part of the key
   * 
   * @param input - Raw credential string
   * @returns Trimmed credential
   */
  const sanitizeCredential = useCallback((input: string): string => {
    // ✅ SECURITY: For API credentials, only trim whitespace
    // Do NOT use HTML sanitization as it would corrupt the keys
    return input.trim();
  }, []);

  /**
   * Builds the payload for updating payment gateway settings
   * Sanitizes all input fields and handles null appropriately
   * 
   * @returns Sanitized payment gateway update payload
   */
  const buildPayload = useCallback((): PaymentGatewayUpdateInput => {
    const trimmedClientId = sanitizeCredential(clientId);
    const trimmedPublishableKey = sanitizeCredential(publishableKey);
    const trimmedSecret = sanitizeCredential(secret);
    const trimmedWebhook = sanitizeCredential(webhookSecret);

    return {
      provider,
      status,
      clientId: trimmedClientId || null,
      publishableKey: trimmedPublishableKey || null,
      secret: trimmedSecret || null,
      webhookSecret: trimmedWebhook || null,
    };
  }, [provider, status, clientId, publishableKey, secret, webhookSecret, sanitizeCredential]);

  /**
   * Resets secret fields to empty strings
   */
  const resetSecrets = useCallback(() => {
    if (secret.trim()) setSecret('');
    if (webhookSecret.trim()) setWebhookSecret('');
  }, [secret, webhookSecret]);

  return useMemo(() => ({
    // State
    status,
    clientId,
    publishableKey,
    secret,
    webhookSecret,
    formError,
    // Actions
    setStatus,
    setClientId,
    setPublishableKey,
    setSecret,
    setWebhookSecret,
    setFormError,
    // Utilities
    validateForm,
    buildPayload,
    resetSecrets,
  }), [
    status,
    clientId,
    publishableKey,
    secret,
    webhookSecret,
    formError,
    validateForm,
    buildPayload,
    resetSecrets,
  ]);
};