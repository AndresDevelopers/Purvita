-- =============================================================
-- Verification Script: Check payout system tables
-- Run this to verify if the payout tables are properly set up
-- =============================================================

-- Check if tables exist
SELECT 
  'Tables Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'network_commissions'
    ) THEN '✓ network_commissions exists'
    ELSE '✗ network_commissions MISSING'
  END as network_commissions,
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'payout_accounts'
    ) THEN '✓ payout_accounts exists'
    ELSE '✗ payout_accounts MISSING'
  END as payout_accounts,
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'payout_preferences'
    ) THEN '✓ payout_preferences exists'
    ELSE '✗ payout_preferences MISSING'
  END as payout_preferences;

-- Check RLS policies
SELECT 
  'RLS Policies' as check_type,
  tablename,
  policyname,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Read'
    WHEN cmd = 'ALL' THEN 'All Operations'
    ELSE cmd
  END as operation
FROM pg_policies
WHERE tablename IN ('network_commissions', 'payout_accounts', 'payout_preferences')
ORDER BY tablename, policyname;

-- Check table structure
SELECT 
  'network_commissions columns' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'network_commissions'
ORDER BY ordinal_position;

SELECT
  'payout_accounts columns' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'payout_accounts'
ORDER BY ordinal_position;

SELECT
  'payout_preferences columns' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'payout_preferences'
ORDER BY ordinal_position;

-- Check if there's any data
SELECT
  'Data Count' as check_type,
  (SELECT COUNT(*) FROM public.network_commissions) as network_commissions_count,
  (SELECT COUNT(*) FROM public.payout_accounts) as payout_accounts_count,
  (SELECT COUNT(*) FROM public.payout_preferences) as payout_preferences_count;
