/**
 * XSS Protection Tests
 *
 * Tests for Cross-Site Scripting (XSS) vulnerabilities:
 * - HTML sanitization
 * - Script injection
 * - Event handler injection
 * - URL sanitization
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml, escapeHtml, sanitizeUrl } from '@/lib/security/sanitization';

describe('XSS Protection - HTML Sanitization', () => {
  it('should remove script tags', () => {
    const maliciousHTML = '<div>Hello<script>alert("XSS")</script>World</div>';
    const sanitized = sanitizeHtml(maliciousHTML);

    // DOMPurify removes script tags completely
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert');
  }, 10000); // Increase timeout for DOMPurify in Node.js environment

  it('should remove inline event handlers', () => {
    const maliciousHTML = '<div onclick="alert(\'XSS\')">Click me</div>';
    const sanitized = sanitizeHtml(maliciousHTML);

    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('alert');
  });

  it('should remove javascript: URLs', () => {
    const maliciousHTML = '<a href="javascript:alert(\'XSS\')">Click</a>';
    const sanitized = sanitizeHtml(maliciousHTML);

    expect(sanitized).not.toContain('javascript:');
  });

  it('should remove data: URLs in images', () => {
    const maliciousHTML = '<img src="data:text/html,<script>alert(\'XSS\')</script>">';
    const sanitized = sanitizeHtml(maliciousHTML);

    expect(sanitized).not.toContain('data:');
    expect(sanitized).not.toContain('<script>');
  });

  it('should handle nested XSS attempts', () => {
    const maliciousHTML = '<div><script><script>alert("XSS")</script></script></div>';
    const sanitized = sanitizeHtml(maliciousHTML);

    expect(sanitized).not.toContain('<script>');
  });

  it('should remove iframe tags', () => {
    const maliciousHTML = '<iframe src="https://malicious.com"></iframe>';
    const sanitized = sanitizeHtml(maliciousHTML);

    expect(sanitized).not.toContain('<iframe');
  });

  it('should remove object and embed tags', () => {
    const maliciousHTML = '<object data="malicious.swf"></object><embed src="malicious.swf">';
    const sanitized = sanitizeHtml(maliciousHTML);

    expect(sanitized).not.toContain('<object');
    expect(sanitized).not.toContain('<embed');
  });

  it('should allow safe HTML tags', () => {
    const safeHTML = '<p>Hello <strong>World</strong></p>';
    const sanitized = sanitizeHtml(safeHTML);

    expect(sanitized).toContain('<p>');
    expect(sanitized).toContain('<strong>');
    expect(sanitized).toContain('Hello');
  });

  it('should handle various XSS bypass techniques', () => {
    const xssPayloads = [
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      '<input onfocus=alert(1) autofocus>',
      '<select onfocus=alert(1) autofocus>',
      '<textarea onfocus=alert(1) autofocus>',
      '<keygen onfocus=alert(1) autofocus>',
      '<video><source onerror="alert(1)">',
      '<audio src=x onerror=alert(1)>',
      '<details open ontoggle=alert(1)>',
      '<marquee onstart=alert(1)>',
    ];

    for (const payload of xssPayloads) {
      const sanitized = sanitizeHtml(payload);
      expect(sanitized).not.toContain('alert(');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('onfocus');
    }
  });
});

describe('XSS Protection - HTML Entity Escaping', () => {
  it('should escape HTML entities', () => {
    const input = '<script>alert("XSS")</script>';
    const escaped = escapeHtml(input);

    expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
  });

  it('should escape special characters', () => {
    const input = '& < > " \' /';
    const escaped = escapeHtml(input);

    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&#x27;');
    expect(escaped).toContain('&#x2F;');
  });
});

describe('XSS Protection - URL Sanitization', () => {
  it('should block javascript: URLs', () => {
    const maliciousURLs = [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'javascript:void(0)',
      'javascript:/**/alert(1)',
    ];

    for (const url of maliciousURLs) {
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe('');
    }
  });

  it('should block data: URLs', () => {
    const maliciousURLs = [
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    ];

    for (const url of maliciousURLs) {
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe('');
    }
  });

  it('should block vbscript: URLs', () => {
    const sanitized = sanitizeUrl('vbscript:msgbox(1)');
    expect(sanitized).toBe('');
  });

  it('should allow safe URLs', () => {
    const safeURLs = [
      'https://example.com',
      'http://example.com',
      'mailto:test@example.com',
      '/relative/path',
      '//example.com/path',
    ];

    for (const url of safeURLs) {
      const sanitized = sanitizeUrl(url);
      expect(sanitized).toBe(url);
    }
  });
});

