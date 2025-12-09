import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { detectUserCountryClient } from '@/lib/services/geolocation-service';

export interface UseAutoDetectCountryOptions {
  userId: string | null;
  isAuthenticated: boolean;
  currentCountry: string | null;
  /**
   * If true, will automatically detect and save country when user doesn't have one set
   */
  enabled?: boolean;
}

export interface UseAutoDetectCountryResult {
  isDetecting: boolean;
  detectedCountry: string | null;
  error: Error | null;
  detect: () => Promise<void>;
}

/**
 * Hook to automatically detect and save user's country based on geolocation
 * Only runs if user doesn't have a country set in their profile
 */
export function useAutoDetectCountry(options: UseAutoDetectCountryOptions): UseAutoDetectCountryResult {
  const { userId, isAuthenticated, currentCountry, enabled = true } = options;
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const hasDetectedRef = useRef(false);

  const detect = useCallback(async () => {
    if (!userId || !isAuthenticated) {
      return;
    }

    // Don't detect if user already has a country
    if (currentCountry) {
      return;
    }

    // Prevent multiple simultaneous detections
    if (isDetecting || hasDetectedRef.current) {
      return;
    }

    setIsDetecting(true);
    setError(null);

    try {
      // Detect country from IP
      const result = await detectUserCountryClient();

      if (!result.countryCode) {
        throw new Error('Could not detect country from IP address');
      }

      // Save to user profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ country: result.countryCode })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to save country to profile: ${updateError.message}`);
      }

      setDetectedCountry(result.countryCode);
      hasDetectedRef.current = true;

      console.log('[AutoDetectCountry] Successfully detected and saved country:', result.countryCode, 'from', result.source);
    } catch (err) {
      const resolvedError = err instanceof Error ? err : new Error('Failed to detect country');
      setError(resolvedError);
      console.error('[AutoDetectCountry] Error:', resolvedError);
    } finally {
      setIsDetecting(false);
    }
  }, [userId, isAuthenticated, currentCountry, isDetecting]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !userId || currentCountry || hasDetectedRef.current) {
      return;
    }

    detect();
  }, [enabled, isAuthenticated, userId, currentCountry, detect]);

  return {
    isDetecting,
    detectedCountry,
    error,
    detect,
  };
}
