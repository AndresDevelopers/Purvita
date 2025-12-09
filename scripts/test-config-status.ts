/**
 * Test script to verify the config-status endpoint
 * This simulates what the endpoint does to check configuration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConfigStatus() {
  console.log('🧪 Testing Config Status Endpoint Logic\n');

  // Check Supabase connectivity
  console.log('1️⃣ Testing Supabase connectivity...');
  const { error: supabaseError } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);
  const supabaseConfigured = !supabaseError;
  console.log(`   Supabase: ${supabaseConfigured ? '✅ Connected' : '❌ Failed'}`);
  if (supabaseError) {
    console.log(`   Error: ${supabaseError.message}`);
  }

  // Check Email configuration
  console.log('\n2️⃣ Testing Email configuration...');
  const hasEmailProvider = Boolean(process.env.RESEND_API_KEY);
  const fromAddressConfigured = Boolean(process.env.CONTACT_FROM_EMAIL);
  const fromNameConfigured = Boolean(process.env.CONTACT_FROM_NAME);
  const emailConfigured = hasEmailProvider && fromAddressConfigured && fromNameConfigured;
  console.log(`   Email Provider (Resend): ${hasEmailProvider ? '✅' : '❌'}`);
  console.log(`   From Address: ${fromAddressConfigured ? '✅' : '❌'}`);
  console.log(`   From Name: ${fromNameConfigured ? '✅' : '❌'}`);
  console.log(`   Overall: ${emailConfigured ? '✅ Configured' : '❌ Not Configured'}`);

  // Check Payment Gateways
  console.log('\n3️⃣ Testing Payment Gateways...');
  const { data: gateways, error: gatewaysError } = await supabase
    .from('payment_gateways')
    .select('provider, is_active, mode');

  if (gatewaysError) {
    console.log(`   ❌ Error fetching gateways: ${gatewaysError.message}`);
    return;
  }

  const allGateways = gateways ?? [];
  console.log(`   Found ${allGateways.length} gateways in database\n`);

  // Check Stripe
  const stripeGateway = allGateways.find(g => g.provider === 'stripe');
  if (stripeGateway) {
    const stripeMode = stripeGateway.mode || 'production';
    const hasTestCredentials = Boolean(
      process.env.STRIPE_TEST_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY
    );
    const hasProductionCredentials = Boolean(
      process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    );

    const stripeConfigured = stripeMode === 'test' ? hasTestCredentials : hasProductionCredentials;

    console.log('   📌 STRIPE:');
    console.log(`      Database Mode: ${stripeMode}`);
    console.log(`      Is Active: ${stripeGateway.is_active ? '✅' : '❌'}`);
    console.log(`      Test Credentials: ${hasTestCredentials ? '✅' : '❌'}`);
    console.log(`      Production Credentials: ${hasProductionCredentials ? '✅' : '❌'}`);
    console.log(`      Configured for ${stripeMode} mode: ${stripeConfigured ? '✅' : '❌'}`);
    console.log(`      \n      ➡️ Response will be: { configured: ${stripeConfigured}, mode: "${stripeMode}" }`);
  } else {
    console.log('   📌 STRIPE: ❌ Not found in database');
  }

  // Check PayPal
  const paypalGateway = allGateways.find(g => g.provider === 'paypal');
  if (paypalGateway) {
    const paypalMode = paypalGateway.mode || 'production';
    const hasTestCredentials = Boolean(
      process.env.PAYPAL_TEST_CLIENT_ID &&
      process.env.PAYPAL_TEST_CLIENT_SECRET
    );
    const hasProductionCredentials = Boolean(
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET
    );

    const paypalConfigured = paypalMode === 'test' ? hasTestCredentials : hasProductionCredentials;

    console.log('\n   📌 PAYPAL:');
    console.log(`      Database Mode: ${paypalMode}`);
    console.log(`      Is Active: ${paypalGateway.is_active ? '✅' : '❌'}`);
    console.log(`      Test Credentials: ${hasTestCredentials ? '✅' : '❌'}`);
    console.log(`      Production Credentials: ${hasProductionCredentials ? '✅' : '❌'}`);
    console.log(`      Configured for ${paypalMode} mode: ${paypalConfigured ? '✅' : '❌'}`);
    console.log(`      \n      ➡️ Response will be: { configured: ${paypalConfigured}, mode: "${paypalMode}" }`);
  } else {
    console.log('\n   📌 PAYPAL: ❌ Not found in database');
  }

  // Final response
  console.log('\n\n📋 FINAL RESPONSE THAT ENDPOINT WILL RETURN:');
  console.log('═'.repeat(60));
  
  const stripeGatewayFinal = allGateways.find(g => g.provider === 'stripe');
  const paypalGatewayFinal = allGateways.find(g => g.provider === 'paypal');
  
  const response = {
    supabase: supabaseConfigured,
    email: emailConfigured,
    stripe: {
      configured: stripeGatewayFinal ? (
        stripeGatewayFinal.mode === 'test' 
          ? Boolean(process.env.STRIPE_TEST_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY)
          : Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      ) : false,
      mode: stripeGatewayFinal ? (stripeGatewayFinal.mode || 'production') : null,
    },
    paypal: {
      configured: paypalGatewayFinal ? (
        paypalGatewayFinal.mode === 'test'
          ? Boolean(process.env.PAYPAL_TEST_CLIENT_ID && process.env.PAYPAL_TEST_CLIENT_SECRET)
          : Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
      ) : false,
      mode: paypalGatewayFinal ? (paypalGatewayFinal.mode || 'production') : null,
    },
  };

  console.log(JSON.stringify(response, null, 2));
  console.log('═'.repeat(60));
}

testConfigStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

