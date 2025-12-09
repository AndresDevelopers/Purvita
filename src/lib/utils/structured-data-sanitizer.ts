/**
 * Structured Data Sanitizer
 * 
 * Sanitizes JSON-LD structured data to prevent XSS attacks
 * through script injection in structured data.
 * 
 * @see docs/security-audit-2025.md
 */

/**
 * Sanitize a value for use in JSON-LD structured data
 * 
 * @param value - Value to sanitize
 * @returns Sanitized value
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Remove any script tags or dangerous content
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
      .trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

/**
 * Sanitize JSON-LD structured data object
 * 
 * @param data - Structured data object
 * @returns Sanitized structured data
 * 
 * @example
 * ```typescript
 * const sanitized = sanitizeStructuredData({
 *   "@context": "https://schema.org",
 *   "@type": "Product",
 *   "name": "Product Name <script>alert('xss')</script>",
 *   "description": "Description"
 * });
 * // Returns: { "@context": "https://schema.org", "@type": "Product", "name": "Product Name", "description": "Description" }
 * ```
 */
export function sanitizeStructuredData<T extends Record<string, unknown>>(data: T): T {
  return sanitizeValue(data) as T;
}

/**
 * Validate and sanitize JSON-LD structured data
 * 
 * @param data - Structured data object
 * @returns Sanitized and validated structured data
 * @throws Error if data is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   const validated = validateAndSanitizeStructuredData({
 *     "@context": "https://schema.org",
 *     "@type": "Product",
 *     "name": "Product Name"
 *   });
 * } catch (error) {
 *   console.error('Invalid structured data:', error);
 * }
 * ```
 */
export function validateAndSanitizeStructuredData<T extends Record<string, unknown>>(data: T): T {
  // Validate required fields
  if (!data['@context']) {
    throw new Error('Structured data must have @context');
  }

  if (!data['@type']) {
    throw new Error('Structured data must have @type');
  }

  // Sanitize the data
  return sanitizeStructuredData(data);
}

/**
 * Convert structured data to safe JSON string
 * 
 * @param data - Structured data object
 * @returns Safe JSON string for use in script tags
 * 
 * @example
 * ```typescript
 * const jsonString = structuredDataToSafeJSON({
 *   "@context": "https://schema.org",
 *   "@type": "Product",
 *   "name": "Product Name"
 * });
 * 
 * // Use in component:
 * <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonString }} />
 * ```
 */
export function structuredDataToSafeJSON<T extends Record<string, unknown>>(data: T): string {
  const sanitized = validateAndSanitizeStructuredData(data);
  
  // Convert to JSON and escape dangerous characters
  return JSON.stringify(sanitized)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

