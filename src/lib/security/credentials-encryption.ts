/**
 * Credentials Encryption Service
 *
 * This module provides AES-256-GCM encryption for sensitive credentials
 * stored in the database (Stripe, PayPal API keys, etc.)
 *
 * Security features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Unique IV (initialization vector) per encryption
 * - Authentication tag to detect tampering
 * - Key derivation from environment variable
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

// Lazy initialization to avoid module-level promisify call
// This prevents issues with Next.js 16 Turbopack when scrypt might not be available during module evaluation
let scryptAsync: ((password: string | Buffer, salt: string | Buffer, keylen: number) => Promise<Buffer>) | null = null;

function getScryptAsync() {
  if (!scryptAsync) {
    scryptAsync = promisify(scrypt) as (password: string | Buffer, salt: string | Buffer, keylen: number) => Promise<Buffer>;
  }
  return scryptAsync;
}

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const _AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Encrypt sensitive data
 *
 * @param plaintext - The data to encrypt
 * @returns Encrypted string in format: salt:iv:authTag:ciphertext (all base64)
 */
export async function encryptCredential(plaintext: string): Promise<string> {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  const encryptionKey = await getEncryptionKey();

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from master key and salt
  const key = await getScryptAsync()(encryptionKey, salt, KEY_LENGTH);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine salt, IV, auth tag, and ciphertext
  const result = [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted,
  ].join(':');

  return result;
}

/**
 * Decrypt sensitive data
 *
 * @param encryptedData - The encrypted string from encryptCredential
 * @returns Decrypted plaintext
 */
export async function decryptCredential(encryptedData: string): Promise<string> {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty string');
  }

  const encryptionKey = await getEncryptionKey();

  // Split the encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltB64, ivB64, authTagB64, ciphertext] = parts;

  // Convert from base64
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  // Derive key from master key and salt
  const key = await getScryptAsync()(encryptionKey, salt, KEY_LENGTH);

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt an object containing credentials
 *
 * @param credentials - Object with credential fields
 * @returns Object with encrypted values
 */
export async function encryptCredentialsObject<T extends Record<string, any>>(
  credentials: T
): Promise<Record<string, string>> {
  const encrypted: Record<string, string> = {};

  for (const [key, value] of Object.entries(credentials)) {
    if (value === null || value === undefined || value === '') {
      encrypted[key] = '';
      continue;
    }

    // Convert value to string and encrypt
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    encrypted[key] = await encryptCredential(stringValue);
  }

  return encrypted;
}

/**
 * Decrypt an object containing encrypted credentials
 *
 * @param encryptedCredentials - Object with encrypted values
 * @returns Object with decrypted values
 */
export async function decryptCredentialsObject<T extends Record<string, any>>(
  encryptedCredentials: Record<string, string>
): Promise<T> {
  const decrypted: Record<string, any> = {};

  for (const [key, value] of Object.entries(encryptedCredentials)) {
    if (value === null || value === undefined || value === '') {
      decrypted[key] = null;
      continue;
    }

    try {
      const decryptedValue = await decryptCredential(value);

      // Try to parse as JSON if it looks like JSON
      if (decryptedValue.startsWith('{') || decryptedValue.startsWith('[')) {
        try {
          decrypted[key] = JSON.parse(decryptedValue);
        } catch {
          decrypted[key] = decryptedValue;
        }
      } else {
        decrypted[key] = decryptedValue;
      }
    } catch (error) {
      console.error(`[Encryption] Failed to decrypt field ${key}:`, error);
      throw new Error(`Failed to decrypt credential field: ${key}`);
    }
  }

  return decrypted as T;
}

/**
 * Get the encryption key from environment
 */
function getEncryptionKey(): string {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Validate key length (should be 64 hex characters = 32 bytes)
  if (key.length !== 64) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY must be 64 hex characters (32 bytes). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  return key;
}

/**
 * Check if a string is encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parts = value.split(':');
  return parts.length === 4;
}

/**
 * Safely decrypt a value that might not be encrypted
 * Returns the original value if it's not encrypted
 */
export async function safeDecrypt(value: string): Promise<string> {
  if (!value) {
    return value;
  }

  if (isEncrypted(value)) {
    try {
      return await decryptCredential(value);
    } catch (error) {
      console.error('[Encryption] Failed to decrypt value:', error);
      throw error;
    }
  }

  // Not encrypted, return as-is
  return value;
}

/**
 * Generate a new encryption key (for initial setup)
 * DO NOT call this in production - use openssl to generate the key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
