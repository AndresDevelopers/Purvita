import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { z } from 'zod';
import { validateAffiliateCustomizationURL } from '@/lib/security/url-sanitizer';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/affiliate/store-settings
 *
 * Updates affiliate store customization settings with security validations.
 * Both MLM and Affiliate subscription types can customize their store.
 *
 * Validations:
 * - CSRF protection
 * - Ownership verification (user must own the referral code)
 * - Active subscription verification (MLM or Affiliate)
 * - URL validation for banner and logo
 *
 * Security:
 * - Requires authentication
 * - Validates ownership of referral code
 * - Revalidates subscription status before saving (prevents expired subscription abuse)
 * - Sanitizes URLs to prevent XSS
 */

const StoreSettingsSchema = z.object({
  storeTitle: z.string().max(100).nullable(),
  bannerUrl: z.string().url().max(500).nullable(),
  logoUrl: z.string().url().max(500).nullable(),
  referralCode: z.string().min(1).max(50),
  // Optional custom slug for the public affiliate store URL. When omitted, the
  // existing slug remains unchanged; when null/empty, the slug is cleared.
  storeSlug: z.string().max(50).nullable().optional(),
});

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  const userId = request.user.id;

  try {
    const body = await request.json();
    const { storeTitle, bannerUrl, logoUrl, referralCode, storeSlug } = StoreSettingsSchema.parse(body);

    const supabase = await createClient();

    // ✅ SECURITY: Verify ownership of referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, referral_code')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.referral_code?.toLowerCase() !== referralCode.toLowerCase()) {
      console.warn('[Store Settings] Unauthorized access attempt', {
        userId,
        providedCode: referralCode,
        actualCode: profile.referral_code,
      });

      return NextResponse.json(
        { error: 'Unauthorized: Not the owner of this affiliate store' },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Verify active subscription (MLM or Affiliate - both can customize store)
    // Use the same supabase client that already has the user session from withAuth
    // RLS policy allows users to read their own subscriptions (auth.uid() = user_id)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status, subscription_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('[Store Settings] Error checking subscription:', subError);
      return NextResponse.json(
        { error: 'Error verifying subscription status' },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'Active subscription required to customize store' },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Validate URLs
    if (bannerUrl) {
      const bannerValidation = validateAffiliateCustomizationURL(bannerUrl, 'Banner URL');
      if (!bannerValidation.isValid) {
        return NextResponse.json(
          { error: bannerValidation.error || 'Invalid banner URL' },
          { status: 400 }
        );
      }
    }

    if (logoUrl) {
      const logoValidation = validateAffiliateCustomizationURL(logoUrl, 'Logo URL');
      if (!logoValidation.isValid) {
        return NextResponse.json(
          { error: logoValidation.error || 'Invalid logo URL' },
          { status: 400 }
        );
      }
    }

    // Normalize and validate optional store slug
    let normalizedSlug: string | null | undefined = undefined;

    if (storeSlug === null) {
      // Explicitly clear slug
      normalizedSlug = null;
    } else if (typeof storeSlug === 'string') {
      const trimmed = storeSlug.trim();
      if (trimmed.length === 0) {
        // Empty string is treated as clearing the slug
        normalizedSlug = null;
      } else {
        const candidate = trimmed.toLowerCase();

        if (!/^[a-z0-9-]+$/.test(candidate)) {
          return NextResponse.json(
            { error: 'Store URL slug must use only lowercase letters, numbers, and hyphens.' },
            { status: 400 }
          );
        }

        if (candidate.length < 3 || candidate.length > 30) {
          return NextResponse.json(
            { error: 'Store URL slug must be between 3 and 30 characters.' },
            { status: 400 }
          );
        }

        normalizedSlug = candidate;
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, string | null> = {};
    
    if (storeTitle !== undefined) {
      updateData.affiliate_store_title = storeTitle;
    }
    if (bannerUrl !== undefined) {
      updateData.affiliate_store_banner_url = bannerUrl;
    }
    if (logoUrl !== undefined) {
      updateData.affiliate_store_logo_url = logoUrl;
    }
    if (normalizedSlug !== undefined) {
      updateData.affiliate_store_slug = normalizedSlug;
    }

    // Update profile with store settings
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('[Store Settings] Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to save store settings' },
        { status: 500 }
      );
    }

    console.log('[Store Settings] Successfully updated settings for user:', userId);

    return NextResponse.json({
      success: true,
      message: 'Store settings saved successfully'
    });
  } catch (error) {
    console.error('[Store Settings] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update store settings' },
      { status: 500 }
    );
  }
});
