import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseDetectCountryOptions {
  /**
   * Automatically detect country on mount
   * Defaults to true
   */
  autoDetect?: boolean;
}

export interface UseDetectCountryResult {
  country: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const normalizeCountry = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

interface DetectCountryResponse {
  country?: unknown;
  countryCode?: unknown;
  source?: string;
  [key: string]: unknown;
}

let detectionPromise: Promise<DetectCountryResponse> | null = null;

const getOrCreateDetectionPromise = (): Promise<DetectCountryResponse> => {
  if (detectionPromise) {
    return detectionPromise;
  }

  detectionPromise = (async () => {
    try {
      const response = await fetch('/api/geolocation/detect-country', {
        method: 'GET',
      });

      if (!response.ok) {
        let message = 'Failed to detect country';
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            message = errorData.message;
          }
        } catch {
          // Ignore JSON parsing errors on error responses
        }
        throw new Error(message);
      }

      try {
        const result = (await response.json()) as DetectCountryResponse | null;
        return result ?? {};
      } catch {
        return {};
      }
    } finally {
      detectionPromise = null;
    }
  })();

  return detectionPromise;
};

/**
 * Hook to detect user's country from their IP address
 * Works for both authenticated and unauthenticated users
 * Does not save the country to the database
 */
export function useDetectCountry(options: UseDetectCountryOptions = {}): UseDetectCountryResult {
  const { autoDetect = true } = options;
  const [country, setCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const hasDetectedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((updater: () => void) => {
    if (!isMountedRef.current) {
      return;
    }
    updater();
  }, []);

  const refresh = useCallback(async () => {
    if (hasDetectedRef.current) {
      return;
    }

    safeSet(() => {
      setIsLoading(true);
      setError(null);
    });

    try {
      const result = await getOrCreateDetectionPromise();

      const normalized = normalizeCountry(result?.country ?? result?.countryCode ?? null);

      if (normalized) {
        safeSet(() => {
          setCountry(normalized);
        });
      } else {
        // Silently ignore if no country code found
      }

      hasDetectedRef.current = true;
    } catch (caught) {
      const resolvedError = caught instanceof Error ? caught : new Error('Failed to detect country');
      // console.error('[useDetectCountry] Detection error:', resolvedError);
      safeSet(() => {
        setError(resolvedError);
      });
      hasDetectedRef.current = true;
    } finally {
      safeSet(() => {
        setIsLoading(false);
      });
    }
  }, [safeSet]);

  useEffect(() => {
    if (!autoDetect) {
      return;
    }

    refresh();
  }, [autoDetect, refresh]);

  return {
    country,
    isLoading,
    error,
    refresh,
  };
}

