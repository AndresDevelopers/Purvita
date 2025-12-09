# Rate Limiting Configuration

## 📋 Overview

The application now supports **database-driven rate limiting configuration** through the Admin Security panel. This eliminates the need to modify environment variables and restart the application to adjust rate limiting settings.

## 🎯 Features

### 1. API Rate Limiting

Control the maximum number of API requests allowed per time window:

- **Max Requests**: 1-1000 requests
- **Time Window**: Minimum 1000ms (1 second)
- **Default**: 60 requests per 60000ms (1 minute)

### 2. Login Rate Limiting

Protect against brute force attacks:

- **Max Attempts**: 1-100 attempts
- **Time Window**: Minimum 1 second
- **Default**: 5 attempts per 60 seconds

### 3. Auto-Block Configuration

Automatically block malicious IPs detected by threat intelligence:

- **Enable/Disable**: Toggle auto-blocking on/off
- **Block Duration**: 1-8760 hours (max 1 year)
- **Min Confidence**: 0-100% threshold for blocking
- **Default**: Enabled, 24 hours, 70% confidence

## 🚀 How to Use

### Admin Panel Configuration

1. Navigate to **Admin → Security**
2. Click on the **Rate Limit** tab
3. Configure your desired settings:
   - API Rate Limiting
   - Login Rate Limiting
   - Auto-Block settings
4. Click **Save Configuration**

Changes take effect immediately without requiring a server restart!

### Database Migration

If you're upgrading from a previous version, run the migration:

```sql
-- Run this migration to add the new columns
\i docs/database/migrations/add_rate_limit_columns.sql
```

Or apply it directly in Supabase SQL Editor:

```sql
ALTER TABLE public.security_settings
ADD COLUMN IF NOT EXISTS api_rate_limit_requests INTEGER NOT NULL DEFAULT 60 CHECK (api_rate_limit_requests >= 1 AND api_rate_limit_requests <= 1000),
ADD COLUMN IF NOT EXISTS api_rate_limit_window_ms INTEGER NOT NULL DEFAULT 60000 CHECK (api_rate_limit_window_ms >= 1000),
ADD COLUMN IF NOT EXISTS login_rate_limit_attempts INTEGER NOT NULL DEFAULT 5 CHECK (login_rate_limit_attempts >= 1 AND login_rate_limit_attempts <= 100),
ADD COLUMN IF NOT EXISTS login_rate_limit_window_seconds INTEGER NOT NULL DEFAULT 60 CHECK (login_rate_limit_window_seconds >= 1),
ADD COLUMN IF NOT EXISTS auto_block_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_block_duration_hours INTEGER NOT NULL DEFAULT 24 CHECK (auto_block_duration_hours >= 1 AND auto_block_duration_hours <= 8760),
ADD COLUMN IF NOT EXISTS auto_block_min_confidence INTEGER NOT NULL DEFAULT 70 CHECK (auto_block_min_confidence >= 0 AND auto_block_min_confidence <= 100);
```

## 🔄 Configuration Priority

The system uses the following priority order:

1. **Database Configuration** (highest priority)
   - Cached in Redis for 5 minutes
   - Updated via Admin panel

2. **Environment Variables** (fallback - with security restrictions)
   - Used if database is unavailable
   - **⚠️ IMPORTANT SECURITY POLICY:**
     - **In PRODUCTION (`NODE_ENV=production`):**
       - Security settings (`AUTO_BLOCK_*`) are **IGNORED** from environment variables
       - Always uses secure defaults: `enabled=true`, `duration=24h`, `confidence=70`
       - This prevents accidental misconfiguration in production
     - **In DEVELOPMENT (`NODE_ENV=development`):**
       - All environment variables are respected for testing flexibility
   - Rate limiting settings (`API_RATE_LIMIT_*`, `LOGIN_RATE_LIMIT_*`) can be configured via env vars in both environments

3. **Default Values** (last resort)
   - Hard-coded secure defaults if nothing else is available
   - Production-safe values: `autoBlockEnabled=true`, `duration=24h`, `confidence=70`

## 📊 Configuration Details

### API Rate Limiting

```typescript
{
  api_rate_limit_requests: 60,      // Max requests per window
  api_rate_limit_window_ms: 60000   // Window in milliseconds
}
```

