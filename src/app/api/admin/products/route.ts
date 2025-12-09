import { NextResponse } from 'next/server';
import { ProductSchema } from '@/lib/models/definitions';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

/**
 * GET /api/admin/products
 * Get all products
 * Requires: manage_products permission
 */
export const GET = withAdminPermission('manage_products', async () => {
  try {
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: `Error fetching products: ${error.message}` },
        { status: 400 }
      );
    }

    const products = ProductSchema.array().parse(data ?? []);
    return NextResponse.json(products);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
