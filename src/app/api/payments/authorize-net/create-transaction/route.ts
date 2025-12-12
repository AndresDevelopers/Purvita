import { NextResponse } from 'next/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { z } from 'zod';
import { PaymentError } from '@/modules/payments/utils/payment-errors';
import { AuthorizeNetPlugin } from '@/modules/payments/plugins/authorize-net-plugin';
import { fetchGatewayCredentials, isErrorResponse } from '@/modules/payments/utils/payment-gateway-helpers';
import type { PaymentCredentials } from '@/modules/payments/core/payment-plugin.interface';

const CreateTransactionSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().default('USD'),
    description: z.string(),
    isTest: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
    try {
        const csrfError = await requireCsrfToken(request);
        if (csrfError) {
            return csrfError;
        }

        const body = await request.json();
        const { amount, currency, description, isTest, metadata } = CreateTransactionSchema.parse(body);

        // Fetch credentials
        const credentialsResult = await fetchGatewayCredentials<PaymentCredentials>('authorize_net', isTest);

        if (isErrorResponse(credentialsResult)) {
            return credentialsResult;
        }

        const { credentials } = credentialsResult;

        // Initialize Plugin
        const plugin = new AuthorizeNetPlugin();

        // Create Payment
        const paymentResponse = await plugin.createPayment({
            amount,
            currency,
            description,
            isTest: !!isTest,
            metadata,
        }, credentials);

        return NextResponse.json(paymentResponse);

    } catch (error) {
        console.error('Authorize.net transaction error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid request data',
                    details: error.flatten().fieldErrors,
                },
                { status: 400 },
            );
        }

        if (error instanceof PaymentError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: 422 },
            );
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Transaction failed' },
            { status: 500 },
        );
    }
}
