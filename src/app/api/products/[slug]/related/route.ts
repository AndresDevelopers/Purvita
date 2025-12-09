import { NextResponse } from 'next/server';
import { ProductSchema } from '@/lib/models/definitions';
import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

// Alias for backward compatibility
const createServiceRoleClient = getAdminClient;

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .neq('slug', slug)
      .limit(3);

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Supabase error fetching related products:', error);
      }
      return NextResponse.json(
        { error: `Error fetching related products: ${error.message}` },
        { status: 400 }
      );
    }

    const products = ProductSchema.array().parse(data ?? []);
    return NextResponse.json(products);
  } catch (_error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('API /api/products/[slug]/related error:', _error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}