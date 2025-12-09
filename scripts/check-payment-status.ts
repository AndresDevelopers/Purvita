/**
 * Script to check payment gateway status
 * 
 * Usage:
 *   npx tsx scripts/check-payment-status.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Checking Payment Gateway Status\n');

  const { data: gateways, error } = await supabase
    .from('payment_gateways')
    .select('*')
    .order('provider');

  if (error) {
    console.error('❌ Error fetching gateways:', error.message);
    process.exit(1);
  }

  if (!gateways || gateways.length === 0) {
    console.log('⚠️  No payment gateways found in database');
    return;
  }

  console.log('Payment Gateways:\n');
  
  gateways.forEach((gateway: any) => {
    const status = gateway.is_active ? '✅ Active' : '❌ Inactive';
    console.log(`${gateway.provider.toUpperCase()}`);
    console.log(`  Status: ${status}`);
    console.log(`  Mode: ${gateway.mode || 'N/A'}`);
    console.log(`  Functionality: ${gateway.functionality || 'N/A'}`);
    console.log('');
  });

  // Check environment variables
  console.log('\n📋 Environment Variables:\n');
  
  console.log('Stripe Test:');
  console.log(`  NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY: ${process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  STRIPE_TEST_SECRET_KEY: ${process.env.STRIPE_TEST_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);

  console.log('\nStripe Production:');
  console.log(`  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
  
  console.log('\nPayPal Test:');
  console.log(`  PAYPAL_TEST_CLIENT_ID: ${process.env.PAYPAL_TEST_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`  PAYPAL_TEST_CLIENT_SECRET: ${process.env.PAYPAL_TEST_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  
  console.log('\nPayPal Production:');
  console.log(`  PAYPAL_CLIENT_ID: ${process.env.PAYPAL_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`  PAYPAL_CLIENT_SECRET: ${process.env.PAYPAL_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
}

main().catch(console.error);
