import { createClient } from '@/lib/supabase/server';

/**
 * Get user marketing data for Mailchimp
 * This includes purchase history, preferences, and activity data
 */
export async function getUserMarketingData(userId: string) {
  try {
    const supabase = await createClient();

    // Get user's privacy settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('allow_personalized_recommendations, created_at')
      .eq('id', userId)
      .single();

    // If user hasn't allowed personalized recommendations, return null
    if (!profile?.allow_personalized_recommendations) {
      return null;
    }

    // Get order statistics
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_cents, created_at, order_items(product_id, quantity)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!orders || orders.length === 0) {
      return {
        topProducts: 'No purchases yet',
        accountAge: calculateAccountAge(profile.created_at),
        totalOrders: 0,
        lastOrderDate: 'Never',
        preferredCategories: 'Not determined',
      };
    }

    // Calculate top products
    const productCounts: Record<string, number> = {};
    orders.forEach(order => {
      order.order_items?.forEach((item: any) => {
        const productId = item.product_id;
        productCounts[productId] = (productCounts[productId] || 0) + (item.quantity || 1);
      });
    });

    // Get top 3 products
    const topProductIds = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id);

    // Get product names
    let topProductsText = 'Various products';
    if (topProductIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('name')
        .in('id', topProductIds);

      if (products && products.length > 0) {
        topProductsText = products.map(p => p.name).join(', ');
      }
    }

    // Calculate account age
    const accountAge = calculateAccountAge(profile.created_at);

    // Get last order date
    const lastOrderDate = orders[0]?.created_at 
      ? new Date(orders[0].created_at).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      : 'Unknown';

    return {
      topProducts: topProductsText,
      accountAge,
      totalOrders: orders.length,
      lastOrderDate,
      preferredCategories: 'Health & Wellness', // Could be calculated from product categories
    };
  } catch (error) {
    console.error('Error getting user marketing data:', error);
    return null;
  }
}

/**
 * Calculate how long the account has been active
 */
function calculateAccountAge(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} days`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  }
}
