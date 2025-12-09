import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/phase-levels/commission?phase=1
 * Get commission rate for a specific phase
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phaseParam = searchParams.get('phase');

    if (!phaseParam) {
      return NextResponse.json(
        { error: 'Phase parameter is required' },
        { status: 400 }
      );
    }

    const phase = parseInt(phaseParam, 10);

    if (isNaN(phase) || phase < 0) {
      return NextResponse.json(
        { error: 'Invalid phase number' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Get phase level configuration
    const { data: phaseLevel, error } = await supabaseAdmin
      .from('phase_levels')
      .select('commission_rate')
      .eq('level', phase)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[API] Error fetching phase level:', error);
      return NextResponse.json(
        { error: 'Failed to fetch phase level' },
        { status: 500 }
      );
    }

    // If no phase level found, return default commission rate from app settings
    if (!phaseLevel) {
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .select('ecommerce_commission_rate')
        .single();

      if (settingsError) {
        console.error('[API] Error fetching app settings:', settingsError);
        return NextResponse.json(
          { error: 'Failed to fetch default commission rate' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        phase,
        commissionRate: Number(settings.ecommerce_commission_rate),
        isDefault: true,
      });
    }

    return NextResponse.json({
      phase,
      commissionRate: Number(phaseLevel.commission_rate),
      isDefault: false,
    });
  } catch (error) {
    console.error('[API] Error in GET /api/admin/phase-levels/commission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

