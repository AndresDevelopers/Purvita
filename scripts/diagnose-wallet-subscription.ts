/**
 * Script to diagnose wallet balance and subscription payment issues
 * 
 * Usage:
 * npx tsx scripts/diagnose-wallet-subscription.ts <user-id>
 * 
 * Example:
 * npx tsx scripts/diagnose-wallet-subscription.ts ce4494a0-72b6-42ca-a93b-7adb8d8fdce7
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseWalletSubscription(userId: string) {
  console.log('='.repeat(80));
  console.log('WALLET & SUBSCRIPTION DIAGNOSTIC REPORT');
  console.log('='.repeat(80));
  console.log(`User ID: ${userId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log();

  // 1. Check user profile
  console.log('1. USER PROFILE');
  console.log('-'.repeat(80));
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, name, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('❌ Error fetching user profile:', profileError.message);
    return;
  }

  if (!profile) {
    console.error('❌ User not found');
    return;
  }

  console.log('✅ User found:');
  console.log(`   Email: ${profile.email}`);
  console.log(`   Name: ${profile.name || 'N/A'}`);
  console.log(`   Created: ${profile.created_at}`);
  console.log();

  // 2. Check wallet balance
  console.log('2. WALLET BALANCE');
  console.log('-'.repeat(80));
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (walletError) {
    console.error('❌ Error fetching wallet:', walletError.message);
  } else if (!wallet) {
    console.log('⚠️  No wallet found for user (will be created on first transaction)');
    console.log('   Balance: $0.00 (0 cents)');
  } else {
    const balanceDollars = (wallet.balance_cents / 100).toFixed(2);
    console.log('✅ Wallet found:');
    console.log(`   Balance: $${balanceDollars} (${wallet.balance_cents} cents)`);
    console.log(`   Created: ${wallet.created_at}`);
    console.log(`   Updated: ${wallet.updated_at}`);
  }
  console.log();

  // 3. Check recent wallet transactions
  console.log('3. RECENT WALLET TRANSACTIONS (Last 10)');
  console.log('-'.repeat(80));
  const { data: transactions, error: txnError } = await supabase
    .from('wallet_txns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (txnError) {
    console.error('❌ Error fetching transactions:', txnError.message);
  } else if (!transactions || transactions.length === 0) {
    console.log('ℹ️  No transactions found');
  } else {
    console.log(`✅ Found ${transactions.length} recent transactions:`);
    transactions.forEach((txn, index) => {
      const amount = (txn.delta_cents / 100).toFixed(2);
      const sign = txn.delta_cents >= 0 ? '+' : '';
      console.log(`   ${index + 1}. ${sign}$${amount} - ${txn.reason} - ${new Date(txn.created_at).toLocaleString()}`);
      if (txn.meta && Object.keys(txn.meta).length > 0) {
        console.log(`      Meta: ${JSON.stringify(txn.meta)}`);
      }
    });
  }
  console.log();

  // 4. Check available subscription plans
  console.log('4. AVAILABLE SUBSCRIPTION PLANS');
  console.log('-'.repeat(80));
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (plansError) {
    console.error('❌ Error fetching plans:', plansError.message);
  } else if (!plans || plans.length === 0) {
    console.log('⚠️  No active plans found');
  } else {
    console.log(`✅ Found ${plans.length} active plan(s):`);
    plans.forEach((plan, index) => {
      const priceDollars = plan.price.toFixed(2);
      const priceCents = Math.round(plan.price * 100);
      const canAfford = wallet && wallet.balance_cents >= priceCents;
      const affordIcon = canAfford ? '✅' : '❌';
      console.log(`   ${index + 1}. ${plan.name} - $${priceDollars} (${priceCents} cents) ${affordIcon}`);
      console.log(`      ID: ${plan.id}`);
      console.log(`      Slug: ${plan.slug}`);
      if (plan.description) {
        console.log(`      Description: ${plan.description}`);
      }
    });
  }
  console.log();

  // 5. Check current subscription status
  console.log('5. CURRENT SUBSCRIPTION STATUS');
  console.log('-'.repeat(80));
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (subError) {
    console.error('❌ Error fetching subscription:', subError.message);
  } else if (!subscription) {
    console.log('ℹ️  No active subscription found');
  } else {
    console.log('✅ Subscription found:');
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Gateway: ${subscription.gateway || 'N/A'}`);
    console.log(`   Period End: ${subscription.current_period_end || 'N/A'}`);
    console.log(`   Created: ${subscription.created_at}`);
    console.log(`   Updated: ${subscription.updated_at}`);
  }
  console.log();

  // 6. Check payment providers configuration
  console.log('6. PAYMENT PROVIDERS CONFIGURATION');
  console.log('-'.repeat(80));
  const { data: gateways, error: gatewaysError } = await supabase
    .from('payment_gateways')
    .select('*')
    .eq('is_active', true);

  if (gatewaysError) {
    console.error('❌ Error fetching payment gateways:', gatewaysError.message);
  } else if (!gateways || gateways.length === 0) {
    console.log('⚠️  No active payment gateways configured');
  } else {
    console.log(`✅ Found ${gateways.length} active gateway(s):`);
    gateways.forEach((gateway, index) => {
      console.log(`   ${index + 1}. ${gateway.provider} (${gateway.mode})`);
    });
    console.log('   Note: Wallet payment is always available if user has balance');
  }
  console.log();

  // 7. Summary and recommendations
  console.log('7. SUMMARY & RECOMMENDATIONS');
  console.log('-'.repeat(80));
  
  const currentBalance = wallet?.balance_cents || 0;
  const balanceDollars = (currentBalance / 100).toFixed(2);
  
  console.log(`Current wallet balance: $${balanceDollars} (${currentBalance} cents)`);
  
  if (plans && plans.length > 0) {
    const cheapestPlan = plans[0];
    const cheapestPriceCents = Math.round(cheapestPlan.price * 100);
    const cheapestPriceDollars = cheapestPlan.price.toFixed(2);
    
    if (currentBalance >= cheapestPriceCents) {
      console.log(`✅ You CAN afford the cheapest plan: ${cheapestPlan.name} ($${cheapestPriceDollars})`);
      console.log(`   Remaining balance after purchase: $${((currentBalance - cheapestPriceCents) / 100).toFixed(2)}`);
    } else {
      const needed = cheapestPriceCents - currentBalance;
      const neededDollars = (needed / 100).toFixed(2);
      console.log(`❌ You CANNOT afford any plan with current balance`);
      console.log(`   Cheapest plan: ${cheapestPlan.name} ($${cheapestPriceDollars})`);
      console.log(`   Additional funds needed: $${neededDollars} (${needed} cents)`);
      console.log();
      console.log('💡 RECOMMENDATIONS:');
      console.log('   1. Recharge your wallet balance using PayPal or Stripe');
      console.log('   2. Go to your profile page and use the "Recharge Balance" option');
      console.log(`   3. Add at least $${neededDollars} to your wallet`);
    }
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('END OF DIAGNOSTIC REPORT');
  console.log('='.repeat(80));
}

// Main execution
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npx tsx scripts/diagnose-wallet-subscription.ts <user-id>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/diagnose-wallet-subscription.ts ce4494a0-72b6-42ca-a93b-7adb8d8fdce7');
  process.exit(1);
}

diagnoseWalletSubscription(userId).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

