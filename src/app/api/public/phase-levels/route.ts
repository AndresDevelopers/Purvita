import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Public endpoint to fetch phase levels configuration
 * Used by the Teams page to display dynamic benefit values
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: phaseLevels, error } = await supabase
      .from('phase_levels')
      .select('level, commission_rate, credit_cents, free_product_value_cents')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[API] Failed to fetch phase levels:', error);
      return NextResponse.json({ error: 'Failed to fetch phase levels' }, { status: 500 });
    }

    // Map to camelCase and return only necessary fields
    const mapped = phaseLevels.map((level) => ({
      level: level.level,
      commissionRate: Number(level.commission_rate),
      creditCents: level.credit_cents,
      freeProductValueCents: level.free_product_value_cents ?? 0,
    }));

    return NextResponse.json({ phaseLevels: mapped });
  } catch (error) {
    console.error('[API] Error in GET /api/public/phase-levels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

