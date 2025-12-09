-- Check which tables exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') 
    THEN '✅' ELSE '❌' 
  END as profiles,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'phases') 
    THEN '✅' ELSE '❌' 
  END as phases,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') 
    THEN '✅' ELSE '❌' 
  END as subscriptions,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallets') 
    THEN '✅' ELSE '❌' 
  END as wallets,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') 
    THEN '✅' ELSE '❌' 
  END as orders,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'network_commissions') 
    THEN '✅' ELSE '❌' 
  END as network_commissions,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_accounts') 
    THEN '✅' ELSE '❌' 
  END as payout_accounts,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'phase_levels') 
    THEN '✅' ELSE '❌' 
  END as phase_levels;
