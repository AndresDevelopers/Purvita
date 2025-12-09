import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOrdersAndTracking() {
  console.log('🔍 Checking orders and warehouse tracking...\n');

  // Check if orders table exists and has data
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, user_id, status, total_cents, created_at')
    .limit(10);

  if (ordersError) {
    console.error('❌ Error fetching orders:', ordersError.message);
  } else {
    console.log(`✅ Found ${orders?.length || 0} orders`);
    if (orders && orders.length > 0) {
      console.log('\nSample orders:');
      orders.forEach((order) => {
        console.log(`  - Order ${order.id.slice(0, 8)}: ${order.status}, $${(order.total_cents / 100).toFixed(2)}`);
      });
    }
  }

  // Check if warehouse_tracking_entries table exists
  const { data: trackingEntries, error: trackingError } = await supabase
    .from('warehouse_tracking_entries')
    .select('id, order_id, status, tracking_code, created_at')
    .limit(10);

  if (trackingError) {
    console.error('\n❌ Error fetching warehouse tracking entries:', trackingError.message);
  } else {
    console.log(`\n✅ Found ${trackingEntries?.length || 0} warehouse tracking entries`);
    if (trackingEntries && trackingEntries.length > 0) {
      console.log('\nSample tracking entries:');
      trackingEntries.forEach((entry) => {
        console.log(`  - Entry ${entry.id.slice(0, 8)}: Order ${entry.order_id.slice(0, 8)}, Status: ${entry.status}`);
      });
    }
  }

  // Check if warehouse_tracking_admin_view exists
  const { data: viewData, error: viewError } = await supabase
    .from('warehouse_tracking_admin_view')
    .select('id, order_id, status, customer_name')
    .limit(5);

  if (viewError) {
    console.error('\n❌ Error fetching from warehouse_tracking_admin_view:', viewError.message);
    console.log('\n⚠️  The view might not exist. Run the migration:');
    console.log('   supabase/migrations/20241024_create_warehouse_tracking_admin_view.sql');
  } else {
    console.log(`\n✅ warehouse_tracking_admin_view exists with ${viewData?.length || 0} entries`);
  }

  console.log('\n✨ Check complete!');
}

checkOrdersAndTracking().catch(console.error);
