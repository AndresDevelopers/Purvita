import { useEffect, useMemo, useState } from 'react';

export interface UseCountryCartAvailabilityOptions {
  enabled?: boolean;
}

export interface UseCountryCartAvailabilityResult {
  allowed: boolean;
  isLoading: boolean;
  error: Error | null;
  source: 'service' | 'anon' | 'settings-fallback' | 'unknown';
}

interface ApiResponsePayload {
  allowed?: boolean;
  source?: string;
}

const resolveAllowedFlag = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = (payload as ApiResponsePayload).allowed;

  if (typeof candidate === 'boolean') {
    return candidate;
  }

  return Boolean(candidate);
};

const normalizeCountry = (country: string | null | undefined): string | null => {
  if (!country) {
    return null;
  }

  const normalized = country.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

export function useCountryCartAvailability(
  country: string | null,
  options: UseCountryCartAvailabilityOptions = {},
): UseCountryCartAvailabilityResult {
  const normalizedCountry = useMemo(() => normalizeCountry(country), [country]);
  const enabled = options.enabled ?? true;
  const [allowed, setAllowed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<'service' | 'anon' | 'settings-fallback' | 'unknown'>('unknown');

  useEffect(() => {
    if (!enabled || !normalizedCountry) {
      setAllowed(false);
      setIsLoading(false);
      setError(null);
      setSource('unknown');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadAvailability = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/products/cart-availability?country=${normalizedCountry}`,
          { signal: controller.signal },
        );

        const payload = (await response.json().catch(() => null)) as
          | (ApiResponsePayload & { error?: string })
          | { error?: string }
          | null;

        if (!response.ok) {
          const message = payload?.error ?? `Request failed with status ${response.status}`;
          throw new Error(message);
        }
        if (cancelled) {
          return;
        }

        setAllowed(resolveAllowedFlag(payload));
        const resolvedSource = (payload && typeof payload === 'object' && 'source' in payload)
          ? payload.source
          : undefined;
        if (resolvedSource === 'service' || resolvedSource === 'anon' || resolvedSource === 'settings-fallback') {
          setSource(resolvedSource);
        } else {
          setSource('unknown');
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }

        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return;
        }

        const resolvedError = caught instanceof Error ? caught : new Error('Unable to check cart availability');
        setError(resolvedError);
        setAllowed(false);
        setSource('unknown');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAvailability();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, normalizedCountry]);

  return { allowed, isLoading, error, source };
}
