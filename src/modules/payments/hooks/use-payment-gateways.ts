'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PaymentGatewayPublicInfo,
  PaymentGatewaySettings,
  PaymentGatewayUpdateInput,
} from '../domain/models/payment-gateway';
import { getPaymentGatewayModule } from '../factories/payment-gateway-singleton';
import { getEnvironmentFallbackProviders } from '../utils/environment-fallback-providers';

const mergeWithFallback = (
  primary: PaymentGatewayPublicInfo[],
  fallback: PaymentGatewayPublicInfo[],
) => {
  const merged = new Map(primary.map((provider) => [provider.provider, provider]));

  fallback.forEach((provider) => {
    if (!merged.has(provider.provider)) {
      merged.set(provider.provider, provider);
    }
  });

  return Array.from(merged.values()).sort((a, b) => a.provider.localeCompare(b.provider));
};

const upsertSetting = (
  settings: PaymentGatewaySettings[],
  updated: PaymentGatewaySettings,
): PaymentGatewaySettings[] => {
  const existingIndex = settings.findIndex((item) => item.provider === updated.provider);
  if (existingIndex === -1) {
    return [...settings, updated].sort((a, b) => a.provider.localeCompare(b.provider));
  }
  const next = [...settings];
  next[existingIndex] = updated;
  return next;
};

export const usePaymentGatewaySettings = () => {
  const { repository, eventBus } = getPaymentGatewayModule();

  const [settings, setSettings] = useState<PaymentGatewaySettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await repository.listSettings();
      setSettings(data);
      setError(null);
      eventBus.emit({ type: 'settings_loaded', payload: data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load payment settings';
      setError(message);
      eventBus.emit({ type: 'settings_update_failed', error: new Error(message) });
    } finally {
      setIsLoading(false);
    }
  }, [eventBus, repository]);

  const saveSettings = useCallback(
    async (input: PaymentGatewayUpdateInput) => {
      setIsSaving(true);
      try {
        const updated = await repository.updateSettings(input);
        setSettings((previous) => upsertSetting(previous, updated));
        setError(null);
        eventBus.emit({ type: 'settings_updated', payload: updated });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update payment settings';
        setError(message);
        const error = err instanceof Error ? err : new Error(message);
        eventBus.emit({ type: 'settings_update_failed', error });
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [eventBus, repository],
  );

  useEffect(() => {
    const unsubscribe = eventBus.subscribe((event) => {
      if (event.type === 'settings_loaded') {
        setSettings(event.payload);
      }
      if (event.type === 'settings_updated') {
        setSettings((previous) => upsertSetting(previous, event.payload));
      }
      if (event.type === 'settings_update_failed') {
        setError(event.error.message);
      }
    });

    fetchSettings();

    return () => {
      unsubscribe();
    };
  }, [eventBus, fetchSettings]);

  return useMemo(
    () => ({
      settings,
      isLoading,
      isSaving,
      error,
      refresh: fetchSettings,
      update: saveSettings,
    }),
    [settings, isLoading, isSaving, error, fetchSettings, saveSettings],
  );
};

export const usePaymentProviders = () => {
  const { repository, eventBus } = getPaymentGatewayModule();

  const [providers, setProviders] = useState<PaymentGatewayPublicInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await repository.listActiveGateways();
      const fallbackProviders = getEnvironmentFallbackProviders();
      const resolvedProviders = mergeWithFallback(data, fallbackProviders);

      setProviders(resolvedProviders);
      setError(null);
      eventBus.emit({ type: 'providers_loaded', payload: resolvedProviders });
    } catch (err) {
      const fallbackProviders = getEnvironmentFallbackProviders();

      if (fallbackProviders.length > 0) {
        setProviders(fallbackProviders);
        setError(null);
        eventBus.emit({ type: 'providers_loaded', payload: fallbackProviders });
      } else {
        const message = err instanceof Error ? err.message : 'Unable to load payment providers';
        setError(message);
        const error = err instanceof Error ? err : new Error(message);
        eventBus.emit({ type: 'providers_load_failed', error });
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventBus, repository]);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe((event) => {
      if (event.type === 'providers_loaded') {
        setProviders(event.payload);
      }
      if (event.type === 'providers_load_failed') {
        setError(event.error.message);
      }
      if (event.type === 'settings_updated' || event.type === 'settings_loaded') {
        fetchProviders();
      }
    });

    fetchProviders();

    return () => {
      unsubscribe();
    };
  }, [eventBus, fetchProviders]);

  return useMemo(
    () => ({
      providers,
      isLoading,
      error,
      refresh: fetchProviders,
    }),
    [providers, isLoading, error, fetchProviders],
  );
};
