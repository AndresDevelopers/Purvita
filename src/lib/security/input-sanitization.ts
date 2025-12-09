/**
 * Input Sanitization Utilities
 * 
 * Provides robust input sanitization to prevent XSS attacks
 * Uses DOMPurify for HTML sanitization
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML input - removes all HTML tags and keeps only text
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // No permitir ningún HTML
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true // Mantener el texto, remover tags
  });
}

/**
 * Sanitize rich text - allows safe HTML tags for formatting
 */
export function sanitizeRichText(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//,
    ADD_ATTR: ['target'], // Allow target attribute
    FORBID_ATTR: ['style', 'class', 'id'], // Forbid styling attributes
  });
}

/**
 * Sanitize basic text input - trims and removes HTML
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return sanitizeHtml(input.trim());
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Remove whitespace and convert to lowercase
  return email.trim().toLowerCase();
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();

  // Only allow http and https protocols
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize phone number - removes non-numeric characters except + and spaces
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  return phone.replace(/[^\d+\s()-]/g, '').trim();
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: string | number): number | null {
  if (typeof input === 'number') {
    return isFinite(input) ? input : null;
  }

  if (typeof input !== 'string') {
    return null;
  }

  const cleaned = input.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);

  return isFinite(parsed) ? parsed : null;
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(input: string | number): number | null {
  const num = sanitizeNumber(input);
  return num !== null ? Math.floor(num) : null;
}

/**
 * Sanitize object by applying sanitization to all string values
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: {
    allowRichText?: string[]; // Fields that allow rich text
    skipFields?: string[]; // Fields to skip sanitization
  } = {}
): T {
  const { allowRichText = [], skipFields = [] } = options;

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip if in skipFields
    if (skipFields.includes(key)) {
      sanitized[key] = value;
      continue;
    }

    // Sanitize based on type
    if (typeof value === 'string') {
      if (allowRichText.includes(key)) {
        sanitized[key] = sanitizeRichText(value);
      } else {
        sanitized[key] = sanitizeInput(value);
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value, options);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
