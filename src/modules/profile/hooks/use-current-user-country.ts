import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface UseCurrentUserCountryOptions {
  userId: string | null;
  isAuthenticated: boolean;
  isAuthLoading?: boolean;
  /**
   * Automatically load the country when authentication state is ready.
   * Defaults to true so most consumers don't need to call refresh manually.
   */
  autoRefresh?: boolean;
  /**
   * Automatically detect and save country if user doesn't have one set.
   * Defaults to true.
   */
  autoDetect?: boolean;
}

export interface UseCurrentUserCountryResult {
  country: string | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isAutoDetecting: boolean;
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

interface AutoDetectResponse {
  updated?: boolean;
  country?: unknown;
  [key: string]: unknown;
}

const countryFetchPromises = new Map<string, Promise<string | null>>();
const autoDetectPromises = new Map<string, Promise<AutoDetectResponse>>();

const getOrCreateCountryPromise = (userId: string): Promise<string | null> => {
  const existing = countryFetchPromises.get(userId);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', userId)
        .maybeSingle();

      if (queryError) {
        throw new Error(queryError.message ?? 'Unable to load profile country');
      }

      return normalizeCountry(data?.country ?? null);
    } finally {
      countryFetchPromises.delete(userId);
    }
  })();

  countryFetchPromises.set(userId, request);
  return request;
};

const getOrCreateAutoDetectPromise = (userId: string): Promise<AutoDetectResponse> => {
  const existing = autoDetectPromises.get(userId);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const controller = new AbortController();
      const response = await fetch('/api/profile/auto-detect-country', {
        method: 'POST',
        signal: controller.signal
      });

      if (!response.ok) {
        let message = 'Failed to auto-detect country';
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
        const result = (await response.json()) as AutoDetectResponse | null;
        return result ?? {};
      } catch {
        return {};
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {};
      }
      throw error;
    } finally {
      autoDetectPromises.delete(userId);
    }
  })();

  autoDetectPromises.set(userId, request);
  return request;
};

// Añadir cleanup para promesas viejas
const PROMISE_CACHE_TTL = 30000; // 30 segundos
const promiseTimestamps = new Map<string, number>();

const cleanupOldPromises = () => {
  const now = Date.now();
  for (const [userId, timestamp] of promiseTimestamps.entries()) {
    if (now - timestamp > PROMISE_CACHE_TTL) {
      autoDetectPromises.delete(userId);
      promiseTimestamps.delete(userId);
    }
  }
};

// Limpiar periódicamente
setInterval(cleanupOldPromises, PROMISE_CACHE_TTL);

export function useCurrentUserCountry(options: UseCurrentUserCountryOptions): UseCurrentUserCountryResult {
  const { userId, isAuthenticated, isAuthLoading = false, autoRefresh = true, autoDetect = true } = options;
  const [country, setCountry] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const hasAutoDetectedRef = useRef(false);

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

  const autoDetectCountry = useCallback(async () => {
    if (!autoDetect || !isAuthenticated || !userId || hasAutoDetectedRef.current) {
      console.log('[useCurrentUserCountry] Skipping auto-detect:', {
        autoDetect,
        isAuthenticated,
        userId,
        hasAutoDetected: hasAutoDetectedRef.current,
      });
      return;
    }

    console.log('[useCurrentUserCountry] Starting auto-detection for user:', userId);
    safeSet(() => {
      setIsAutoDetecting(true);
    });

    try {
      const result = await getOrCreateAutoDetectPromise(userId);
      console.log('[useCurrentUserCountry] Auto-detect result:', result);

      const normalized = normalizeCountry(result?.country ?? null);

      if (result?.updated && normalized) {
        safeSet(() => {
          setCountry(normalized);
        });
        console.log('[useCurrentUserCountry] Auto-detected and saved country:', normalized);
      } else if (normalized) {
        safeSet(() => {
          setCountry(normalized);
        });
        console.log('[useCurrentUserCountry] Country already set:', normalized);
      }

      hasAutoDetectedRef.current = true;
    } catch (caught) {
      console.error('[useCurrentUserCountry] Auto-detect error:', caught);
      // Don't set error state for auto-detect failures, just log them
    } finally {
      safeSet(() => {
        setIsAutoDetecting(false);
      });
    }
  }, [autoDetect, isAuthenticated, userId, safeSet]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      safeSet(() => {
        setCountry(null);
        setIsFetching(false);
        setError(null);
      });
      return;
    }

    safeSet(() => {
      setIsFetching(true);
      setError(null);
    });

    try {
      const normalized = await getOrCreateCountryPromise(userId);
      safeSet(() => {
        setCountry(normalized);
      });

      // If no country found and auto-detect is enabled, trigger auto-detection
      if (!normalized && autoDetect && !hasAutoDetectedRef.current) {
        await autoDetectCountry();
      }
    } catch (caught) {
      const resolvedError = caught instanceof Error ? caught : new Error('Unable to resolve profile country');
      safeSet(() => {
        setError(resolvedError);
        setCountry(null);
      });
    } finally {
      safeSet(() => {
        setIsFetching(false);
      });
    }
  }, [isAuthenticated, userId, safeSet, autoDetect, autoDetectCountry]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated || !userId) {
      safeSet(() => {
        setCountry(null);
        setError(null);
        setIsFetching(false);
      });
      return;
    }

    refresh();
  }, [autoRefresh, isAuthLoading, isAuthenticated, refresh, safeSet, userId]);

  return {
    country,
    isLoading: isAuthLoading || isFetching || isAutoDetecting,
    isFetching,
    error,
    refresh,
    isAutoDetecting,
  };
}
