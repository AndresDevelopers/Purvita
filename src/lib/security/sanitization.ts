import DOMPurify from 'dompurify'

/**
 * HTML Sanitization Service using DOMPurify
 *
 * Provides safe HTML sanitization to prevent XSS attacks
 * Works in both browser and server environments (with jsdom)
 */

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  /** Allow specific HTML tags (default: safe subset) */
  allowedTags?: string[]
  /** Allow specific attributes (default: safe subset) */
  allowedAttributes?: Record<string, string[]>
  /** Allow data URIs (default: false) */
  allowDataUri?: boolean
  /** Return as DOM instead of string (client-side only) */
  returnDom?: boolean
}

/**
 * Default safe HTML tags
 */
const DEFAULT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'blockquote',
  'code',
  'pre',
  'span',
  'div',
]

/**
 * Default safe HTML attributes
 */
const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['class', 'id'],
}

/**
 * Creates a DOMPurify instance for server-side use
 */
function getServerDOMPurify() {
  if (typeof window !== 'undefined') {
    return DOMPurify
  }

  // Server-side: use jsdom
   
  const { JSDOM } = require('jsdom')
  const jsdomWindow = new JSDOM('').window
  return DOMPurify(jsdomWindow)
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 *
 * @param dirty - Untrusted HTML string
 * @param options - Sanitization options
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(dirty: string, options: SanitizeOptions = {}): string {
  if (!dirty) {
    return ''
  }

  try {
    const purify = typeof window !== 'undefined' ? DOMPurify : getServerDOMPurify()

    const config = {
      ALLOWED_TAGS: options.allowedTags || DEFAULT_ALLOWED_TAGS,
      ALLOWED_ATTR: options.allowedAttributes
        ? Object.entries(options.allowedAttributes).flatMap(([tag, attrs]) =>
            attrs.map((attr) => (tag === '*' ? attr : `${tag}:${attr}`))
          )
        : Object.entries(DEFAULT_ALLOWED_ATTRIBUTES).flatMap(([tag, attrs]) =>
            attrs.map((attr) => (tag === '*' ? attr : `${tag}:${attr}`))
          ),
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: true,
    }

    const clean = purify.sanitize(dirty, config)

    return typeof clean === 'string' ? clean : ''
  } catch (error) {
    console.error('HTML sanitization error:', error)
    // Return empty string on error for safety
    return ''
  }
}

/**
 * Sanitizes plain text by escaping HTML entities
 * Use this for user input that should not contain any HTML
 *
 * Security features:
 * - Escapes HTML special characters
 * - Decodes Unicode escapes before sanitizing (\u003c, \x3c)
 * - Escapes template literal syntax (${})
 * - Removes dangerous URL schemes from text (javascript:, data:, vbscript:)
 * - Handles UTF-7 encoded content
 *
 * @param text - Untrusted text
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  if (!text) {
    return ''
  }

  let decoded = text;

  // 1. Decode Unicode escapes (\uXXXX, \xXX) to prevent bypass
  try {
    decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    decoded = decoded.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  } catch (_e) {
    // If decoding fails, continue with original
  }

  // 2. Remove UTF-7 encoded content (legacy encoding, rarely used)
  // UTF-7 uses +ADw- for < and +AD4- for >
  if (decoded.includes('+AD') || decoded.includes('+AF')) {
    // Replace common UTF-7 patterns with safe text
    decoded = decoded.replace(/\+AD[a-zA-Z0-9]+-?/g, '[removed-utf7]');
    decoded = decoded.replace(/\+AF[a-zA-Z0-9]+-?/g, '[removed-utf7]');
  }

  // 3. Remove dangerous URL schemes (javascript:, data:, vbscript:)
  // This prevents these schemes in hash fragments (#javascript:) or text
  const dangerousSchemes = /(?:javascript|data|vbscript):/gi;
  decoded = decoded.replace(dangerousSchemes, 'blocked:');

  // 4. Escape template literal syntax to prevent template injection
  decoded = decoded.replace(/\$\{/g, '\\${');

  // 5. Escape HTML special characters
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }

  return decoded.replace(/[&<>"'/]/g, (char) => map[char] || char)
}

/**
 * Sanitizes URL to prevent javascript: and data: URIs
 *
 * @param url - Untrusted URL
 * @returns Safe URL or empty string
 */
export function sanitizeUrl(url: string): string {
  if (!url) {
    return ''
  }

  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']

  if (dangerousProtocols.some((protocol) => trimmed.startsWith(protocol))) {
    return ''
  }

  // Allow only http, https, mailto, and relative URLs
  const safeProtocols = ['http://', 'https://', 'mailto:', '//', '/']

  const isSafe =
    safeProtocols.some((protocol) => trimmed.startsWith(protocol)) ||
    !trimmed.includes(':') // Relative URLs without protocol

  return isSafe ? url : ''
}

/**
 * Sanitizes object values recursively
 * Useful for sanitizing form data or API responses
 *
 * @param obj - Object with potentially unsafe values
 * @param options - Sanitization options
 * @returns Object with sanitized values
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: SanitizeOptions = {}
): T {
  const sanitized = {} as T

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeHtml(value, options) as T[keyof T]
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map((item) =>
        typeof item === 'string' ? sanitizeHtml(item, options) : item
      ) as T[keyof T]
    } else if (value && typeof value === 'object') {
      sanitized[key as keyof T] = sanitizeObject(value, options) as T[keyof T]
    } else {
      sanitized[key as keyof T] = value
    }
  }

  return sanitized
}

/**
 * Strips all HTML tags from a string
 * Useful for creating plain text versions
 *
 * @param html - HTML string
 * @returns Plain text without tags
 */
export function stripHtml(html: string): string {
  if (!html) {
    return ''
  }

  try {
    const purify = typeof window !== 'undefined' ? DOMPurify : getServerDOMPurify()
    const clean = purify.sanitize(html, { ALLOWED_TAGS: [] })
    return typeof clean === 'string' ? clean.trim() : ''
  } catch (error) {
    console.error('HTML stripping error:', error)
    return ''
  }
}

