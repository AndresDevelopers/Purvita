
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { getServiceRoleClient } from '@/lib/supabase';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { moderateContent } from '@/lib/security/content-moderation';
import DOMPurify from 'isomorphic-dompurify';

import type { SupabaseClient } from '@supabase/supabase-js';

const { rateLimitService } = createSecurityModule();

// ✅ SECURITY: Sanitize comment to prevent XSS attacks
const reviewInputSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  comment: z.string()
    .trim()
    .min(1, 'Comment is required')
    .max(2000, 'Comment must be less than 2000 characters')
    .transform((val) => {
      // Strip ALL HTML tags - reviews should be plain text only
      const sanitized = DOMPurify.sanitize(val, {
        ALLOWED_TAGS: [], // No HTML tags allowed
        ALLOWED_ATTR: [], // No attributes allowed
      });
      return sanitized.trim();
    }),
});

const slugParamSchema = z.object({
  slug: z.string().min(1),
});

type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ReviewResponse = {
  id: string;
  userId: string | null;
  rating: number;
  comment: string;
  createdAt: string | null;
  author: string;
  avatarUrl: string | null;
  source: 'member';
};

const mapReviewRow = (row: ReviewRow, profile?: ProfileRow | null): ReviewResponse => {
  const author = profile?.name?.trim() || profile?.email?.trim() || 'Customer';

  return {
    id: row.id,
    userId: row.user_id,
    rating: typeof row.rating === 'number' ? row.rating : 0,
    comment: row.comment ?? '',
    createdAt: row.created_at,
    author,
    avatarUrl: profile?.avatar_url ?? null,
    source: 'member',
  };
};

const getServerClient = async (): Promise<SupabaseClient> => {
  const serviceClient = getServiceRoleClient();
  if (serviceClient) {
    return serviceClient;
  }

  const fallbackClient = await createServerSupabaseClient();
  return fallbackClient;
};

const fetchProductId = async (client: SupabaseClient, slug: string): Promise<string> => {
  const { data, error } = await client
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Response(null, { status: 404 });
    }

    throw new Error(`Error fetching product: ${error.message}`);
  }

  if (!data?.id) {
    throw new Response(null, { status: 404 });
  }

  return data.id as string;
};

const fetchReviews = async (client: SupabaseClient, productId: string, _isAuthenticated: boolean): Promise<ReviewResponse[]> => {
  const dataClient = getServiceRoleClient() ?? client;
  const { data: rows, error } = await dataClient
    .from('product_reviews')
    .select('id, product_id, user_id, rating, comment, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching product reviews: ${error.message}`);
  }

  const reviewRows: ReviewRow[] = rows ?? [];
  const userIds = Array.from(
    new Set(
      reviewRows
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profiles = new Map<string, ProfileRow>();

  if (userIds.length > 0) {
    const profileClient = getServiceRoleClient() ?? client;
    const { data: profileRows, error: profileError } = await profileClient
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', userIds);

    if (profileError) {
      throw new Error(`Error fetching review authors: ${profileError.message}`);
    }

    for (const profile of profileRows ?? []) {
      profiles.set(profile.id, profile as ProfileRow);
    }
  }

  return reviewRows.map((row) => mapReviewRow(row, row.user_id ? profiles.get(row.user_id) : undefined));
};

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const guard = await rateLimitService.guard(request, 'api:products:reviews:get');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), { status: 429 });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    const params = await context.params;
    const { slug } = slugParamSchema.parse(params);
    const client = await getServerClient();

    // Check if user is authenticated
    const { data: { user } } = await client.auth.getUser();
    const isAuthenticated = Boolean(user);

    const productId = await fetchProductId(client, slug);
    const reviews = await fetchReviews(client, productId, isAuthenticated);
    const response = NextResponse.json({ reviews });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('GET /api/products/[slug]/reviews error:', error);
    const fallback = NextResponse.json({ reviews: [] }, { status: 200 });
    return rateLimitService.applyHeaders(fallback, guard.result);
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const guard = await rateLimitService.guard(request, 'api:products:reviews:post');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), { status: 429 });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(request);
    if (csrfError) return csrfError;
    const params = await context.params;
    const { slug } = slugParamSchema.parse(params);
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const response = NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const payload = reviewInputSchema.parse(await request.json());
    
    // ✅ SECURITY: Check for blocked words in review content
    const moderation = await moderateContent(payload.comment);
    if (moderation.isBlocked) {
      const response = NextResponse.json(
        { 
          error: 'Your review contains inappropriate content and cannot be submitted.',
          blockedCategories: moderation.categories,
        },
        { status: 400 }
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }
    
    const serviceClient = getServiceRoleClient();
    const productId = await fetchProductId(serviceClient ?? supabase, slug);
    const insertClient = serviceClient ?? supabase;

    const { data, error } = await insertClient
      .from('product_reviews')
      .insert({
        product_id: productId,
        user_id: user.id,
        rating: payload.rating,
        comment: payload.comment,
      })
      .select('id, product_id, user_id, rating, comment, created_at')
      .single();

    if (error) {
      // Check for unique constraint violation (user already reviewed this product)
      if (error.code === '23505') {
        const response = NextResponse.json(
          { error: 'You have already reviewed this product. You can edit your existing review.' },
          { status: 409 }
        );
        return rateLimitService.applyHeaders(response, guard.result);
      }
      throw new Error(`Error saving product review: ${error.message}`);
    }

    const reviewRow = data as ReviewRow;

    let profile: ProfileRow | undefined;
    if (user.id) {
      const profileClient = serviceClient ?? supabase;
      const { data: profileRow } = await profileClient
        .from('profiles')
        .select('id, name, email, avatar_url')
        .eq('id', user.id)
        .single();
      profile = profileRow as ProfileRow | undefined;
    }

    const response = NextResponse.json({ review: mapReviewRow(reviewRow, profile) }, { status: 201 });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: error.message }, { status: 400 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    console.error('POST /api/products/[slug]/reviews error:', error);
    const response = NextResponse.json({ error: 'Unable to save product review.' }, { status: 500 });
    return rateLimitService.applyHeaders(response, guard.result);
  }
}
