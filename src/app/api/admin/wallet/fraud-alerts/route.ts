import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/wallet/fraud-alerts
 * Get all wallet fraud alerts
 */
export async function GET(req: NextRequest) {
  const authCheck = await verifyAdminAuth();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  if (!authCheck.permissions?.permissions.includes('manage_security')) {
    return NextResponse.json(
      { error: 'Forbidden: manage_security permission required' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const riskLevel = searchParams.get('riskLevel');

    const adminClient = await createAdminClient();

    let query = adminClient
      .from('wallet_fraud_alerts')
      .select(`
        *,
        profiles:user_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (riskLevel && riskLevel !== 'all') {
      query = query.eq('risk_level', riskLevel);
    }

    const { data: alerts, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      alerts: alerts || [],
      total: alerts?.length || 0,
    });
  } catch (error) {
    console.error('[FraudAlerts] Failed to fetch fraud alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fraud alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/wallet/fraud-alerts/[id]/review
 * Review and update status of a fraud alert
 */
export async function POST(req: NextRequest) {
  // ✅ SECURITY: Validate CSRF token
  const { requireCsrfToken } = await import('@/lib/security/csrf-protection');
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  const authCheck = await verifyAdminAuth();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  if (!authCheck.permissions?.permissions.includes('manage_security')) {
    return NextResponse.json(
      { error: 'Forbidden: manage_security permission required' },
      { status: 403 }
    );
  }

  if (!authCheck.user) {
    return NextResponse.json(
      { error: 'User information not available' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { alertId, status, notes } = body;

    if (!alertId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: alertId, status' },
        { status: 400 }
      );
    }

    if (!['reviewed', 'cleared', 'confirmed_fraud'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: reviewed, cleared, or confirmed_fraud' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    const { data: alert, error } = await adminClient
      .from('wallet_fraud_alerts')
      .update({
        status,
        reviewed_by: authCheck.user.id,
        reviewed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('[FraudAlerts] Failed to update fraud alert:', error);
    return NextResponse.json(
      { error: 'Failed to update fraud alert' },
      { status: 500 }
    );
  }
}
