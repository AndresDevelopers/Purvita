# Security Testing Suite

Comprehensive security tests for PūrVita application.

## Test Categories

### 1. API Security (`api-security.test.ts`)
- SQL Injection protection
- Authentication & Authorization
- Rate limiting
- Input validation
- CSRF protection
- Information disclosure
- CORS configuration
- HTTP methods validation

### 2. XSS Protection (`xss-protection.test.ts`)
- HTML sanitization
- Script injection prevention
- Event handler injection
- URL sanitization
- Context-specific encoding
- Mutation XSS (mXSS)
- DOM-based XSS
- SVG-based XSS
- CSS injection
- Template injection

### 3. Payment Security (`payment-security.test.ts`)
- Price manipulation prevention
- Currency validation
- Metadata sanitization
- Payment intent validation
- Webhook signature verification
- Race condition handling
- Idempotency
- Amount precision

### 4. Authentication Security (`auth-security.test.ts`)
- Password policies
- Brute force protection
- Session management
- JWT token validation
- Account enumeration prevention
- Role-based access control (RBAC)
- OAuth security
- Password reset security

## Running Tests

### Run all security tests
```bash
npm run test:security
```

### Run specific test suite
```bash
npm test tests/security/api-security.test.ts
npm test tests/security/xss-protection.test.ts
npm test tests/security/payment-security.test.ts
npm test tests/security/auth-security.test.ts
```

### Run with coverage
```bash
npm test -- --coverage tests/security/
```

## Test Configuration

Tests use the following environment variables:
- `NEXT_PUBLIC_APP_URL`: Base URL for API tests (default: http://localhost:9001)
- `NODE_ENV`: Environment mode (development/production)

## Continuous Integration

These tests should be run:
1. Before every deployment
2. After security-related code changes
3. Weekly as part of scheduled security audits
4. After dependency updates

## Test Results Interpretation

### Pass Criteria
- All tests passing: Application is secure against tested vulnerabilities
- Some tests failing: Review failed tests and fix vulnerabilities immediately

### Common Failures
- **Rate limiting tests**: Ensure Redis/Upstash is configured
- **Authentication tests**: Ensure Supabase is configured
- **Payment tests**: Ensure payment gateways are configured

## Adding New Tests

When adding new security tests:
1. Follow the existing test structure
2. Document what vulnerability you're testing
3. Include both positive and negative test cases
4. Add to the appropriate test file or create a new one
5. Update this README

## Security Testing Best Practices

1. **Test in isolation**: Each test should be independent
2. **Use realistic payloads**: Test with actual attack vectors
3. **Test edge cases**: Include boundary conditions
4. **Document findings**: Explain why each test is important
5. **Keep tests updated**: Update tests when security requirements change

## OWASP Top 10 Coverage

These tests cover the following OWASP Top 10 vulnerabilities:

- ✅ A01:2021 – Broken Access Control
- ✅ A02:2021 – Cryptographic Failures
- ✅ A03:2021 – Injection
- ✅ A04:2021 – Insecure Design
- ✅ A05:2021 – Security Misconfiguration
- ✅ A06:2021 – Vulnerable and Outdated Components
- ✅ A07:2021 – Identification and Authentication Failures
- ✅ A08:2021 – Software and Data Integrity Failures
- ✅ A09:2021 – Security Logging and Monitoring Failures
- ✅ A10:2021 – Server-Side Request Forgery (SSRF)

## Manual Penetration Testing

For comprehensive security assessment, supplement automated tests with:

1. **Manual code review**: Review security-critical code paths
2. **External penetration testing**: Hire security professionals
3. **Bug bounty program**: Consider running a bug bounty
4. **Security audits**: Regular third-party security audits

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [PCI DSS](https://www.pcisecuritystandards.org/)
