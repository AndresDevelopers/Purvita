import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testDashboardMetrics() {
  console.log('Testing admin_dashboard_metrics_extended function...\n');

  try {
    const { data, error } = await supabase.rpc('admin_dashboard_metrics_extended', {
      recent_limit: 5,
    });

    if (error) {
      console.error('❌ Error calling RPC function:');
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
      return;
    }

    console.log('✅ Function executed successfully!');
    console.log('\nData received:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testDashboardMetrics();
