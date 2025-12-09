/**
 * MFA (Multi-Factor Authentication) Types
 * 
 * Type definitions for the 2FA/MFA module using Supabase's native TOTP support.
 */

export type MfaFactorType = 'totp';

export interface MfaFactor {
  id: string;
  factorType: MfaFactorType;
  friendlyName: string | null;
  status: 'unverified' | 'verified';
  createdAt: string;
  updatedAt: string;
}

export interface MfaEnrollmentData {
  id: string;
  type: MfaFactorType;
  totp: {
    qr_code: string; // SVG data URL
    secret: string;  // Manual entry secret
    uri: string;     // OTPAuth URI
  };
}

export interface MfaEnrollmentResult {
  success: boolean;
  enrollment?: MfaEnrollmentData;
  error?: string;
}

export interface MfaVerifyResult {
  success: boolean;
  error?: string;
}

export interface MfaUnenrollResult {
  success: boolean;
  error?: string;
}

export interface MfaStatus {
  isEnabled: boolean;
  factors: MfaFactor[];
  hasVerifiedFactor: boolean;
}

export interface MfaChallengeData {
  id: string;
  expiresAt: number;
}

export interface MfaChallengeResult {
  success: boolean;
  challenge?: MfaChallengeData;
  error?: string;
}

export interface MfaVerifyChallengeResult {
  success: boolean;
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
  };
  error?: string;
}

// API Request/Response types
export interface EnrollMfaRequest {
  friendlyName?: string;
}

export interface VerifyMfaEnrollmentRequest {
  factorId: string;
  code: string;
}

export interface UnenrollMfaRequest {
  factorId: string;
}

export interface CreateMfaChallengeRequest {
  factorId: string;
}

export interface VerifyMfaChallengeRequest {
  factorId: string;
  challengeId: string;
  code: string;
}

// Dictionary/Copy types for UI
export interface MfaDictionary {
  title: string;
  description: string;
  enable: {
    title: string;
    description: string;
    button: string;
    scanning: string;
  };
  setup: {
    title: string;
    description: string;
    step1: string;
    step2: string;
    step3: string;
    qrCodeAlt: string;
    manualEntry: string;
    copySecret: string;
    secretCopied: string;
    verificationCode: string;
    verificationPlaceholder: string;
    verifyButton: string;
    verifying: string;
    cancelButton: string;
  };
  enabled: {
    title: string;
    description: string;
    disableButton: string;
    disabling: string;
    lastUpdated: string;
  };
  disable: {
    title: string;
    description: string;
    warning: string;
    confirmButton: string;
    cancelButton: string;
  };
  verify: {
    title: string;
    description: string;
    codeLabel: string;
    codePlaceholder: string;
    verifyButton: string;
    verifying: string;
    rememberDevice: string;
    useBackupCode: string;
    resendCode: string;
  };
  errors: {
    enrollmentFailed: string;
    verificationFailed: string;
    invalidCode: string;
    expiredCode: string;
    tooManyAttempts: string;
    genericError: string;
  };
  success: {
    enabled: string;
    disabled: string;
    verified: string;
  };
}

export const defaultMfaDictionary: MfaDictionary = {
  title: 'Two-Factor Authentication',
  description: 'Add an extra layer of security to your account by requiring a verification code in addition to your password.',
  enable: {
    title: 'Enable 2FA',
    description: 'Protect your account with two-factor authentication',
    button: 'Enable Two-Factor Authentication',
    scanning: 'Setting up...',
  },
  setup: {
    title: 'Set Up Two-Factor Authentication',
    description: 'Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)',
    step1: '1. Download an authenticator app if you don\'t have one',
    step2: '2. Scan the QR code or enter the secret key manually',
    step3: '3. Enter the 6-digit code from your app to verify',
    qrCodeAlt: 'QR Code for Two-Factor Authentication',
    manualEntry: 'Can\'t scan? Enter this code manually:',
    copySecret: 'Copy',
    secretCopied: 'Copied!',
    verificationCode: 'Verification Code',
    verificationPlaceholder: '000000',
    verifyButton: 'Verify and Enable',
    verifying: 'Verifying...',
    cancelButton: 'Cancel',
  },
  enabled: {
    title: '2FA is Enabled',
    description: 'Your account is protected with two-factor authentication',
    disableButton: 'Disable 2FA',
    disabling: 'Disabling...',
    lastUpdated: 'Enabled on',
  },
  disable: {
    title: 'Disable Two-Factor Authentication',
    description: 'Are you sure you want to disable two-factor authentication?',
    warning: 'This will make your account less secure. You will only need your password to sign in.',
    confirmButton: 'Yes, Disable 2FA',
    cancelButton: 'Cancel',
  },
  verify: {
    title: 'Two-Factor Authentication',
    description: 'Enter the 6-digit code from your authenticator app',
    codeLabel: 'Authentication Code',
    codePlaceholder: '000000',
    verifyButton: 'Verify',
    verifying: 'Verifying...',
    rememberDevice: 'Remember this device for 30 days',
    useBackupCode: 'Use backup code instead',
    resendCode: 'Didn\'t receive code?',
  },
  errors: {
    enrollmentFailed: 'Failed to set up two-factor authentication. Please try again.',
    verificationFailed: 'Verification failed. Please check your code and try again.',
    invalidCode: 'Invalid verification code. Please try again.',
    expiredCode: 'The verification code has expired. Please request a new one.',
    tooManyAttempts: 'Too many failed attempts. Please wait a moment and try again.',
    genericError: 'An error occurred. Please try again later.',
  },
  success: {
    enabled: 'Two-factor authentication has been enabled successfully.',
    disabled: 'Two-factor authentication has been disabled.',
    verified: 'Verification successful.',
  },
};
