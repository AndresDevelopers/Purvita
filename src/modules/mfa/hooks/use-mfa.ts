'use client';

/**
 * useMfa Hook
 * 
 * Client-side hook for managing MFA/2FA state and operations.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  MfaEnrollmentData,
  MfaFactor,
} from '../types';

interface UseMfaState {
  isLoading: boolean;
  isEnabled: boolean;
  factors: MfaFactor[];
  enrollment: MfaEnrollmentData | null;
  error: string | null;
}

interface UseMfaReturn extends UseMfaState {
  refresh: () => Promise<void>;
  startEnrollment: (friendlyName?: string) => Promise<boolean>;
  verifyEnrollment: (factorId: string, code: string) => Promise<boolean>;
  disableMfa: (factorId: string) => Promise<boolean>;
  clearError: () => void;
  clearEnrollment: () => void;
}

export function useMfa(): UseMfaReturn {
  const [state, setState] = useState<UseMfaState>({
    isLoading: true,
    isEnabled: false,
    factors: [],
    enrollment: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      const factors: MfaFactor[] = (data?.totp || []).map((factor) => ({
        id: factor.id,
        factorType: 'totp' as const,
        friendlyName: factor.friendly_name || null,
        status: factor.status as 'unverified' | 'verified',
        createdAt: factor.created_at,
        updatedAt: factor.updated_at,
      }));

      const hasVerifiedFactor = factors.some((f) => f.status === 'verified');

      setState({
        isLoading: false,
        isEnabled: hasVerifiedFactor,
        factors,
        enrollment: null,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load MFA status',
      }));
    }
  }, []);

  const startEnrollment = useCallback(async (friendlyName?: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // First, check if there are any existing unverified factors and remove them
      const { data: existingFactors } = await supabase.auth.mfa.listFactors();
      
      if (existingFactors?.totp) {
        for (const factor of existingFactors.totp) {
          // Only remove unverified factors - don't touch verified ones
          const status = factor.status as string;
          if (status !== 'verified') {
            try {
              await supabase.auth.mfa.unenroll({ factorId: factor.id });
            } catch {
              // Ignore errors during cleanup
            }
          }
        }
        
        // If there's already a verified factor, user already has MFA enabled
        const hasVerified = existingFactors.totp.some(f => (f.status as string) === 'verified');
        if (hasVerified) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isEnabled: true,
            error: 'MFA is already enabled on your account',
          }));
          return false;
        }
      }

      // Use a unique friendly name with timestamp to avoid conflicts
      const uniqueName = friendlyName || `Authenticator App ${Date.now()}`;
      
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: uniqueName,
      });

      if (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return false;
      }

      if (!data || data.type !== 'totp' || !('totp' in data)) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Invalid enrollment response',
        }));
        return false;
      }

      const totpData = data as { id: string; type: 'totp'; totp: { qr_code: string; secret: string; uri: string } };

      setState((prev) => ({
        ...prev,
        isLoading: false,
        enrollment: {
          id: totpData.id,
          type: 'totp',
          totp: {
            qr_code: totpData.totp.qr_code,
            secret: totpData.totp.secret,
            uri: totpData.totp.uri,
          },
        },
      }));

      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to start enrollment',
      }));
      return false;
    }
  }, []);

  const verifyEnrollment = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // First create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError || !challengeData) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: challengeError?.message || 'Failed to create challenge',
        }));
        return false;
      }

      // Verify the challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: verifyError.message,
        }));
        return false;
      }

      // Refresh to get updated status
      await refresh();
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to verify enrollment',
      }));
      return false;
    }
  }, [refresh]);

  const disableMfa = useCallback(async (factorId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return false;
      }

      // Refresh to get updated status
      await refresh();
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to disable MFA',
      }));
      return false;
    }
  }, [refresh]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearEnrollment = useCallback(() => {
    setState((prev) => ({ ...prev, enrollment: null }));
  }, []);

  // Load MFA status on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
    startEnrollment,
    verifyEnrollment,
    disableMfa,
    clearError,
    clearEnrollment,
  };
}
