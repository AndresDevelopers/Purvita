# Analytics Module Implementation Guide

## Overview

This document describes the implementation of a comprehensive analytics system for PurVita, including event tracking, metrics calculation, and privacy-compliant data collection.

## Architecture

The analytics module follows a **Domain-Driven Design (DDD)** pattern with clear separation of concerns:

```
/src/modules/analytics/
├── domain/               # Business logic and contracts
│   ├── models/          # Zod schemas for type safety
│   └── contracts/       # Repository interfaces
├── data/                # Data access layer
│   └── repositories/    # Supabase implementations
├── services/            # Business services
├── factories/           # Dependency injection
└── ui/                  # React components and hooks
    ├── components/      # UI components
    └── hooks/           # Custom React hooks
```

## Features

### 1. Event Tracking
- **Comprehensive Events**: pageview, product_view, add_to_cart, checkout, purchase, etc.
- **Rich Parameters**: Product details, transaction info, user context
- **dataLayer Pattern**: Compatible with Google Tag Manager-style tracking
- **Session Management**: Automatic session ID generation and tracking

### 2. Metrics Dashboard
- **Basic Metrics** (Always Available):
  - Total visits, unique visitors, page views
  - Total orders, revenue, average order value
  - Conversion rate
  - Top 5 products with detailed stats

- **Advanced Metrics** (Premium Feature):
  - Conversion funnel analysis
  - Device breakdown (desktop, mobile, tablet)
  - Time series trends
  - Cohort analysis (prepared)
  - Customer Lifetime Value (prepared)

### 3. Privacy & Compliance
- **GDPR/CCPA Compliant**: Privacy consent banner
- **IP Anonymization**: Optional IP address masking
- **Data Retention**: Configurable retention period (30-730 days)
- **Opt-out**: Users can decline tracking
- **Transparency**: Clear privacy controls

### 4. Multi-language Support
- Full i18n support (English/Spanish)
- All UI components translated
- Dictionary-based translations

## Database Setup

### Step 1: Apply Migration

Run the SQL migration to create the necessary tables:

```bash
# Navigate to Supabase SQL Editor and run:
# /docs/migrations/analytics-tables.sql
```

This creates:
- `analytics_events` - Raw event storage
- `analytics_config` - User preferences and feature flags
- Helper views for metrics aggregation
- Row Level Security (RLS) policies
- Automatic triggers

### Step 2: Verify Tables

```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'analytics%';

-- Should return:
-- analytics_events
-- analytics_config
```

### Step 3: Enable Advanced Analytics (Optional)

To enable advanced analytics for a user:

```sql
UPDATE analytics_config
SET advanced_analytics_enabled = true
WHERE user_id = 'USER_UUID';
```

## Integration Guide

### 1. Add Analytics Tracker to Layout

Add the `AnalyticsTracker` component to your root layout to enable automatic page view tracking:

```tsx
// src/app/[lang]/layout.tsx
import { AnalyticsTracker } from '@/modules/analytics/ui/components/analytics-tracker';

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <AnalyticsTracker />
        {children}
      </body>
    </html>
  );
}
```

### 2. Add Privacy Consent Banner

Add the privacy consent component to show on first visit:

```tsx
// src/app/[lang]/layout.tsx
import { PrivacyConsent } from '@/modules/analytics/ui/components/privacy-consent';

export default function Layout({ children }) {
  const dict = useAppDictionary();

  return (
    <html>
      <body>
        <AnalyticsTracker />
        <PrivacyConsent dict={dict.analytics.privacy} />
        {children}
      </body>
    </html>
  );
}
```

### 3. Track E-commerce Events

#### Track Product Views

```tsx
// In product page
import { useAnalytics } from '@/modules/analytics/ui/hooks/use-analytics';

function ProductPage({ product }) {
  const { trackProductView } = useAnalytics();

  useEffect(() => {
    trackProductView({
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      price: product.price,
      currency: 'USD',
    });
  }, [product]);
}
```

#### Track Add to Cart

```tsx
// In add to cart button
import { useAnalytics } from '@/modules/analytics/ui/hooks/use-analytics';

function AddToCartButton({ product }) {
  const { trackAddToCart } = useAnalytics();

  const handleAddToCart = () => {
    trackAddToCart({
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      quantity: 1,
      currency: 'USD',
    });
    // ... add to cart logic
  };
}
```

#### Track Checkout

```tsx
// In checkout page
import { useAnalytics } from '@/modules/analytics/ui/hooks/use-analytics';

function CheckoutPage({ cartItems, total }) {
  const { trackBeginCheckout } = useAnalytics();

  useEffect(() => {
    const items = cartItems.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
      currency: 'USD',
    }));

    trackBeginCheckout(items, total);
  }, []);
}
```

#### Track Purchase

```tsx
// After successful payment
import { useAnalytics } from '@/modules/analytics/ui/hooks/use-analytics';

function OrderConfirmation({ order }) {
  const { trackPurchase } = useAnalytics();

  useEffect(() => {
    const items = order.items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
      currency: 'USD',
    }));

    trackPurchase(
      order.id,
      items,
      order.total,
      {
        tax: order.tax,
        shipping: order.shipping,
        paymentMethod: order.paymentMethod,
      }
    );
  }, [order]);
}
```

### 4. Track Custom Events

