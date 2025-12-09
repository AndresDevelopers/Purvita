import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { CommissionCalculatorService } from '@/modules/multilevel/services/commission-calculator-service';
import { withAdminAuth } from '@/lib/auth/with-auth';

/**
 * POST /api/orders/demo/generate
 * Generate demo orders for testing
 * Requires: Admin authentication (access_admin_panel permission)
 */
export const POST = withAdminAuth(async (_request) => {
  console.log('=== Generate Demo Orders API called ===');
  try {
    const supabaseAdmin = await createAdminClient();
    console.log('Admin client created');

    // Get some regular users to create demo orders for
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'user')
      .limit(5);
    
    console.log('Regular users fetched:', users?.length || 0);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users', details: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log('No regular users available, using admin user for demo orders');
    }

    // Get some products to use in demo orders
    const { data: products, error: productsError } = await supabaseAdmin.from('products').select('id, name, price').limit(10);
    
    console.log('Products fetched:', products?.length || 0);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json({ error: 'Failed to fetch products', details: productsError.message }, { status: 500 });
    }

    if (!products || products.length === 0) {
      console.log('No products available');
      return NextResponse.json({ error: 'No products available. Please create products first.' }, { status: 400 });
    }

    const statuses = ['paid', 'pending', 'canceled'];
    const gateways = ['stripe', 'paypal', 'wallet'];
    const ordersToCreate = 5;
    const createdOrders = [];

    // Check if gateway and gateway_transaction_id columns exist in orders table
    let gatewayColumnExists = false;
    let gatewayTransactionIdColumnExists = false;
    try {
      const { data: columns, error: columnError } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'orders')
        .in('column_name', ['gateway', 'gateway_transaction_id']);
      
      if (!columnError && columns) {
        gatewayColumnExists = columns.some(col => col.column_name === 'gateway');
        gatewayTransactionIdColumnExists = columns.some(col => col.column_name === 'gateway_transaction_id');
      }
      
      console.log('Gateway column exists:', gatewayColumnExists);
      console.log('Gateway transaction ID column exists:', gatewayTransactionIdColumnExists);
    } catch (checkError) {
      console.warn('Could not check for gateway columns:', checkError);
      // Assume they exist and let the insert handle the error
      gatewayColumnExists = true;
      gatewayTransactionIdColumnExists = true;
    }

    for (let i = 0; i < ordersToCreate; i++) {
      // Random status and gateway
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const gateway = gateways[Math.floor(Math.random() * gateways.length)];

      // Use random user from available users, fallback to first user or admin
      const targetUser = users && users.length > 0
        ? users[Math.floor(Math.random() * users.length)]
        : { id: _request.user.id };

      // Random number of items (1-3)
      const itemCount = Math.floor(Math.random() * 3) + 1;
      const orderItems = [];
      let totalCents = 0;

      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 3) + 1;
        // Convert price (decimal) to cents (integer)
        const priceCents = product.price ? Math.round(parseFloat(product.price.toString()) * 100) : Math.floor(Math.random() * 10000) + 1000;

        orderItems.push({
          product_id: product.id,
          qty,
          price_cents: priceCents,
        });

        totalCents += priceCents * qty;
      }

      // Create order - handle gateway columns gracefully
      const orderData: any = {
        user_id: targetUser.id,
        status,
        total_cents: totalCents,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last 30 days
      };

      // Only include gateway fields if columns exist
      if (gatewayColumnExists) {
        orderData.gateway = gateway;
      }
      if (gatewayTransactionIdColumnExists) {
        orderData.gateway_transaction_id = status === 'paid' ? `demo_${gateway}_${Date.now()}_${i}` : null;
      }
      
      console.log('Creating order with data:', orderData);
      
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error('Error creating demo order:', orderError);
        console.error('Order data that failed:', orderData);
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      // Create order items
      const itemsToInsert = orderItems.map((item) => ({
        order_id: order.id,
        ...item,
      }));

      const { error: itemsError } = await supabaseAdmin.from('order_items').insert(itemsToInsert);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      }

      // Calculate and create network commissions for paid orders
      if (status === 'paid') {
        try {
          const commissionService = new CommissionCalculatorService(supabaseAdmin);
          const commissions = await commissionService.calculateAndCreateCommissions(
            targetUser.id,
            totalCents,
            { orderId: order.id }
          );
          console.log(`Created ${commissions.length} commission entries for order ${order.id}`);
        } catch (commError) {
          console.error('Error creating commissions:', commError);
          // Don't fail the order creation if commissions fail
        }
      }

      createdOrders.push(order);
    }

    return NextResponse.json({
      success: true,
      count: createdOrders.length,
      message: `Successfully created ${createdOrders.length} demo orders`,
    });
  } catch (error) {
    console.error('Error generating demo orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error details:', { errorMessage, errorStack });
    return NextResponse.json({
      error: 'Failed to generate demo orders',
      details: errorMessage
    }, { status: 500 });
  }
})
