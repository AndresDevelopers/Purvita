'use client';

import { useState, useCallback } from 'react';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentConfigurationState {
  isValid: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  errors: string[];
}

export const usePaymentConfiguration = (provider: PaymentProvider) => {
  const [state, setState] = useState<PaymentConfigurationState>({
    isValid: false,
    isChecking: false,
    lastChecked: null,
    errors: []
  });

  const checkConfiguration = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isChecking: true, errors: [] }));

    try {
      const response = await fetch(`/api/admin/payments/validate/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();
      
      setState({
        isValid: result.isValid || false,
        isChecking: false,
        lastChecked: new Date(),
        errors: result.errors || []
      });

      return result.isValid || false;
    } catch (_error) {
      setState({
        isValid: false,
        isChecking: false,
        lastChecked: new Date(),
        errors: ['Error de conexión']
      });
      return false;
    }
  }, [provider]);

  const validateCredentials = useCallback(async (credentials: Record<string, string>): Promise<boolean> => {
    setState(prev => ({ ...prev, isChecking: true, errors: [] }));

    try {
      const response = await fetch(`/api/admin/payments/validate/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credentials }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Credential validation failed');
      }

      const result = await response.json();
      
      setState({
        isValid: result.isValid,
        isChecking: false,
        lastChecked: new Date(),
        errors: result.errors || []
      });

      return result.isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState({
        isValid: false,
        isChecking: false,
        lastChecked: new Date(),
        errors: [errorMessage]
      });
      return false;
    }
  }, [provider]);

  return {
    ...state,
    checkConfiguration,
    validateCredentials
  };
};