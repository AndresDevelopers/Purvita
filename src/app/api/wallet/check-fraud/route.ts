import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

/**
 * POST /api/wallet/check-fraud
 * Check wallet for fraud indicators
 * This endpoint can be called before major transactions to detect suspicious activity
 */
export async function POST(_req: NextRequest) {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(_req);
  if (csrfError) return csrfError;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();
    const walletService = new WalletService(adminClient);

    // Check for fraud indicators
    const fraudCheck = await walletService.checkFraudIndicators(user.id);

    // If risk score is high, create an alert
    if (fraudCheck.shouldFlagForReview) {
      const { error: alertError } = await adminClient
        .from('wallet_fraud_alerts')
        .insert({
          user_id: user.id,
          risk_score: fraudCheck.riskScore,
          risk_level: fraudCheck.riskLevel,
          risk_factors: fraudCheck.riskFactors,
          fraud_stats: fraudCheck.stats,
          status: 'pending',
        });

      if (alertError) {
        console.error('[FraudCheck] Failed to create fraud alert:', alertError);
      }
    }

    return NextResponse.json({
      riskScore: fraudCheck.riskScore,
      riskLevel: fraudCheck.riskLevel,
      riskFactors: fraudCheck.riskFactors,
      flaggedForReview: fraudCheck.shouldFlagForReview,
      message: fraudCheck.shouldFlagForReview
        ? 'This transaction has been flagged for review due to suspicious activity patterns'
        : 'No suspicious activity detected',
    });
  } catch (error) {
    console.error('[FraudCheck] Failed to check fraud indicators:', error);
    return NextResponse.json(
      { error: 'Failed to check fraud indicators' },
      { status: 500 }
    );
  }
}
