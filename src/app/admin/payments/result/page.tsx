'use client';

import { CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { PaymentProviderSchema } from '@/modules/payments/domain/models/payment-gateway';
import { PaymentReturnUrlService } from '@/modules/payments/services/payment-return-url-service';
import { z } from 'zod';
import { PaymentResultHandler } from '@/modules/payments/components/payment-result-handler';
import { PaymentCancelHandler } from '@/modules/payments/components/payment-cancel-handler';
import { useSearchParams } from 'next/navigation';

const PaymentResultParamsSchema = z.object({
  provider: PaymentProviderSchema.optional(),
  status: z.enum(['success', 'cancel', 'error']).optional(),
  origin_url: z.string().optional(),
  payment_id: z.string().optional(),
  session_id: z.string().optional(),
  token: z.string().optional(), // PayPal order token
  PayerID: z.string().optional(), // PayPal payer ID
});

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function PaymentResultPage() {
  const searchParams = useSearchParams();

  const rawParams = {
    provider: searchParams.get('provider'),
    status: searchParams.get('status'),
    origin_url: searchParams.get('origin_url'),
    payment_id: searchParams.get('payment_id'),
    session_id: searchParams.get('session_id'),
    token: searchParams.get('token'),
    PayerID: searchParams.get('PayerID'),
  };

  const validationResult = PaymentResultParamsSchema.safeParse(rawParams);

  if (!validationResult.success) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Payment Result</CardTitle>
            <CardDescription>The payment result parameters are invalid.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { provider, status, origin_url, payment_id, session_id, token, PayerID: _PayerID } = validationResult.data;

  // Decode origin URL safely
  const originUrl = origin_url ? PaymentReturnUrlService.decodeOriginUrl(origin_url) : null;
  const isSuccess = status === 'success';
  const providerName = provider === 'paypal' ? 'PayPal' : 'Stripe';

  const iconColor = isSuccess ? 'text-green-600' : 'text-orange-600';
  const bgColor = isSuccess ? 'bg-green-100' : 'bg-orange-100';
  const cardBgColor = isSuccess ? 'bg-green-50' : 'bg-orange-50';
  const textColor = isSuccess ? 'text-green-800' : 'text-orange-800';
  const mutedTextColor = isSuccess ? 'text-green-700' : 'text-orange-700';

  return (
    <>
      {/* Client-side handler for payment capture */}
      {isSuccess && provider && (
        <PaymentResultHandler
          provider={provider}
          orderId={token}
          sessionId={session_id}
        />
      )}

      {/* Client-side handler for payment cancellation and redirection */}
      {!isSuccess && provider && originUrl && (
        <PaymentCancelHandler
          provider={provider}
          originUrl={originUrl}
          paymentId={payment_id}
        />
      )}

      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className={`mx-auto w-16 h-16 ${bgColor} rounded-full flex items-center justify-center mb-4`}>
                {isSuccess ? (
                  <CheckCircle className={`w-8 h-8 ${iconColor}`} />
                ) : (
                  <XCircle className={`w-8 h-8 ${iconColor}`} />
                )}
              </div>
              <CardTitle className={`text-2xl ${iconColor}`}>
                {isSuccess ? `${providerName} Payment Successful!` : `${providerName} Payment Cancelled`}
              </CardTitle>
              <CardDescription>
                {isSuccess
                  ? `Your test payment has been processed successfully through ${providerName}.`
                  : `The test payment was cancelled or could not be completed.`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`${cardBgColor} p-4 rounded-lg`}>
                <h4 className={`font-medium ${textColor} mb-2`}>
                  {isSuccess ? 'Test Payment Completed' : 'Payment Not Completed'}
                </h4>
                <p className={`text-sm ${mutedTextColor}`}>
                  {isSuccess
                    ? `This was a test transaction. No real money was charged. Check your ${providerName} dashboard for transaction details.`
                    : originUrl
                      ? `The ${providerName} payment was cancelled. You will be redirected back to the previous page in a few seconds...`
                      : `The ${providerName} payment was cancelled by the user or failed to process. This is normal for testing purposes.`
                  }
                </p>
                {!isSuccess && originUrl && (
                  <div className="flex items-center mt-3">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm">Redirecting...</span>
                  </div>
                )}
                {session_id && (
                  <p className={`text-xs ${mutedTextColor} mt-2`}>
                    Session ID: {session_id}
                  </p>
                )}
                {token && (
                  <p className={`text-xs ${mutedTextColor} mt-2`}>
                    Order ID: {token}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {originUrl ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.location.href = originUrl}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Return to Previous Page
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.close()}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Close Window
                  </Button>
                )}
                <Link href="/admin/pays" className="flex-1">
                  <Button className="w-full">
                    Back to Payment Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}