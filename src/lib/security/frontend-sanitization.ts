/**
 * Frontend Sanitization Utilities
 * Provides comprehensive sanitization for user-generated content and dynamic data
 */

// DOMPurify is browser-only, so we need to handle server-side rendering
let domPurify: any = null;

if (typeof window !== 'undefined') {
  // Only import and configure DOMPurify in the browser
  import('dompurify').then((DOMPurifyModule) => {
    const DOMPurify = DOMPurifyModule.default;
    
    // Configure DOMPurify with strict defaults
    DOMPurify.addHook('uponSanitizeElement', (node: any, data: any) => {
      // Prevent iframes and other dangerous elements
      if (data.tagName === 'iframe' || data.tagName === 'script') {
        return node.parentNode?.removeChild(node);
      }
    });

    DOMPurify.addHook('uponSanitizeAttribute', (node: any, data: any) => {
      // Remove dangerous attributes
      const dangerousAttributes = [
        'onload', 'onerror', 'onclick', 'onmouseover', 'onkeypress',
        'style', 'src', 'href', 'data', 'formaction'
      ];
      
      if (dangerousAttributes.includes(data.attrName.toLowerCase())) {
        return node.removeAttribute(data.attrName);
      }
    });

    domPurify = DOMPurify;
  }).catch(() => {
    // If DOMPurify fails to load, we'll use basic sanitization
    domPurify = null;
  });
}

/**
 * Sanitize HTML content with strict policies
 */
export async function sanitizeHTML(html: string): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side: use basic sanitization
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  }
  
  // Wait for DOMPurify to be available
  if (!domPurify) {
    // If DOMPurify is not loaded yet, wait a short time
    await new Promise(resolve => setTimeout(resolve, 50));
    if (!domPurify) {
      // Still not available, use basic sanitization
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    }
  }
  
  return domPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
    ],
    ALLOWED_ATTR: ['class', 'id', 'title', 'lang', 'dir'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    ADD_ATTR: ['target'], // Allow target attribute for accessibility
    ADD_TAGS: [],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    WHOLE_DOCUMENT: false,
  });
}

/**
 * Sanitize user input for display (prevents XSS)
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize URL to prevent javascript: and data: URLs
 */
export function sanitizeURL(url: string): string {
  if (typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Allow only http, https, mailto, and tel protocols
  const allowedProtocols = /^(https?:|mailto:|tel:)/i;
  
  if (!allowedProtocols.test(trimmed)) {
    return ''; // Reject dangerous protocols
  }
  
  // Additional validation for http/https URLs
  if (trimmed.startsWith('http')) {
    try {
      const urlObj = new URL(trimmed);
      
      // Validate hostname (prevent localhost and internal IPs in production)
      const forbiddenHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '0000:0000:0000:0000:0000:0000:0000:0001'
      ];
      
      if (forbiddenHosts.includes(urlObj.hostname)) {
        return '';
      }
      
      return trimmed;
    } catch {
      return ''; // Invalid URL
    }
  }
  
  return trimmed;
}

/**
 * Sanitize object properties recursively
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: {
    sanitizeStrings?: boolean;
    sanitizeURLs?: boolean;
    maxDepth?: number;
  } = {}
): T {
  const {
    sanitizeStrings = true,
    sanitizeURLs = true,
    maxDepth = 10
  } = options;
  
  const sanitizeRecursive = (current: any, depth: number = 0): any => {
    if (depth > maxDepth) return current; // Prevent circular reference issues
    
    if (typeof current === 'string') {
      if (sanitizeURLs && (current.startsWith('http') || current.startsWith('mailto:') || current.startsWith('tel:'))) {
        return sanitizeURL(current);
      }
      if (sanitizeStrings) {
        return sanitizeUserInput(current);
      }
      return current;
    }
    
    if (Array.isArray(current)) {
      return current.map(item => sanitizeRecursive(item, depth + 1));
    }
    
    if (typeof current === 'object' && current !== null) {
      const sanitized: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(current)) {
        sanitized[key] = sanitizeRecursive(value, depth + 1);
      }
      
      return sanitized;
    }
    
    return current;
  };
  
  return sanitizeRecursive(obj) as T;
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = email.trim().toLowerCase();
  
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Validate and sanitize phone numbers
 */
export function sanitizePhone(phone: string): string {
  // Basic phone number validation - remove all non-digit characters except +
  const sanitized = phone.replace(/[^\d+]/g, '');
  
  // Simple validation - at least 10 digits for most phone numbers
  const digitCount = sanitized.replace(/\D/g, '').length;
  
  return digitCount >= 10 ? sanitized : '';
}

/**
 * Safe HTML template literal tag for embedding dynamic content
 */
export function safeHTML(strings: TemplateStringsArray, ...values: any[]): string {
  let result = strings[0];
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    result += typeof value === 'string' ? sanitizeUserInput(value) : String(value);
    result += strings[i + 1];
  }
  
  return result;
}

/**
 * Component props sanitizer for React components
 */
export function sanitizeProps<T extends Record<string, any>>(props: T): T {
  return sanitizeObject(props, {
    sanitizeStrings: true,
    sanitizeURLs: true,
    maxDepth: 5
  });
}

// Export types
export interface SanitizationOptions {
  sanitizeStrings?: boolean;
  sanitizeURLs?: boolean;
  maxDepth?: number;
}

export interface SanitizationResult<T> {
  sanitized: T;
  hadUnsafeContent: boolean;
}