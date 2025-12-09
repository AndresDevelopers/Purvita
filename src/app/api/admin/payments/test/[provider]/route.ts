import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/utils/api-error-handler';
import { PaymentTestingService } from '@/modules/payments/services/payment-testing';
import { AdminAuthService } from '@/lib/services/admin-auth-service';
import type { PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';
import type { TestPaymentRequest } from '@/modules/payments/types/payment-types';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const { provider } = await params;

    // Verify admin access and manage_payments permission
    await AdminAuthService.verifyAdminPermission('manage_payments');

    // Validate provider
    if (provider !== 'paypal' && provider !== 'stripe') {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    // Parse and validate request
    const body = await request.json();
    const testRequest: TestPaymentRequest = {
      amount: parseFloat(body.amount) || 10.00,
      currency: body.currency || 'USD',
      description: body.description || `Test payment - ${provider}`,
      scenario: body.scenario || 'basic',
    };

    // Extract originUrl from request body
    const originUrl = body.originUrl as string | undefined;

    // Validate amount
    if (testRequest.amount <= 0 || testRequest.amount > 10000) {
      return NextResponse.json({
        error: 'Invalid amount. Must be between $0.01 and $10,000.00'
      }, { status: 400 });
    }

    // Create test payment with originUrl
    const result = await PaymentTestingService.createTestPayment(
      provider as PaymentProvider,
      testRequest,
      undefined, // credentials
      originUrl
    );

    console.log(`Test payment created for ${provider}:`, {
      testId: result.testId,
      amount: result.amount,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Payment test error:', error);
    return handleApiError(error, 'Payment test failed');
  }
}