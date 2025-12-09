/**
 * URL Sanitizer for Affiliate Customization
 *
 * Validates and sanitizes URLs for affiliate store customization (banners, logos)
 * to prevent XSS, SSRF, and other injection attacks.
 */

export interface URLValidationResult {
  isValid: boolean;
  sanitizedUrl: string | null;
  error?: string;
}

/**
 * Allowed URL schemes for affiliate customization
 */
const ALLOWED_SCHEMES = ['https:', 'http:'] as const;

/**
 * Allowed domains for affiliate customization images
 * Only allow Supabase storage and trusted CDNs
 */
const ALLOWED_DOMAINS = [
  // Supabase storage
  /^[a-z0-9-]+\.supabase\.co$/i,

  // Production domain
  /^(www\.)?purvitahealth\.com$/i,

  // Vercel blob storage (if used)
  /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i,

  // Cloudinary (if used)
  /^res\.cloudinary\.com$/i,
] as const;

/**
 * Dangerous patterns that should never be in a URL
 */
const DANGEROUS_PATTERNS = [
  // JavaScript protocol
  /javascript:/i,

  // Data URIs (can contain malicious code)
  /^data:/i,

  // File protocol (local file access)
  /^file:/i,

  // Blob URLs (can be used for XSS)
  /^blob:/i,

  // vbscript protocol
  /vbscript:/i,

  // HTML entities that could be decoded
  /&#|%3C|%3E|%22|%27/i,
] as const;

/**
 * Validate and sanitize a URL for affiliate customization
 *
 * @param url - URL to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result with sanitized URL or error
 */
export function validateAffiliateCustomizationURL(
  url: string | null | undefined,
  fieldName: string = 'URL'
): URLValidationResult {
  // Allow null/empty URLs
  if (!url || url.trim() === '') {
    return {
      isValid: true,
      sanitizedUrl: null,
    };
  }

  const trimmedUrl = url.trim();

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmedUrl)) {
      return {
        isValid: false,
        sanitizedUrl: null,
        error: `${fieldName} contains dangerous pattern: ${pattern.source}`,
      };
    }
  }

  // Try to parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return {
      isValid: false,
      sanitizedUrl: null,
      error: `${fieldName} is not a valid URL`,
    };
  }

  // Check protocol
  if (!ALLOWED_SCHEMES.includes(parsedUrl.protocol as any)) {
    return {
      isValid: false,
      sanitizedUrl: null,
      error: `${fieldName} must use HTTPS or HTTP protocol`,
    };
  }

  // Prefer HTTPS
  if (parsedUrl.protocol === 'http:' && process.env.NODE_ENV === 'production') {
    return {
      isValid: false,
      sanitizedUrl: null,
      error: `${fieldName} must use HTTPS in production`,
    };
  }

  // Check domain against whitelist
  const hostname = parsedUrl.hostname.toLowerCase();
  const isDomainAllowed = ALLOWED_DOMAINS.some(pattern => pattern.test(hostname));

  if (!isDomainAllowed) {
    return {
      isValid: false,
      sanitizedUrl: null,
      error: `${fieldName} domain is not allowed. Only Supabase storage and trusted CDNs are permitted.`,
    };
  }

  // Additional security checks
  // No username/password in URL
  if (parsedUrl.username || parsedUrl.password) {
    return {
      isValid: false,
      sanitizedUrl: null,
      error: `${fieldName} cannot contain credentials`,
    };
  }

  // No suspicious query parameters
  const suspiciousParams = ['callback', 'redirect', 'url', 'return', 'next'];
  for (const param of suspiciousParams) {
    if (parsedUrl.searchParams.has(param)) {
      return {
        isValid: false,
        sanitizedUrl: null,
        error: `${fieldName} contains suspicious query parameter: ${param}`,
      };
    }
  }

  // Return sanitized URL (normalized)
  return {
    isValid: true,
    sanitizedUrl: parsedUrl.toString(),
  };
}

/**
 * Validate affiliate store customization object
 *
 * @param customization - Customization object to validate
 * @returns Validation result with sanitized customization or errors
 */
export function validateAffiliateCustomization(customization: {
  storeTitle?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
}): {
  isValid: boolean;
  sanitized: typeof customization;
  errors: string[];
} {
  const errors: string[] = [];
  const sanitized = { ...customization };

  // Validate banner URL
  if (customization.bannerUrl) {
    const bannerValidation = validateAffiliateCustomizationURL(
      customization.bannerUrl,
      'Banner URL'
    );

    if (!bannerValidation.isValid) {
      errors.push(bannerValidation.error || 'Invalid banner URL');
      sanitized.bannerUrl = null;
    } else {
      sanitized.bannerUrl = bannerValidation.sanitizedUrl;
    }
  }

  // Validate logo URL
  if (customization.logoUrl) {
    const logoValidation = validateAffiliateCustomizationURL(
      customization.logoUrl,
      'Logo URL'
    );

    if (!logoValidation.isValid) {
      errors.push(logoValidation.error || 'Invalid logo URL');
      sanitized.logoUrl = null;
    } else {
      sanitized.logoUrl = logoValidation.sanitizedUrl;
    }
  }

  // Validate store title (basic XSS prevention)
  if (customization.storeTitle) {
    const title = customization.storeTitle.trim();

    // Max length check
    if (title.length > 100) {
      errors.push('Store title is too long (max 100 characters)');
      sanitized.storeTitle = title.substring(0, 100);
    }

    // Check for HTML/Script tags
    if (/<script|<iframe|javascript:|onerror=|onload=/i.test(title)) {
      errors.push('Store title contains dangerous content');
      sanitized.storeTitle = title.replace(/<[^>]*>/g, '');
    }
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}
