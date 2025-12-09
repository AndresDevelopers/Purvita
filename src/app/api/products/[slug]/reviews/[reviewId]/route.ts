import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { getServiceRoleClient } from '@/lib/supabase';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import DOMPurify from 'isomorphic-dompurify';

const { rateLimitService } = createSecurityModule();

const paramsSchema = z.object({
  slug: z.string().min(1),
  reviewId: z.string().uuid(),
});

const reviewUpdateSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  comment: z.string()
    .trim()
    .min(1, 'Comment is required')
    .max(2000, 'Comment must be less than 2000 characters')
    .transform((val) => {
      const sanitized = DOMPurify.sanitize(val, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
      return sanitized.trim();
    }),
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

/**
 * PUT /api/products/[slug]/reviews/[reviewId]
 * Update a review (only by the owner)
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string; reviewId: string }> }
) {
  const guard = await rateLimitService.guard(request, 'api:products:reviews:put');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), { status: 429 });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    const csrfError = await requireCsrfToken(request);
    if (csrfError) return csrfError;

    const params = await context.params;
    const { reviewId } = paramsSchema.parse(params);

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const response = NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const serviceClient = getServiceRoleClient();
    const client = serviceClient ?? supabase;

    // Verify the review belongs to the user
    const { data: existingReview, error: fetchError } = await client
      .from('product_reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existingReview) {
      const response = NextResponse.json({ error: 'Review not found.' }, { status: 404 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    if (existingReview.user_id !== user.id) {
      const response = NextResponse.json({ error: 'You can only edit your own reviews.' }, { status: 403 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const payload = reviewUpdateSchema.parse(await request.json());

    const { data, error } = await client
      .from('product_reviews')
      .update({
        rating: payload.rating,
        comment: payload.comment,
      })
      .eq('id', reviewId)
      .select('id, product_id, user_id, rating, comment, created_at')
      .single();

    if (error) {
      throw new Error(`Error updating review: ${error.message}`);
    }

    const reviewRow = data as ReviewRow;

    let profile: ProfileRow | undefined;
    const { data: profileRow } = await client
      .from('profiles')
      .select('id, name, email, avatar_url')
      .eq('id', user.id)
      .single();
    profile = profileRow as ProfileRow | undefined;

    const response = NextResponse.json({ review: mapReviewRow(reviewRow, profile) }, { status: 200 });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: error.message }, { status: 400 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    console.error('PUT /api/products/[slug]/reviews/[reviewId] error:', error);
    const response = NextResponse.json({ error: 'Unable to update review.' }, { status: 500 });
    return rateLimitService.applyHeaders(response, guard.result);
  }
}

/**
 * DELETE /api/products/[slug]/reviews/[reviewId]
 * Delete a review (only by the owner)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string; reviewId: string }> }
) {
  const guard = await rateLimitService.guard(request, 'api:products:reviews:delete');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), { status: 429 });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    const csrfError = await requireCsrfToken(request);
    if (csrfError) return csrfError;

    const params = await context.params;
    const { reviewId } = paramsSchema.parse(params);

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const response = NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const serviceClient = getServiceRoleClient();
    const client = serviceClient ?? supabase;

    // Verify the review belongs to the user
    const { data: existingReview, error: fetchError } = await client
      .from('product_reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existingReview) {
      const response = NextResponse.json({ error: 'Review not found.' }, { status: 404 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    if (existingReview.user_id !== user.id) {
      const response = NextResponse.json({ error: 'You can only delete your own reviews.' }, { status: 403 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const { error } = await client
      .from('product_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      throw new Error(`Error deleting review: ${error.message}`);
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: error.message }, { status: 400 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    console.error('DELETE /api/products/[slug]/reviews/[reviewId] error:', error);
    const response = NextResponse.json({ error: 'Unable to delete review.' }, { status: 500 });
    return rateLimitService.applyHeaders(response, guard.result);
  }
}
