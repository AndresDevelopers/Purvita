/**
 * Referral Code Validation
 * 
 * Validates and sanitizes referral codes to prevent injection attacks
 * and ensure data integrity.
 */

import { sanitizeUserInput } from './frontend-sanitization';

/**
 * Regex pattern for valid referral codes
 * - Allows: alphanumeric, underscore, hyphen
 * - Length: 3-50 characters
 */
const REFERRAL_CODE_REGEX = /^[a-zA-Z0-9_-]{3,50}$/;

/**
 * Validates a referral code format
 * 
 * @param code - The referral code to validate
 * @returns True if valid, false otherwise
 */
export function isValidReferralCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  return REFERRAL_CODE_REGEX.test(code);
}

/**
 * Validates and sanitizes a referral code
 * 
 * @param code - The referral code to validate
 * @returns Sanitized referral code
 * @throws Error if the code is invalid
 */
export function validateReferralCode(code: string): string {
  // Sanitize input first
  const sanitized = sanitizeUserInput(code).trim();
  
  // Validate format
  if (!isValidReferralCode(sanitized)) {
    throw new Error('Invalid referral code format. Only alphanumeric characters, underscores, and hyphens are allowed (3-50 characters).');
  }
  
  return sanitized;
}

/**
 * Validates a referral code without throwing
 * 
 * @param code - The referral code to validate
 * @returns Object with validation result and sanitized code
 */
export function safeValidateReferralCode(code: string): {
  isValid: boolean;
  sanitized: string | null;
  error: string | null;
} {
  try {
    const sanitized = validateReferralCode(code);
    return {
      isValid: true,
      sanitized,
      error: null,
    };
  } catch (error) {
    return {
      isValid: false,
      sanitized: null,
      error: error instanceof Error ? error.message : 'Invalid referral code',
    };
  }
}

