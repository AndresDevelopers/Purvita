import { useEffect, useState } from 'react';

export interface PaymentCadenceConfig {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfMonth: number | null;
  weekday: number | null;
  reminderDaysBefore: number[];
  defaultAmountCents: number;
  currency: string;
  paymentMode: 'manual' | 'automatic';
  updatedAt: string;
}

interface UsePaymentCadenceReturn {
  config: PaymentCadenceConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook para obtener la configuración de payment cadence del admin.
 * Los usuarios pueden ver esta configuración para entender cómo funcionan
 * los pagos automáticos o manuales.
 */
export function usePaymentCadence(): UsePaymentCadenceReturn {
  const [config, setConfig] = useState<PaymentCadenceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/profile/earnings/payment-cadence', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment cadence configuration');
      }

      const data = await response.json();
      setConfig(data);
    } catch (err) {
      console.error('Error fetching payment cadence:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    refresh: fetchConfig,
  };
}
