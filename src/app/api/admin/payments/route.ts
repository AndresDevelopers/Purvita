import { NextResponse } from 'next/server';
import {
  PaymentGatewaySettingsSchema,
  PaymentGatewayUpdateInputSchema,
} from '@/modules/payments/domain/models/payment-gateway';
import { createPaymentGatewayRepository, PAYMENT_GATEWAY_REQUIRED_ENV } from '@/lib/factories/payment-gateway-factory';
import { handleApiError } from '@/lib/utils/api-error-handler';
import { detectMissingSupabaseEnv, formatMissingSupabaseEnvMessage } from '@/lib/utils/supabase-env';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAdminPermission('manage_payments', async () => {
  try {
    const missingKeys = detectMissingSupabaseEnv(PAYMENT_GATEWAY_REQUIRED_ENV);

    if (missingKeys.length > 0) {
      console.warn(`[Payments API] ${formatMissingSupabaseEnvMessage(missingKeys)}`);
      return NextResponse.json([]);
    }

    const repository = createPaymentGatewayRepository();
    const settings = await repository.listSettings();
    return NextResponse.json(PaymentGatewaySettingsSchema.array().parse(settings));
  } catch (error) {
    return handleApiError(error, 'Unable to load payment gateway settings');
  }
});

export const PUT = withAdminPermission('manage_payments', async (request: Request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const missingKeys = detectMissingSupabaseEnv(PAYMENT_GATEWAY_REQUIRED_ENV);

    if (missingKeys.length > 0) {
      const message = formatMissingSupabaseEnvMessage(missingKeys);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    const body = await request.json();
    const input = PaymentGatewayUpdateInputSchema.parse(body);

    const repository = createPaymentGatewayRepository();
    const updated = await repository.updateSettings(input);

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated payment gateway configuration',
      {
        ...extractRequestMetadata(request),
        action: 'update_payment_config',
        resourceType: 'payment_config',
        provider: input.provider,
        status: input.status,
      },
      true
    );

    return NextResponse.json(PaymentGatewaySettingsSchema.parse(updated));
  } catch (error) {
    return handleApiError(error, 'Unable to update payment gateway');
  }
});
