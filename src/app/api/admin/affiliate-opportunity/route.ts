import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { z } from 'zod';
import type { Locale } from '@/i18n/config';

// Schema for validating benefit items
const BenefitSchema = z.object({
  id: z.string().min(1),
  icon: z.string().max(60).nullable().optional(),
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(400),
  order: z.number().int().min(0).max(100).default(0),
});

// Schema for validating update input
const AffiliateOpportunityUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  title: z.string().min(1).max(180).optional(),
  subtitle: z.string().min(1).max(600).optional(),
  description: z.string().max(1200).nullable().optional(),
  benefits: z.array(BenefitSchema).max(8).optional(),
  commissionRate: z.string().max(60).nullable().optional(),
  commissionLabel: z.string().max(180).nullable().optional(),
  ctaText: z.string().min(1).max(120).optional(),
  ctaLink: z.string().min(1).max(500).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
});

/**
 * GET /api/admin/affiliate-opportunity?locale=es
 * Get affiliate opportunity content for a specific locale
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const locale = (searchParams.get('locale') || 'es') as Locale;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('affiliate_opportunity_content')
      .select('*')
      .eq('locale', locale)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[API] Failed to fetch affiliate opportunity content:', error);
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }

    // If no data found, return default structure
    if (!data) {
      return NextResponse.json({
        affiliateOpportunity: {
          isEnabled: true,
          title: locale === 'en' ? 'Affiliate Program' : 'Programa de Afiliados',
          subtitle: locale === 'en' 
            ? 'Earn commissions by promoting our products' 
            : 'Gana comisiones promocionando nuestros productos',
          description: null,
          benefits: [],
          commissionRate: null,
          commissionLabel: null,
          ctaText: locale === 'en' ? 'Join Now' : 'Únete Ahora',
          ctaLink: '/register',
          imageUrl: null,
        },
      });
    }

    return NextResponse.json({
      affiliateOpportunity: {
        isEnabled: data.is_enabled,
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        benefits: data.benefits || [],
        commissionRate: data.commission_rate,
        commissionLabel: data.commission_label,
        ctaText: data.cta_text,
        ctaLink: data.cta_link,
        imageUrl: data.image_url,
      },
    });
  } catch (error) {
    console.error('[API] Error in GET /api/admin/affiliate-opportunity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * PUT /api/admin/affiliate-opportunity?locale=es
 * Update affiliate opportunity content for a specific locale
 * Requires: manage_content permission
 */
export const PUT = withAdminPermission('manage_content', async (request) => {
  // Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const { searchParams } = new URL(request.url);
    const locale = (searchParams.get('locale') || 'es') as Locale;

    const body = await request.json();
    const validated = AffiliateOpportunityUpdateSchema.parse(body);

    const supabase = createAdminClient();

    // Build update object with only defined values
    const updateData: Record<string, unknown> = {};
    if (validated.isEnabled !== undefined) updateData.is_enabled = validated.isEnabled;
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.subtitle !== undefined) updateData.subtitle = validated.subtitle;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.benefits !== undefined) updateData.benefits = validated.benefits;
    if (validated.commissionRate !== undefined) updateData.commission_rate = validated.commissionRate;
    if (validated.commissionLabel !== undefined) updateData.commission_label = validated.commissionLabel;
    if (validated.ctaText !== undefined) updateData.cta_text = validated.ctaText;
    if (validated.ctaLink !== undefined) updateData.cta_link = validated.ctaLink;
    if (validated.imageUrl !== undefined) updateData.image_url = validated.imageUrl;

    // Check if record exists
    const { data: existing } = await supabase
      .from('affiliate_opportunity_content')
      .select('id')
      .eq('locale', locale)
      .single();

    let result;
    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('affiliate_opportunity_content')
        .update(updateData)
        .eq('locale', locale)
        .select()
        .single();

      if (error) {
        console.error('[API] Failed to update affiliate opportunity content:', error);
        return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
      }
      result = data;
    } else {
      // Insert new record with defaults
      const insertData = {
        locale,
        is_enabled: validated.isEnabled ?? true,
        title: validated.title ?? (locale === 'en' ? 'Affiliate Program' : 'Programa de Afiliados'),
        subtitle: validated.subtitle ?? (locale === 'en' 
          ? 'Earn commissions by promoting our products' 
          : 'Gana comisiones promocionando nuestros productos'),
        description: validated.description ?? null,
        benefits: validated.benefits ?? [],
        commission_rate: validated.commissionRate ?? null,
        commission_label: validated.commissionLabel ?? null,
        cta_text: validated.ctaText ?? (locale === 'en' ? 'Join Now' : 'Únete Ahora'),
        cta_link: validated.ctaLink ?? '/register',
        image_url: validated.imageUrl ?? null,
      };

      const { data, error } = await supabase
        .from('affiliate_opportunity_content')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[API] Failed to insert affiliate opportunity content:', error);
        return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({
      affiliateOpportunity: {
        isEnabled: result.is_enabled,
        title: result.title,
        subtitle: result.subtitle,
        description: result.description,
        benefits: result.benefits || [],
        commissionRate: result.commission_rate,
        commissionLabel: result.commission_label,
        ctaText: result.cta_text,
        ctaLink: result.cta_link,
        imageUrl: result.image_url,
      },
    });
  } catch (error) {
    console.error('[API] Error in PUT /api/admin/affiliate-opportunity:', error);

    // Check if it's a Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({
        error: 'Validation error',
        details: error,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
