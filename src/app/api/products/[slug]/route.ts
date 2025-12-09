import { NextResponse } from 'next/server';
import { ProductSchema } from '@/lib/models/definitions';
import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error('Supabase error:', error);
      }
      return NextResponse.json(
        { error: `Error fetching product: ${error.message}` },
        { status: 400 }
      );
    }

    const product = ProductSchema.parse(data);
    return NextResponse.json(product);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('API error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}