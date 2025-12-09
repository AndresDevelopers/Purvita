import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { PhaseLevelSchema, PhaseLevelCreateSchema } from '@/modules/phase-levels/domain/models/phase-level';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * GET /api/admin/phase-levels
 * Get all phase levels
 * Requires: manage_settings permission
 */
export const GET = withAdminPermission('manage_settings', async () => {
  try {
    // Use admin client to bypass RLS policies - admin already verified by withAdminPermission
    const supabase = createAdminClient();

    const { data: phaseLevels, error } = await supabase
      .from('phase_levels')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[API] Failed to fetch phase levels:', error);
      return NextResponse.json({ error: 'Failed to fetch phase levels' }, { status: 500 });
    }

    const validated = phaseLevels.map((level) =>
      PhaseLevelSchema.parse({
        id: level.id,
        level: level.level,
        name: level.name,
        nameEn: level.name_en,
        nameEs: level.name_es,
        commissionRate: Number(level.commission_rate),
        subscriptionDiscountRate: Number(level.subscription_discount_rate ?? 0),
        affiliateSponsorCommissionRate: Number(level.affiliate_sponsor_commission_rate ?? 0),
        creditCents: level.credit_cents,
        freeProductValueCents: level.free_product_value_cents ?? (level.level === 1 ? 6500 : 0),
        isActive: level.is_active,
        displayOrder: level.display_order,
        createdAt: level.created_at,
        updatedAt: level.updated_at,
      }),
    );

    return NextResponse.json({ phaseLevels: validated });
  } catch (error) {
    console.error('[API] Error in GET /api/admin/phase-levels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * POST /api/admin/phase-levels
 * Create a new phase level
 * Requires: manage_settings permission
 */
export const POST = withAdminPermission('manage_settings', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    // Use admin client to bypass RLS policies for system settings
    const supabase = createAdminClient();
    const body = await request.json();

    const validated = PhaseLevelCreateSchema.parse(body);

    const { data, error } = await supabase
      .from('phase_levels')
      .insert({
        level: validated.level,
        name: validated.name,
        name_en: validated.nameEn,
        name_es: validated.nameEs,
        commission_rate: validated.commissionRate,
        subscription_discount_rate: validated.subscriptionDiscountRate,
        affiliate_sponsor_commission_rate: validated.affiliateSponsorCommissionRate,
        credit_cents: validated.creditCents,
        free_product_value_cents: validated.freeProductValueCents,
        is_active: validated.isActive,
        display_order: validated.displayOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to create phase level:', error);
      return NextResponse.json({ error: 'Failed to create phase level' }, { status: 500 });
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Created phase level',
      {
        ...extractRequestMetadata(request),
        action: 'create_phase_level',
        resourceType: 'phase_level',
        phaseLevelId: data.id,
        level: validated.level,
        commissionRate: validated.commissionRate,
      },
      true
    );

    return NextResponse.json({
      phaseLevel: {
        id: data.id,
        level: data.level,
        name: data.name,
        nameEn: data.name_en,
        nameEs: data.name_es,
        commissionRate: Number(data.commission_rate),
        subscriptionDiscountRate: Number(data.subscription_discount_rate ?? 0),
        affiliateSponsorCommissionRate: Number(data.affiliate_sponsor_commission_rate ?? 0),
        creditCents: data.credit_cents,
        freeProductValueCents: data.free_product_value_cents ?? (data.level === 1 ? 6500 : 0),
        isActive: data.is_active,
        displayOrder: data.display_order,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error in POST /api/admin/phase-levels:', error);

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
