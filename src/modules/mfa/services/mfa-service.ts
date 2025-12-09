/**
 * MFA Service
 * 
 * Server-side service for managing MFA/2FA using Supabase's native TOTP support.
 * This service handles enrollment, verification, and unenrollment of MFA factors.
 */

import type { SupabaseClient, AuthMFAEnrollResponse, AuthMFAVerifyResponse, AuthMFAChallengeResponse, AuthMFAUnenrollResponse, AuthMFAListFactorsResponse } from '@supabase/supabase-js';
import type {
  MfaEnrollmentResult,
  MfaVerifyResult,
  MfaUnenrollResult,
  MfaStatus,
  MfaChallengeResult,
  MfaVerifyChallengeResult,
  MfaFactor,
} from '../types';

export class MfaService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current MFA status for the authenticated user
   */
  async getMfaStatus(): Promise<MfaStatus> {
    const { data, error } = await this.supabase.auth.mfa.listFactors() as AuthMFAListFactorsResponse;

    if (error) {
      console.error('[MfaService] Error getting MFA status:', error);
      return {
        isEnabled: false,
        factors: [],
        hasVerifiedFactor: false,
      };
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

    return {
      isEnabled: hasVerifiedFactor,
      factors,
      hasVerifiedFactor,
    };
  }

  /**
   * Start MFA enrollment process
   * Returns QR code and secret for user to set up their authenticator app
   */
  async enrollMfa(friendlyName?: string): Promise<MfaEnrollmentResult> {
    try {
      const { data, error } = await this.supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: friendlyName || 'Authenticator App',
      }) as AuthMFAEnrollResponse;

      if (error) {
        console.error('[MfaService] Enrollment error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'No enrollment data returned',
        };
      }

      // Type guard for TOTP enrollment data
      if (data.type !== 'totp' || !('totp' in data)) {
        return {
          success: false,
          error: 'Invalid enrollment type - expected TOTP',
        };
      }

      const totpData = data as { id: string; type: 'totp'; totp: { qr_code: string; secret: string; uri: string } };

      return {
        success: true,
        enrollment: {
          id: totpData.id,
          type: 'totp',
          totp: {
            qr_code: totpData.totp.qr_code,
            secret: totpData.totp.secret,
            uri: totpData.totp.uri,
          },
        },
      };
    } catch (err) {
      console.error('[MfaService] Enrollment exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error during enrollment',
      };
    }
  }

  /**
   * Verify MFA enrollment with a TOTP code
   * This completes the enrollment process and activates MFA
   */
  async verifyEnrollment(factorId: string, code: string): Promise<MfaVerifyResult> {
    try {
      // First create a challenge
      const { data: challengeData, error: challengeError } = await this.supabase.auth.mfa.challenge({
        factorId,
      }) as AuthMFAChallengeResponse;

      if (challengeError || !challengeData) {
        console.error('[MfaService] Challenge error:', challengeError);
        return {
          success: false,
          error: challengeError?.message || 'Failed to create challenge',
        };
      }

      // Verify the challenge with the provided code
      const { error: verifyError } = await this.supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      }) as AuthMFAVerifyResponse;

      if (verifyError) {
        console.error('[MfaService] Verify error:', verifyError);
        return {
          success: false,
          error: verifyError.message,
        };
      }

      return { success: true };
    } catch (err) {
      console.error('[MfaService] Verify exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error during verification',
      };
    }
  }

  /**
   * Unenroll (disable) an MFA factor
   */
  async unenrollMfa(factorId: string): Promise<MfaUnenrollResult> {
    try {
      const { error } = await this.supabase.auth.mfa.unenroll({
        factorId,
      }) as AuthMFAUnenrollResponse;

      if (error) {
        console.error('[MfaService] Unenroll error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (err) {
      console.error('[MfaService] Unenroll exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error during unenrollment',
      };
    }
  }

  /**
   * Create an MFA challenge for login verification
   */
  async createChallenge(factorId: string): Promise<MfaChallengeResult> {
    try {
      const { data, error } = await this.supabase.auth.mfa.challenge({
        factorId,
      }) as AuthMFAChallengeResponse;

      if (error || !data) {
        console.error('[MfaService] Challenge creation error:', error);
        return {
          success: false,
          error: error?.message || 'Failed to create challenge',
        };
      }

      return {
        success: true,
        challenge: {
          id: data.id,
          expiresAt: data.expires_at,
        },
      };
    } catch (err) {
      console.error('[MfaService] Challenge creation exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error creating challenge',
      };
    }
  }

  /**
   * Verify an MFA challenge during login
   */
  async verifyChallenge(
    factorId: string,
    challengeId: string,
    code: string
  ): Promise<MfaVerifyChallengeResult> {
    try {
      const { error } = await this.supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      }) as AuthMFAVerifyResponse;

      if (error) {
        console.error('[MfaService] Challenge verification error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      // After successful MFA verification, get the updated session
      const { data: sessionData } = await this.supabase.auth.getSession();

      return {
        success: true,
        session: sessionData.session ? {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_at: sessionData.session.expires_at || 0,
          expires_in: sessionData.session.expires_in || 0,
        } : undefined,
      };
    } catch (err) {
      console.error('[MfaService] Challenge verification exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error verifying challenge',
      };
    }
  }

  /**
   * Check if the current session requires MFA verification
   * Returns the factor ID if MFA is required, null otherwise
   */
  async checkMfaRequired(): Promise<{ required: boolean; factorId?: string }> {
    const { data } = await this.supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (!data) {
      return { required: false };
    }

    // If current level is aal1 but next level is aal2, MFA is required
    if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
      // Get the first verified TOTP factor
      const status = await this.getMfaStatus();
      const verifiedFactor = status.factors.find((f) => f.status === 'verified');

      return {
        required: true,
        factorId: verifiedFactor?.id,
      };
    }

    return { required: false };
  }

  /**
   * Get the current authentication assurance level
   */
  async getAssuranceLevel(): Promise<{ currentLevel: string; nextLevel: string | null }> {
    const { data, error } = await this.supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error || !data) {
      return { currentLevel: 'aal1', nextLevel: null };
    }

    return {
      currentLevel: data.currentLevel || 'aal1',
      nextLevel: data.nextLevel || null,
    };
  }
}

/**
 * Create MFA service instance
 */
export function createMfaService(supabase: SupabaseClient): MfaService {
  return new MfaService(supabase);
}
