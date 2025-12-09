-- Check if all required tables exist for the profile page
-- Run this in your Supabase SQL Editor

-- Check profiles table
SELECT 'profiles' as table_name, 
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'profiles') as exists;

-- Check phases table
SELECT 'phases' as table_name,
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'phases') as exists;

-- Check subscriptions table
SELECT 'subscriptions' as table_name,
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'subscriptions') as exists;

-- Check wallets table
SELECT 'wallets' as table_name,
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'wallets') as exists;

-- Check orders table
SELECT 'orders' as table_name,
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'orders') as exists;

-- Check network_commissions table
SELECT 'network_commissions' as table_name,
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'network_commissions') as exists;

-- Check payout_accounts table
SELECT 'payout_accounts' as table_name,
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'payout_accounts') as exists;

-- Check phase_levels table
SELECT 'phase_levels' as table_name,
       EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'phase_levels') as exists;
