import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { PhaseLevelUpdateSchema } from '@/modules/phase-levels/domain/models/phase-level';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

/**
 * PUT /api/admin/phase-levels/[id]
 * Update a phase level
 * Requires: manage_settings permission
 */
export const PUT = withAdminPermission('manage_settings', async (request, context) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const params = await (context?.params as Promise<{ id: string }>);
    const { id } = params;
    // Use admin client to bypass RLS policies for system settings
    const supabase = createAdminClient();
    const body = await request.json();

    const validated = PhaseLevelUpdateSchema.parse(body);

    // Build update object with only defined values
    const updateData: Record<string, any> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.nameEn !== undefined) updateData.name_en = validated.nameEn;
    if (validated.nameEs !== undefined) updateData.name_es = validated.nameEs;
    if (validated.commissionRate !== undefined) updateData.commission_rate = validated.commissionRate;
    if (validated.subscriptionDiscountRate !== undefined) updateData.subscription_discount_rate = validated.subscriptionDiscountRate;
    if (validated.affiliateSponsorCommissionRate !== undefined) updateData.affiliate_sponsor_commission_rate = validated.affiliateSponsorCommissionRate;
    if (validated.creditCents !== undefined) updateData.credit_cents = validated.creditCents;
    if (validated.freeProductValueCents !== undefined) updateData.free_product_value_cents = validated.freeProductValueCents;
    if (validated.isActive !== undefined) updateData.is_active = validated.isActive;
    if (validated.displayOrder !== undefined) updateData.display_order = validated.displayOrder;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      // Fetch current data and return it
      const { data: fetchedData, error: fetchError } = await supabase
        .from('phase_levels')
        .select()
        .eq('id', id);

      const currentData = fetchedData?.[0];

      if (fetchError || !currentData) {
        console.error('[API] Failed to fetch phase level:', fetchError);
        return NextResponse.json({ error: 'Phase level not found' }, { status: 404 });
      }

      return NextResponse.json({
        phaseLevel: {
          id: currentData.id,
          level: currentData.level,
          name: currentData.name,
          nameEn: currentData.name_en,
          nameEs: currentData.name_es,
          commissionRate: Number(currentData.commission_rate),
          subscriptionDiscountRate: Number(currentData.subscription_discount_rate ?? 0),
          affiliateSponsorCommissionRate: Number(currentData.affiliate_sponsor_commission_rate ?? 0),
          creditCents: currentData.credit_cents,
          freeProductValueCents: currentData.free_product_value_cents ?? (currentData.level === 1 ? 6500 : 0),
          isActive: currentData.is_active,
          displayOrder: currentData.display_order,
          createdAt: currentData.created_at,
          updatedAt: currentData.updated_at,
        },
      });
    }

    const { data, error } = await supabase
      .from('phase_levels')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json({
        error: 'Failed to update phase level',
        details: error.message,
      }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Phase level not found' }, { status: 404 });
    }

    const updatedPhase = data[0];

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated phase level',
      {
        ...extractRequestMetadata(request),
        action: 'update_phase_level',
        resourceType: 'phase_level',
        phaseLevelId: id,
        changes: validated,
      },
      true
    );

    return NextResponse.json({
      phaseLevel: {
        id: updatedPhase.id,
        level: updatedPhase.level,
        name: updatedPhase.name,
        nameEn: updatedPhase.name_en,
        nameEs: updatedPhase.name_es,
        commissionRate: Number(updatedPhase.commission_rate),
        subscriptionDiscountRate: Number(updatedPhase.subscription_discount_rate ?? 0),
        affiliateSponsorCommissionRate: Number(updatedPhase.affiliate_sponsor_commission_rate ?? 0),
        creditCents: updatedPhase.credit_cents,
        freeProductValueCents: updatedPhase.free_product_value_cents ?? (updatedPhase.level === 1 ? 6500 : 0),
        isActive: updatedPhase.is_active,
        displayOrder: updatedPhase.display_order,
        createdAt: updatedPhase.created_at,
        updatedAt: updatedPhase.updated_at,
      },
    });
  } catch (error) {
    // Check if it's a Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({
        error: 'Validation error',
        details: error,
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
});

/**
 * DELETE /api/admin/phase-levels/[id]
 * Delete a phase level
 * Requires: manage_settings permission
 */
export const DELETE = withAdminPermission('manage_settings', async (request, context) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const params = await (context?.params as Promise<{ id: string }>);
    const { id } = params;
    // Use admin client to bypass RLS policies - admin already verified by withAdminPermission
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('phase_levels')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API] Failed to delete phase level:', error);
      return NextResponse.json({ error: 'Failed to delete phase level' }, { status: 500 });
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Deleted phase level',
      {
        ...extractRequestMetadata(request),
        action: 'delete_phase_level',
        resourceType: 'phase_level',
        phaseLevelId: id,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error in DELETE /api/admin/phase-levels/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
