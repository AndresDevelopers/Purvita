-- Script to verify security-related tables exist and have proper RLS

-- Check if security_events exists and its type
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'security_events';

-- Check RLS status for critical tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'wallet_transactions',
    'commissions',
    'orders',
    'payment_gateways',
    'blocked_ips',
    'fraud_alerts',
    'security_events',
    'subscriptions',
    'products'
  )
ORDER BY tablename;

-- Check existing policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'wallet_transactions',
    'commissions',
    'orders',
    'payment_gateways',
    'blocked_ips',
    'fraud_alerts',
    'security_events'
  )
ORDER BY tablename, policyname;
