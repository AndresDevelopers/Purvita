/**
 * URL Validation and Sanitization
 * 
 * Validates and sanitizes URLs to prevent XSS attacks and malicious redirects.
 * Used for user-provided URLs like banners, logos, and external links.
 */

/**
 * Allowed protocols for URLs
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Allowed domains for image URLs (whitelist)
 * Add your trusted domains here
 */
const ALLOWED_IMAGE_DOMAINS = [
  'supabase.co',
  'images.unsplash.com',
  'picsum.photos',
  'placehold.co',
  'purvitahealth.com',
  'www.purvitahealth.com',
];

/**
 * Validates if a URL is safe to use
 * 
 * @param url - URL to validate
 * @param allowedDomains - Optional array of allowed domains (defaults to ALLOWED_IMAGE_DOMAINS)
 * @returns true if URL is valid and safe
 */
export function isValidUrl(url: string, allowedDomains: string[] = ALLOWED_IMAGE_DOMAINS): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Remove whitespace
  const trimmedUrl = url.trim();

  // Check for javascript: protocol and other dangerous patterns
  const dangerousPatterns = [
    /^javascript:/i,
    /^data:/i,
    /^vbscript:/i,
    /^file:/i,
    /^about:/i,
    /<script/i,
    /onerror=/i,
    /onload=/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmedUrl)) {
      return false;
    }
  }

  try {
    const urlObj = new URL(trimmedUrl);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return false;
    }

    // Check domain whitelist
    const hostname = urlObj.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(domain => {
      // Support wildcard subdomains (e.g., *.supabase.co)
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return hostname.endsWith(baseDomain);
      }
      return hostname === domain || hostname.endsWith('.' + domain);
    });

    return isAllowed;
  } catch (_error) {
    // Invalid URL format
    return false;
  }
}

/**
 * Validates and sanitizes a URL
 * 
 * @param url - URL to validate and sanitize
 * @param allowedDomains - Optional array of allowed domains
 * @returns Sanitized URL or null if invalid
 */
export function validateAndSanitizeUrl(url: string, allowedDomains?: string[]): string | null {
  if (!isValidUrl(url, allowedDomains)) {
    return null;
  }

  try {
    const urlObj = new URL(url.trim());

    // Reconstruct URL to remove any potential XSS in fragments or query params
    // Only keep protocol, hostname, port, and pathname
    const sanitized = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

    return sanitized;
  } catch (_error) {
    return null;
  }
}

/**
 * Validates an image URL specifically
 * 
 * @param url - Image URL to validate
 * @returns true if URL is valid for images
 */
export function isValidImageUrl(url: string): boolean {
  if (!isValidUrl(url, ALLOWED_IMAGE_DOMAINS)) {
    return false;
  }

  // Check for common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
  const lowerUrl = url.toLowerCase();
  
  // Allow URLs without extension (e.g., Supabase Storage URLs with tokens)
  // or URLs with valid image extensions
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('supabase.co/storage/');
}

/**
 * Validates a banner URL for affiliate stores
 * 
 * @param url - Banner URL to validate
 * @returns Validation result with sanitized URL or error
 */
export function validateBannerUrl(url: string): { valid: boolean; sanitized: string | null; error?: string } {
  if (!url) {
    return { valid: true, sanitized: null }; // Banner is optional
  }

  if (!isValidImageUrl(url)) {
    return {
      valid: false,
      sanitized: null,
      error: 'Invalid banner URL. Only images from trusted domains are allowed.',
    };
  }

  const sanitized = validateAndSanitizeUrl(url, ALLOWED_IMAGE_DOMAINS);
  
  if (!sanitized) {
    return {
      valid: false,
      sanitized: null,
      error: 'Failed to sanitize banner URL.',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validates a logo URL for affiliate stores
 * 
 * @param url - Logo URL to validate
 * @returns Validation result with sanitized URL or error
 */
export function validateLogoUrl(url: string): { valid: boolean; sanitized: string | null; error?: string } {
  if (!url) {
    return { valid: true, sanitized: null }; // Logo is optional
  }

  if (!isValidImageUrl(url)) {
    return {
      valid: false,
      sanitized: null,
      error: 'Invalid logo URL. Only images from trusted domains are allowed.',
    };
  }

  const sanitized = validateAndSanitizeUrl(url, ALLOWED_IMAGE_DOMAINS);
  
  if (!sanitized) {
    return {
      valid: false,
      sanitized: null,
      error: 'Failed to sanitize logo URL.',
    };
  }

  return { valid: true, sanitized };
}

