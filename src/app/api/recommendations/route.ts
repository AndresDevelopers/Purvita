import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase';
import type { Product } from '@/lib/models/definitions';

/**
 * GET /api/recommendations
 * 
 * Returns personalized product recommendations for the authenticated user.
 * Respects the user's privacy setting: allow_personalized_recommendations
 * 
 * Query params:
 * - limit: number of recommendations (default: 4, max: 12)
 * - exclude: comma-separated product IDs to exclude
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = Math.min(parseInt(searchParams.get('limit') || '4'), 12);
    const excludeParam = searchParams.get('exclude') || '';
    const excludeIds = excludeParam ? excludeParam.split(',').filter(Boolean) : [];

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // Return popular products for non-authenticated users
      return getPopularProducts(limit, excludeIds);
    }

    // Check user's privacy setting
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('allow_personalized_recommendations')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[Recommendations] Error fetching profile:', profileError);
      return getPopularProducts(limit, excludeIds);
    }

    // If user disabled personalized recommendations, return popular products
    if (!profile?.allow_personalized_recommendations) {
      return getPopularProducts(limit, excludeIds);
    }

    // Get user's purchase history
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('order_items(product_id, quantity)')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(50);

    if (ordersError) {
      console.error('[Recommendations] Error fetching orders:', ordersError);
      return getPopularProducts(limit, excludeIds);
    }

    // Extract purchased product IDs with quantities
    const purchasedProducts: Record<string, number> = {};
    orders?.forEach(order => {
      const items = order.order_items as Array<{ product_id: string; quantity: number }> | null;
      items?.forEach(item => {
        if (item.product_id) {
          purchasedProducts[item.product_id] = (purchasedProducts[item.product_id] || 0) + (item.quantity || 1);
        }
      });
    });

    const purchasedProductIds = Object.keys(purchasedProducts);

    // If no purchase history, return popular products
    if (purchasedProductIds.length === 0) {
      return getPopularProducts(limit, excludeIds);
    }

    // Get categories of purchased products
    const serviceClient = getServiceRoleClient();
    const client = serviceClient ?? supabase;

    const { data: purchasedProductsData, error: productsError } = await client
      .from('products')
      .select('id, category, tags')
      .in('id', purchasedProductIds);

    if (productsError) {
      console.error('[Recommendations] Error fetching purchased products:', productsError);
      return getPopularProducts(limit, excludeIds);
    }

    // Extract categories and tags from purchased products
    const categories = new Set<string>();
    const tags = new Set<string>();
    
    purchasedProductsData?.forEach(product => {
      if (product.category) categories.add(product.category);
      if (Array.isArray(product.tags)) {
        product.tags.forEach((tag: string) => tags.add(tag));
      }
    });

    // Build recommendation query - find products in same categories/tags, excluding already purchased
    const allExcludeIds = [...new Set([...excludeIds, ...purchasedProductIds])];
    
    let query = client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .not('id', 'in', `(${allExcludeIds.join(',')})`)
      .order('created_at', { ascending: false });

    // If we have categories, filter by them
    if (categories.size > 0) {
      query = query.in('category', Array.from(categories));
    }

    const { data: recommendations, error: recError } = await query.limit(limit);

    if (recError) {
      console.error('[Recommendations] Error fetching recommendations:', recError);
      return getPopularProducts(limit, excludeIds);
    }

    // If not enough recommendations from categories, fill with popular products
    if (!recommendations || recommendations.length < limit) {
      const existingIds = recommendations?.map(p => p.id) || [];
      const remaining = limit - (recommendations?.length || 0);
      const popularResponse = await getPopularProductsData(remaining, [...allExcludeIds, ...existingIds]);
      
      return NextResponse.json({
        recommendations: [...(recommendations || []), ...popularResponse],
        personalized: true,
        source: 'hybrid',
      });
    }

    return NextResponse.json({
      recommendations: recommendations as Product[],
      personalized: true,
      source: 'purchase_history',
    });
  } catch (error) {
    console.error('[Recommendations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

/**
 * Get popular products (fallback when no personalization)
 */
async function getPopularProducts(limit: number, excludeIds: string[]): Promise<NextResponse> {
  const products = await getPopularProductsData(limit, excludeIds);
  
  return NextResponse.json({
    recommendations: products,
    personalized: false,
    source: 'popular',
  });
}

/**
 * Get popular products data
 */
async function getPopularProductsData(limit: number, excludeIds: string[]): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceRoleClient();
    const client = serviceClient ?? supabase;

    let query = client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error('[Recommendations] Error fetching popular products:', error);
      return [];
    }

    return (data || []) as Product[];
  } catch (error) {
    console.error('[Recommendations] Error in getPopularProductsData:', error);
    return [];
  }
}
