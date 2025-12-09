import { timingSafeEqual } from 'crypto';

/**
 * Cryptographic utilities for secure operations
 */

/**
 * Performs a timing-safe comparison of two strings
 * Prevents timing attacks by ensuring comparison takes constant time
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = safeCompare(providedToken, expectedToken);
 * if (!isValid) {
 *   throw new Error('Invalid token');
 * }
 * ```
 */
export function safeCompare(a: string, b: string): boolean {
  // Early return if lengths differ (this is safe to leak)
  if (a.length !== b.length) {
    return false;
  }

  try {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    return timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    // If any error occurs during comparison, return false
    console.error('[safeCompare] Error during comparison:', error);
    return false;
  }
}

/**
 * Performs a timing-safe comparison of two buffers
 * 
 * @param a - First buffer to compare
 * @param b - Second buffer to compare
 * @returns true if buffers are equal, false otherwise
 */
export function safeCompareBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    return timingSafeEqual(a, b);
  } catch (error) {
    console.error('[safeCompareBuffers] Error during comparison:', error);
    return false;
  }
}

/**
 * Generates a cryptographically secure random string
 * 
 * @param length - Length of the random string (default: 32)
 * @returns Random hex string
 */
export function generateSecureToken(length: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validates that a string is a valid hex string of specified length
 * 
 * @param value - String to validate
 * @param expectedLength - Expected length in characters (not bytes)
 * @returns true if valid hex string of correct length
 */
export function isValidHexString(value: string, expectedLength?: number): boolean {
  const hexRegex = /^[0-9a-fA-F]+$/;
  
  if (!hexRegex.test(value)) {
    return false;
  }

  if (expectedLength !== undefined && value.length !== expectedLength) {
    return false;
  }

  return true;
}

/**
 * Validates encryption key format
 * Ensures key is 64 hex characters (32 bytes)
 * 
 * @param key - Encryption key to validate
 * @returns true if valid encryption key format
 */
export function isValidEncryptionKey(key: string): boolean {
  return isValidHexString(key, 64);
}