```tsx
import { useAnalytics } from '@/modules/analytics/ui/hooks/use-analytics';

function MyComponent() {
  const { trackCustomEvent } = useAnalytics();

  const handleSpecialAction = () => {
    trackCustomEvent('special_action', {
      category: 'engagement',
      action: 'button_click',
      label: 'special_button',
    });
  };
}
```

## API Endpoints

### POST /api/analytics/events
Track single or batch events.

```typescript
// Single event
POST /api/analytics/events
{
  "event_type": "pageview",
  "session_id": "session_123",
  "params": {
    "page_path": "/products/123",
    "page_title": "Product Name"
  }
}

// Batch events
POST /api/analytics/events
[
  { "event_type": "pageview", ... },
  { "event_type": "product_view", ... }
]
```

### GET /api/analytics/metrics
Get analytics metrics.

```typescript
GET /api/analytics/metrics?period=last_30_days&include_advanced=true

Response:
{
  "success": true,
  "data": {
    "basic": {
      "total_visits": 1234,
      "unique_visitors": 567,
      "page_views": 2345,
      "total_orders": 89,
      "total_revenue": 12345.67,
      "avg_order_value": 138.82,
      "conversion_rate": 15.7,
      "top_products": [...]
    },
    "advanced": { ... } // Only if enabled
  }
}
```

### GET /api/analytics/config
Get user analytics configuration.

```typescript
GET /api/analytics/config

Response:
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "analytics_enabled": true,
    "advanced_analytics_enabled": false,
    "tracking_consent": true,
    "anonymize_ip": true,
    "data_retention_days": 90
  }
}
```

### PUT /api/analytics/config
Update analytics configuration.

```typescript
PUT /api/analytics/config
{
  "advanced_analytics_enabled": true,
  "data_retention_days": 180
}
```

### POST /api/analytics/consent
Update privacy consent.

```typescript
POST /api/analytics/consent
{
  "tracking_consent": true,
  "anonymize_ip": true
}
```

## Data Retention & Privacy

### Automatic Cleanup
Old events are automatically cleaned up based on user retention settings:

```sql
-- Run periodically (e.g., daily cron job)
SELECT cleanup_old_analytics_events();
```

### User Data Deletion (GDPR/CCPA)
To delete all analytics data for a user:

```sql
-- Delete events
DELETE FROM analytics_events WHERE user_id = 'USER_UUID';

-- Delete config
DELETE FROM analytics_config WHERE user_id = 'USER_UUID';
```

### IP Anonymization
IP addresses are automatically anonymized when `anonymize_ip` is enabled:
- IPv4: Last octet removed (e.g., `192.168.1.0`)
- IPv6: Last 80 bits removed (e.g., `2001:0db8:85a3:0000::`)

## Performance Considerations

### Indexing
The migration includes optimized indexes for common queries:
- `idx_analytics_events_user_id`
- `idx_analytics_events_timestamp`
- `idx_analytics_events_event_type`
- GIN index on JSONB params

### Query Optimization
- Metrics are calculated on-demand but can be pre-aggregated
- Consider using materialized views for dashboard metrics
- Use `analytics_daily_metrics` view for historical analysis

### Batch Processing
For high-traffic sites, batch events instead of sending individually:

```typescript
const events = []; // Collect events
// Send batch every 10 events or 30 seconds
await fetch('/api/analytics/events', {
  method: 'POST',
  body: JSON.stringify(events)
});
```

## Testing

### Manual Testing Checklist
- [ ] Apply database migration
- [ ] Visit analytics page (`/es/analytics` or `/en/analytics`)
- [ ] Accept privacy consent
- [ ] Navigate to different pages (verify pageview tracking)
- [ ] View a product (verify product_view event)
- [ ] Add product to cart (verify add_to_cart event)
- [ ] Complete checkout (verify begin_checkout event)
- [ ] Complete purchase (verify purchase event)
- [ ] Check metrics dashboard for data
- [ ] Try different time periods
- [ ] Test advanced analytics (if enabled)

### Verify Events in Database
```sql
-- Check recent events
SELECT event_type, params, timestamp
FROM analytics_events
ORDER BY timestamp DESC
LIMIT 20;

-- Check metrics
SELECT * FROM analytics_daily_metrics
ORDER BY date DESC;
```

## Troubleshooting

### No events being tracked
1. Check privacy consent is given
2. Verify `AnalyticsTracker` is in layout
3. Check browser console for errors
4. Verify Supabase connection
5. Check RLS policies

### Metrics not showing
1. Verify events exist in database
2. Check date range selection
3. Verify user has access (RLS)
4. Check for JavaScript errors

### Advanced analytics not available
1. Check `advanced_analytics_enabled` in config
2. Verify user has paid subscription
3. Check feature flag logic

## Next Steps

### Recommended Enhancements
1. **Add charts**: Integrate Chart.js or Recharts for visualizations
2. **Real-time dashboard**: Use Supabase real-time subscriptions
3. **Email reports**: Weekly/monthly reports via email
4. **Export functionality**: CSV/PDF export
5. **Custom date ranges**: Calendar picker for custom ranges
6. **Segments**: User segmentation and filtering
7. **Goals**: Conversion goals and tracking
8. **A/B testing**: Built-in A/B testing support

### Monitoring
- Set up alerts for unusual traffic patterns
- Monitor database performance
- Track API endpoint response times
- Review data retention and cleanup

## Support

For questions or issues:
1. Check this documentation
2. Review code comments in modules
3. Check database logs for errors
4. Contact development team

---

**Version**: 1.0.0
**Last Updated**: 2025-11-11
**Status**: Production Ready ✅
