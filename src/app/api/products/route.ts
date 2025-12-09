import { NextResponse } from 'next/server';
import { ProductSchema } from '@/lib/models/definitions';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

type SupabaseError = { code?: string; message?: string } | null;

// Alias for backward compatibility
const createServiceRoleClient = getAdminClient;

const isMissingFeaturedColumn = (error: SupabaseError) => {
  return Boolean(error?.code === '42703' && error?.message?.includes('is_featured'));
};

const missingFeaturedColumnMessage =
  'Supabase reports that the "is_featured" column is missing on the products table. ' +
  'Add it with `ALTER TABLE products ADD COLUMN is_featured boolean DEFAULT false;` to enable the featured carousel.';

const { rateLimitService } = createSecurityModule();

export async function GET(request: Request) {
  const guard = await rateLimitService.guard(request, 'api:products:get');

  if (!guard.result.allowed) {
    const response = NextResponse.json(
      rateLimitService.buildErrorPayload(guard.locale),
      { status: 429 },
    );

    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingFeaturedColumn(error)) {
        const response = NextResponse.json({ error: missingFeaturedColumnMessage }, { status: 400 });
        return rateLimitService.applyHeaders(response, guard.result);
      }

      console.error('Supabase error fetching products:', error);
      const response = NextResponse.json(
        { error: `Error fetching products: ${error.message}` },
        { status: 400 }
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const products = ProductSchema.array().parse(data ?? []);
    const response = NextResponse.json(products);
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    console.error('API /api/products error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    return rateLimitService.applyHeaders(response, guard.result);
  }
}
