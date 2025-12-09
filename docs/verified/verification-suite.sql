-- =============================================================
-- PūrVita Network - Database Verification Suite
-- Ejecuta estas consultas después de aplicar `docs/database/database.sql`
-- para confirmar que la configuración coincide con la app.
-- Sections are bilingual so every admin understands the goal.
-- =============================================================

-- ===========================================
-- 1. TABLE STRUCTURE VERIFICATION / VERIFICACIÓN DE TABLAS
-- ===========================================

-- Confirm required tables exist (core + incremental features)
SELECT
  table_name,
  CASE
    WHEN table_name IN (
      'profiles',
      'products',
      'plans',
      'class_videos',
      'payment_gateways',
      'audit_logs',
      'site_branding_settings',
      'landing_page_content',
      'contact_settings',
      'contact_messages',
      'wallets',
      'wallet_txns',
      'subscriptions',
      'payments',
      'orders',
      'order_items',
      'phases',
      'payment_wallets',
      'payment_requests',
      'payment_history_entries',
      'payment_schedule_settings'
    )
    THEN '✓ Exists'
    ELSE '✗ Missing'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'products',
    'plans',
    'class_videos',
    'payment_gateways',
    'audit_logs',
    'site_branding_settings',
    'landing_page_content',
    'contact_settings',
    'contact_messages',
    'wallets',
    'wallet_txns',
    'subscriptions',
    'payments',
    'orders',
    'order_items',
    'phases',
    'payment_wallets',
    'payment_requests',
    'payment_history_entries',
    'payment_schedule_settings'
  )
ORDER BY table_name;

-- Inspect profiles table structure (contact + checkout fields)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Confirm checkout preference columns are present
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('state', 'postal_code', 'default_payment_provider')
ORDER BY column_name;

-- Inspect products table structure (inventory + experience JSON)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;

-- Ensure curated product experience column exists
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name = 'experience';

-- ===========================================
-- 2. RLS & POLICY HEALTH / POLÍTICAS RLS
-- ===========================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ===========================================
-- 3. DATA VERIFICATION / VERIFICACIÓN DE DATOS
-- ===========================================

-- Payment gateways seeded correctly
SELECT provider, is_active, created_at
FROM payment_gateways
ORDER BY provider;

-- Subscription plans snapshot
SELECT slug, name, price, is_active
FROM plans
ORDER BY price;

-- Sample class videos ordering
SELECT title, youtube_id, is_published, order_index
FROM class_videos
ORDER BY order_index;

-- Profiles by role + status (confirms seed data)
SELECT role, status, COUNT(*) AS count
FROM profiles
GROUP BY role, status
ORDER BY role, status;

-- Product stock distribution
SELECT id, name, stock_quantity
FROM products
ORDER BY name;

SELECT SUM(stock_quantity) AS total_stock
FROM products;

-- Footer branding visibility flags per locale
SELECT
  locale,
  footer ->> 'showBrandingLogo' AS show_branding_logo,
  footer ->> 'showBrandingAppName' AS show_branding_app_name,
  footer ->> 'showBrandingDescription' AS show_branding_description,
  footer ->> 'brandingAppName' AS branding_app_name,
  footer ->> 'brandingOrientation' AS branding_orientation
FROM landing_page_content;

-- Contact recipient email configuration (landing metadata)
SELECT
  locale,
  contact ->> 'recipientEmail' AS recipient_email,
  contact -> 'contactInfo' ->> 'email' AS public_contact_email
FROM landing_page_content;

-- Dedicated contact settings (admin overrides)
SELECT
  id,
  from_name,
  from_email,
  reply_to_email,
  recipient_email_override,
  subject_prefix,
  auto_response_enabled,
  auto_response_subject,
  auto_response_body,
  cc_emails,
  bcc_emails,
  updated_at
FROM contact_settings;

-- Recent contact message logs
SELECT
  id,
  created_at,
  locale,
  name,
  email,
  recipient_email,
  status,
  error_message
FROM contact_messages
ORDER BY created_at DESC
LIMIT 20;

-- SEO settings coverage por página/idioma
SELECT
  page,
  locale,
  title,
  canonical_url,
  robots_index,
  robots_follow,
  updated_at
FROM seo_settings
ORDER BY page, locale;

-- Payment history ledger snapshot / Resumen del historial de pagos
SELECT status, COUNT(*) AS total
FROM payment_history_entries
GROUP BY status
ORDER BY status;

-- Recurring payment cadence / Configuración de cobros recurrentes
SELECT frequency, day_of_month, weekday, reminder_days_before, default_amount_cents, currency, updated_at
FROM payment_schedule_settings;

-- ===========================================
-- 4. TROUBLESHOOTING & PERFORMANCE / DIAGNÓSTICOS
-- ===========================================

-- Identify missing/unused indexes for main tables
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'products',
    'plans',
    'class_videos',
    'payment_gateways',
    'audit_logs'
  );

-- Review latest audit log entries
SELECT action, entity_type, entity_id, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- Wallet + payments health check (financial flows)
SELECT id, balance, currency, updated_at
FROM wallets
ORDER BY updated_at DESC
LIMIT 10;

SELECT id, wallet_id, amount, txn_type, status, created_at
FROM wallet_txns
ORDER BY created_at DESC
LIMIT 10;

SELECT id, user_id, status, amount, created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;

SELECT id, user_id, status, created_at
FROM subscriptions
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================
-- End of verification script / Fin del script de verificación
-- =============================================================
