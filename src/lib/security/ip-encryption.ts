/**
 * @fileoverview IP Address Encryption Service
 * 
 * Encrypts IP addresses before storing in audit logs to protect user privacy.
 * Uses AES-256-GCM encryption with the same infrastructure as payment credentials.
 * 
 * Privacy Benefits:
 * - Protects user location data
 * - Complies with GDPR/CCPA privacy requirements
 * - Prevents unauthorized IP tracking
 * - Maintains audit trail integrity while protecting PII
 * 
 * @example
 * ```typescript
 * import { encryptIP, decryptIP } from '@/lib/security/ip-encryption';
 * 
 * // Encrypt before storing
 * const encrypted = await encryptIP('192.168.1.1');
 * 
 * // Decrypt when needed (admin only)
 * const original = await decryptIP(encrypted);
 * ```
 */

import { encryptCredential, decryptCredential } from './credentials-encryption';

/**
 * Encrypts an IP address for storage in audit logs
 * 
 * @param ipAddress - The IP address to encrypt (IPv4 or IPv6)
 * @returns Encrypted IP address string in format: salt:iv:authTag:ciphertext (base64)
 * @throws Error if encryption fails or CREDENTIALS_ENCRYPTION_KEY is not set
 * 
 * @example
 * ```typescript
 * const encrypted = await encryptIP('192.168.1.1');
 * // Returns: "abc123...:def456...:ghi789...:jkl012..."
 * ```
 */
export async function encryptIP(ipAddress: string | null | undefined): Promise<string | null> {
  // Handle null/undefined cases
  if (!ipAddress) {
    return null;
  }

  // Clean IP address (remove CIDR notation if present)
  const cleanedIP = cleanIPAddress(ipAddress);

  if (!cleanedIP) {
    console.warn(`[IP Encryption] Invalid IP format: ${ipAddress}`);
    return null;
  }

  // Validate IP format (basic validation)
  if (!isValidIP(cleanedIP)) {
    console.warn(`[IP Encryption] Invalid IP format after cleaning: ${cleanedIP}`);
    return null;
  }

  try {
    const encrypted = await encryptCredential(cleanedIP);
    return encrypted;
  } catch (error) {
    console.error('[IP Encryption] Failed to encrypt IP address:', error);
    // Return null instead of throwing to prevent audit log failures
    return null;
  }
}

/**
 * Decrypts an encrypted IP address from audit logs
 * 
 * @param encryptedIP - The encrypted IP address string
 * @returns Decrypted IP address or null if decryption fails
 * 
 * @example
 * ```typescript
 * const decrypted = await decryptIP('abc123...:def456...:ghi789...:jkl012...');
 * // Returns: "192.168.1.1"
 * ```
 */
export async function decryptIP(encryptedIP: string | null | undefined): Promise<string | null> {
  // Handle null/undefined cases
  if (!encryptedIP) {
    return null;
  }

  try {
    const decrypted = await decryptCredential(encryptedIP);
    return decrypted;
  } catch (error) {
    console.error('[IP Decryption] Failed to decrypt IP address:', error);
    return null;
  }
}

/**
 * Cleans IP address by removing CIDR notation and whitespace
 *
 * @param ip - IP address to clean (may include CIDR notation like /32)
 * @returns Cleaned IP address or null if invalid
 */
function cleanIPAddress(ip: string): string | null {
  if (!ip || typeof ip !== 'string') {
    return null;
  }

  // Trim whitespace
  let cleaned = ip.trim();

  // Remove CIDR notation (e.g., "192.168.1.1/32" -> "192.168.1.1")
  if (cleaned.includes('/')) {
    cleaned = cleaned.split('/')[0];
  }

  return cleaned || null;
}

/**
 * Validates IP address format (IPv4 or IPv6)
 *
 * @param ip - IP address to validate
 * @returns true if valid IPv4 or IPv6 format
 */
function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

  // IPv6 regex (simplified - covers most cases)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  // Check for localhost/special cases
  if (ip === 'localhost' || ip === '::1' || ip === '127.0.0.1') {
    return true;
  }

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Anonymizes an IP address by masking the last octet (IPv4) or last segments (IPv6)
 * This is useful for analytics while preserving some privacy
 * 
 * @param ipAddress - The IP address to anonymize
 * @returns Anonymized IP address (e.g., "192.168.1.xxx" or "2001:db8::xxx")
 * 
 * @example
 * ```typescript
 * anonymizeIP('192.168.1.100'); // Returns: "192.168.1.xxx"
 * anonymizeIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334'); // Returns: "2001:db8:85a3::xxx"
 * ```
 */
export function anonymizeIP(ipAddress: string | null | undefined): string | null {
  if (!ipAddress) {
    return null;
  }

  // IPv4 anonymization
  if (ipAddress.includes('.')) {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }

  // IPv6 anonymization
  if (ipAddress.includes(':')) {
    const parts = ipAddress.split(':');
    if (parts.length >= 3) {
      return `${parts[0]}:${parts[1]}:${parts[2]}::xxx`;
    }
  }

  return ipAddress;
}

/**
 * Batch encrypt multiple IP addresses
 * Useful for migrating existing audit logs
 * 
 * @param ipAddresses - Array of IP addresses to encrypt
 * @returns Array of encrypted IP addresses (null for failed encryptions)
 */
export async function batchEncryptIPs(
  ipAddresses: (string | null | undefined)[]
): Promise<(string | null)[]> {
  const results = await Promise.allSettled(
    ipAddresses.map(ip => encryptIP(ip))
  );

  return results.map(result => 
    result.status === 'fulfilled' ? result.value : null
  );
}

/**
 * Batch decrypt multiple IP addresses
 * Useful for admin dashboards showing audit logs
 * 
 * @param encryptedIPs - Array of encrypted IP addresses
 * @returns Array of decrypted IP addresses (null for failed decryptions)
 */
export async function batchDecryptIPs(
  encryptedIPs: (string | null | undefined)[]
): Promise<(string | null)[]> {
  const results = await Promise.allSettled(
    encryptedIPs.map(ip => decryptIP(ip))
  );

  return results.map(result => 
    result.status === 'fulfilled' ? result.value : null
  );
}

