/**
 * @fileoverview IP Address Utilities
 * 
 * Provides utilities for extracting and validating IP addresses from requests.
 * Used across the application for security, geolocation, and audit logging.
 */

/**
 * Extracts client IP address from request headers
 * Tries common proxy headers in order of reliability
 * 
 * @param request - The incoming request
 * @returns The client IP address or null if not found
 */
export function getClientIP(request: Request): string | null {
  // Try common proxy headers in order of reliability
  const ipHeaders = [
    'x-client-ip',
    'x-forwarded-for',
    'cf-connecting-ip',
    'true-client-ip',
    'x-real-ip',
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded',
  ];

  for (const header of ipHeaders) {
    const value = request.headers.get(header);
    if (value) {
      // Handle X-Forwarded-For format: client, proxy1, proxy2
      const ips = value.split(',').map(ip => ip.trim());
      return ips[0]; // Return the first (client) IP
    }
  }

  // Fallback to socket address if available
  const socketAddress = (request as { ip?: string }).ip;
  if (socketAddress) {
    return socketAddress;
  }

  return null;
}

/**
 * Validates if a string is a valid IP address (IPv4 or IPv6)
 * 
 * @param ip - The IP address to validate
 * @returns True if valid IP address
 */
export function isValidIP(ip: string): boolean {
  if (!ip) return false;

  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 validation (basic)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * Checks if an IP address is a private/local IP
 * 
 * @param ip - The IP address to check
 * @returns True if the IP is private/local
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return false;

  // Localhost
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') {
    return true;
  }

  // Private IPv4 ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Cleans an IP address by removing CIDR notation and extra whitespace
 * 
 * @param ip - The IP address to clean
 * @returns Cleaned IP address or null if invalid
 */
export function cleanIPAddress(ip: string | null | undefined): string | null {
  if (!ip) return null;

  // Remove whitespace
  let cleaned = ip.trim();

  // Remove CIDR notation (e.g., "192.168.1.1/24" -> "192.168.1.1")
  if (cleaned.includes('/')) {
    cleaned = cleaned.split('/')[0];
  }

  return cleaned || null;
}

