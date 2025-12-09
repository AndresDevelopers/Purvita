import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/utils/api-error-handler';
import { PaymentTestingService } from '@/modules/payments/services/payment-testing';
import { AdminAuthService } from '@/lib/services/admin-auth-service';
import type { PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';
import type { GatewayCredentialEnvironment } from '@/modules/payments/services/gateway-credentials-service';
import { PaymentError } from '@/modules/payments/utils/payment-errors';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
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

    const body = await request.json().catch(() => ({}));
    const { credentials, environment } = body as {
      credentials?: Record<string, unknown>;
      environment?: GatewayCredentialEnvironment;
    };

    const targetEnvironment: GatewayCredentialEnvironment = environment === 'test' ? 'test' : 'live';

    try {
      let validationResult;

      if (credentials) {
        // Validate provided credentials
        validationResult = await PaymentTestingService.validateCredentials(
          provider as PaymentProvider,
          credentials,
          targetEnvironment,
        );
      } else {
        // Validate stored credentials
        validationResult = await PaymentTestingService.validateCredentials(
          provider as PaymentProvider,
          undefined,
          targetEnvironment,
        );
      }

      return NextResponse.json({
        isValid: validationResult.isValid,
        errors: validationResult.errors ?? [],
        details: validationResult,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        return NextResponse.json(
          {
            isValid: false,
            errors: [error.message],
            details: { environment: targetEnvironment },
          },
          { status: 422 },
        );
      }

      return NextResponse.json({
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
      });
    }
  } catch (error) {
    console.error('Payment validation error:', error);
    return handleApiError(error, 'Payment validation failed');
  }
}