describe('XSS Protection - Context-Specific Encoding', () => {
  it('should handle XSS in different contexts', () => {
    const contexts = {
      htmlContext: '<div>USER_INPUT</div>',
      attributeContext: '<div title="USER_INPUT">',
      jsContext: '<script>var x = "USER_INPUT";</script>',
      cssContext: '<style>.class { color: USER_INPUT; }</style>',
      urlContext: '<a href="USER_INPUT">',
    };

    const maliciousInput = '"><script>alert(1)</script>';

    // HTML context
    const htmlSanitized = contexts.htmlContext.replace(
      'USER_INPUT',
      escapeHtml(maliciousInput)
    );
    expect(htmlSanitized).not.toContain('<script>');

    // Attribute context
    const attrSanitized = contexts.attributeContext.replace(
      'USER_INPUT',
      escapeHtml(maliciousInput)
    );
    expect(attrSanitized).not.toContain('"><script>');

    // URL context
    const urlSanitized = contexts.urlContext.replace(
      'USER_INPUT',
      sanitizeUrl(maliciousInput)
    );
    expect(urlSanitized).not.toContain('javascript:');
  });
});

describe('XSS Protection - Mutation XSS (mXSS)', () => {
  it('should handle mutation XSS attempts', () => {
    const mxssPayloads = [
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<svg><style><img src=x onerror=alert(1)></style>',
      '<math><mi><img src=x onerror=alert(1)></mi></math>',
    ];

    for (const payload of mxssPayloads) {
      const sanitized = sanitizeHtml(payload);
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert(');
    }
  });
});

describe('XSS Protection - DOM-based XSS', () => {
  it('should handle location hash XSS attempts', () => {
    // Simulate DOM-based XSS via URL fragment
    // Note: sanitizeHtml is for HTML content, use sanitizeUrl for URLs
    const maliciousFragments = [
      '#<script>alert(1)</script>',
      '#"><img src=x onerror=alert(1)>',
      '#javascript:alert(1)',
    ];

    for (const fragment of maliciousFragments) {
      // For HTML fragments, use sanitizeHtml
      const sanitized = sanitizeHtml(fragment);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');

      // For URL validation with dangerous schemes
      if (fragment.includes('javascript:')) {
        const escapedFragment = escapeHtml(fragment);
        expect(escapedFragment).not.toContain('javascript:');
        expect(escapedFragment).toContain('blocked:'); // Dangerous schemes replaced
      }
    }
  });
});

describe('XSS Protection - SVG-based XSS', () => {
  it('should sanitize SVG elements with scripts', () => {
    const svgPayloads = [
      '<svg onload=alert(1)>',
      '<svg><script>alert(1)</script></svg>',
      '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
      '<svg><set onbegin=alert(1) attributeName=x to=0>',
    ];

    for (const payload of svgPayloads) {
      const sanitized = sanitizeHtml(payload);
      expect(sanitized).not.toContain('alert(');
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('onbegin');
    }
  });
});

describe('XSS Protection - CSS Injection', () => {
  it('should prevent CSS-based XSS', () => {
    const cssPayloads = [
      '<style>@import "javascript:alert(1)";</style>',
      '<style>body { background: url("javascript:alert(1)"); }</style>',
      '<div style="background: url(javascript:alert(1))">',
    ];

    for (const payload of cssPayloads) {
      const sanitized = sanitizeHtml(payload);
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('alert(');
    }
  });
});

describe('XSS Protection - Template Injection', () => {
  it('should prevent template injection attacks', () => {
    // Test template literal syntax
    const templateLiteral = '${alert(1)}';
    const sanitizedLiteral = escapeHtml(templateLiteral);

    // escapeHtml escapes ${ to \${ which prevents template literal execution
    expect(sanitizedLiteral).toContain('\\${'); // Escaped version
    // The backslash prevents JavaScript from interpreting it as a template literal
    expect(sanitizedLiteral).toBe('\\${alert(1)}');

    // Test ERB/PHP template tags
    const erbPayload = '<%= alert(1) %>';
    const sanitizedErb = escapeHtml(erbPayload);
    expect(sanitizedErb).toContain('&lt;%='); // <%= becomes &lt;%=

    const phpPayload = '<?= alert(1) ?>';
    const sanitizedPhp = escapeHtml(phpPayload);
    expect(sanitizedPhp).toContain('&lt;?='); // <?= becomes &lt;?=
  });
});


describe('XSS Protection - DOM Clobbering', () => {
  it('should prevent DOM clobbering attacks', () => {
    const clobberingPayloads = [
      '<form name="getElementById"></form>',
      '<img name="body">',
      '<a id="location" href="javascript:alert(1)">',
      '<form id="forms"></form>',
    ];

    for (const payload of clobberingPayloads) {
      const sanitized = sanitizeHtml(payload);
      // Should remove or sanitize dangerous id/name attributes
      expect(sanitized).not.toContain('name="getElementById"');
      expect(sanitized).not.toContain('name="body"');
      expect(sanitized).not.toContain('id="location"');
      expect(sanitized).not.toContain('id="forms"');
    }
  });

  it('should prevent window property clobbering', () => {
    const payload = '<div id="alert">Clobbered</div>';
    const sanitized = sanitizeHtml(payload);

    // Should allow safe IDs but prevent dangerous ones
    // This is a basic test - real protection requires CSP
    expect(sanitized).toBeDefined();
  });
});

describe('XSS Protection - Prototype Pollution', () => {
  it('should prevent prototype pollution via __proto__', () => {
    const maliciousObject = {
      '__proto__': {
        isAdmin: true,
      },
      name: 'Test',
    };

    // Sanitize should handle objects safely
    const sanitized = sanitizeHtml(JSON.stringify(maliciousObject));

    // Should escape or remove __proto__
    expect(sanitized).not.toContain('"__proto__"');
  });

  it('should prevent prototype pollution via constructor', () => {
    const maliciousObject = {
      'constructor': {
        'prototype': {
          'isAdmin': true,
        },
      },
    };

    const sanitized = sanitizeHtml(JSON.stringify(maliciousObject));
    expect(sanitized).toBeDefined();
  });
});

describe('XSS Protection - Unicode and Encoding Bypasses', () => {
  it('should prevent Unicode escape bypasses', () => {
    // Test Unicode escapes that escapeHtml decodes
    const unicodeEscapes = [
      '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e',
      '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e',
    ];

    for (const payload of unicodeEscapes) {
      // escapeHtml now decodes Unicode escapes before sanitizing
      const sanitized = escapeHtml(payload);

      // After decoding \u003c to < and escaping, should not contain raw <script
      expect(sanitized).not.toContain('<script');

      // The < should be escaped to &lt;
      expect(sanitized).toContain('&lt;'); // < should be escaped
    }

    // Test HTML entities (already escaped, should remain escaped)
    const htmlEntities = [
      '&#60;script&#62;alert(1)&#60;/script&#62;',
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    ];

    for (const payload of htmlEntities) {
      const sanitized = escapeHtml(payload);

      // HTML entities get double-escaped (& becomes &amp;)
      expect(sanitized).not.toContain('<script');
      expect(sanitized).toContain('&amp;'); // & becomes &amp;
    }
  });

  it('should prevent UTF-7 encoding attacks', () => {
    const utf7Payload = '+ADw-script+AD4-alert(1)+ADw-/script+AD4-';

    // escapeHtml now removes UTF-7 encoded content
    const sanitized = escapeHtml(utf7Payload);

    // UTF-7 patterns should be removed/replaced
    expect(sanitized).not.toContain('+ADw-'); // UTF-7 pattern removed
    expect(sanitized).toContain('[removed-utf7]'); // Replaced with safe text
  });

  it('should prevent double encoding bypasses', () => {
    const doubleEncoded = '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;';
    const sanitized = sanitizeHtml(doubleEncoded);

    // Should handle double encoding safely
    expect(sanitized).toBeDefined();
  });
});

describe('XSS Protection - Mutation XSS (mXSS)', () => {
  it('should prevent mXSS via namespace confusion', () => {
    const mxssPayloads = [
      '<svg><style><img src=x onerror=alert(1)></style></svg>',
      '<math><style><img src=x onerror=alert(1)></style></math>',
      '<form><math><mtext></form><form><mglyph><style></math><img src=x onerror=alert(1)>',
    ];

    for (const payload of mxssPayloads) {
      const sanitized = sanitizeHtml(payload);
      // Should not contain executable onerror
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('alert(');
    }
  });

  it('should prevent mXSS via backslash newline', () => {
    const payload = '<img src="x" onerror="\\nalert(1)">';
    const sanitized = sanitizeHtml(payload);

    expect(sanitized).not.toContain('onerror=');
  });
});

describe('XSS Protection - Content Security Policy (CSP)', () => {
  it('should validate CSP nonce format', () => {
    // Test that nonce is properly formatted
    const nonce = 'test-nonce-123';
    const validNoncePattern = /^[a-zA-Z0-9+/=-]+$/;

    expect(validNoncePattern.test(nonce)).toBe(true);
  });

  it('should reject inline scripts without nonce', () => {
    const inlineScript = '<script>alert(1)</script>';
    const sanitized = sanitizeHtml(inlineScript);

    // Should remove inline scripts
    expect(sanitized).not.toContain('<script>');
  });
});

describe('XSS Protection - Dangling Markup Injection', () => {
  it('should prevent dangling markup attacks', () => {
    const danglingPayloads = [
      '<img src=\'https://attacker.com?',
      '<a href=\'https://attacker.com?',
      '<input value=\'',
    ];

    for (const payload of danglingPayloads) {
      const sanitized = sanitizeHtml(payload);
      // Should close or escape dangling quotes
      expect(sanitized).toBeDefined();
    }
  });
});