**Use Cases:**

- **Strict** (Production): 30 requests / 60000ms
- **Balanced** (Recommended): 60 requests / 60000ms
- **Generous** (Development): 100 requests / 60000ms

### Login Rate Limiting

```typescript
{
  login_rate_limit_attempts: 5,           // Max login attempts
  login_rate_limit_window_seconds: 60    // Window in seconds
}
```

**Use Cases:**

- **Strict** (High Security): 3 attempts / 300 seconds (5 min)
- **Balanced** (Recommended): 5 attempts / 60 seconds
- **Permissive** (Development): 10 attempts / 30 seconds

### Auto-Block Configuration

```typescript
{
  auto_block_enabled: true,           // Enable/disable auto-blocking
  auto_block_duration_hours: 24,      // Block duration in hours
  auto_block_min_confidence: 70       // Min confidence % to block
}
```

**Confidence Levels:**

- **70-80%**: Balanced (recommended)
- **80-90%**: Strict (fewer false positives)
- **60-70%**: Permissive (more protection)

## 🔧 Technical Implementation

### Caching Strategy

- **Redis Cache**: 5 minutes TTL for database config
- **In-Memory Fallback**: 1 minute TTL for env config
- **Cache Invalidation**: Automatic on config update

### API Endpoints

```typescript
// Get current configuration
GET /api/admin/security/rate-limit

// Update configuration
PUT /api/admin/security/rate-limit
{
  api_rate_limit_requests: 60,
  api_rate_limit_window_ms: 60000,
  login_rate_limit_attempts: 5,
  login_rate_limit_window_seconds: 60,
  auto_block_enabled: true,
  auto_block_duration_hours: 24,
  auto_block_min_confidence: 70
}
```

### Helper Functions

```typescript
import { getRateLimitConfig } from '@/lib/helpers/rate-limit-config-helper';

// Get current config (cached)
const config = await getRateLimitConfig();

// Invalidate cache after update
await invalidateRateLimitConfigCache();
```

## 🔐 Security Considerations

1. **Admin Only**: Only admin users can modify rate limiting settings
2. **Validation**: All values are validated with database constraints
3. **Audit Trail**: Changes are logged via the updated_at timestamp
4. **Fallback Safety**: System falls back to safe defaults if config is unavailable

## 📝 Environment Variables (Legacy Support)

These environment variables are still supported as fallbacks:

```bash
# API Rate Limiting
API_RATE_LIMIT_REQUESTS=60
API_RATE_LIMIT_WINDOW_MS=60000

# Login Rate Limiting
LOGIN_RATE_LIMIT_ATTEMPTS=5
LOGIN_RATE_LIMIT_WINDOW_SECONDS=60

# Auto-Block Configuration
AUTO_BLOCK_ENABLED=true
AUTO_BLOCK_DURATION_HOURS=24
AUTO_BLOCK_MIN_CONFIDENCE=70
```

**Note**: Database configuration takes precedence over environment variables.

## 🎯 Best Practices

1. **Start Conservative**: Begin with default values and adjust based on traffic
2. **Monitor Metrics**: Watch for rate limit hits in your logs
3. **Test Changes**: Use development environment to test new limits
4. **Document Reasons**: Keep notes on why you changed specific values
5. **Review Regularly**: Periodically review and adjust based on usage patterns

## 🐛 Troubleshooting

### Configuration Not Taking Effect

1. Check if Redis cache is working
2. Verify database connection
3. Check browser console for errors
4. Verify admin permissions

### Rate Limits Too Strict

1. Review current traffic patterns
2. Increase `api_rate_limit_requests`
3. Increase `api_rate_limit_window_ms`
4. Monitor for improvements

### Too Many Auto-Blocks

1. Increase `auto_block_min_confidence`
2. Review threat intelligence logs
3. Consider disabling auto-block temporarily
4. Whitelist known good IPs

## 📚 Related Documentation

- [Security Documentation](./security.md)
- [Threat Intelligence](./THREAT_INTELLIGENCE.md)
- [Database Schema](./database/database.sql)
- [Admin Panel Guide](./ADMIN_PANEL.md)
