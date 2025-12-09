'use client';

import { CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentProviderSchema } from '@/modules/payments/domain/models/payment-gateway';
import { PaymentReturnUrlService } from '@/modules/payments/services/payment-return-url-service';
import { z } from 'zod';
import { PaymentSuccessHandler } from '@/modules/payments/components/payment-success-handler';
import { PaymentCancelHandler } from '@/modules/payments/components/payment-cancel-handler';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const PaymentResultParamsSchema = z.object({
  provider: PaymentProviderSchema.nullable().optional(),
  status: z.enum(['success', 'cancel', 'error']).nullable().optional(),
  origin_url: z.string().nullable().optional(),
  payment_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  token: z.string().nullable().optional(), // PayPal order token
  PayerID: z.string().nullable().optional(), // PayPal payer ID
});

function PaymentResultContent() {
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

  console.log('[PaymentResult] Raw params:', rawParams);
  console.log('[PaymentResult] Validation result:', validationResult);

  if (!validationResult.success) {
    console.error('[PaymentResult] Validation failed:', validationResult.error);
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Payment Result</CardTitle>
            <CardDescription>The payment result parameters are invalid.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/'}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { provider, status, origin_url, payment_id, session_id, token, PayerID: _PayerID } = validationResult.data;

  // Decode origin URL safely
  const originUrl = origin_url ? PaymentReturnUrlService.decodeOriginUrl(origin_url) : null;
  const isSuccess = status === 'success';
  const providerName = provider === 'paypal' ? 'PayPal' : provider === 'stripe' ? 'Stripe' : 'Payment Gateway';

  const iconColor = isSuccess ? 'text-green-600' : 'text-orange-600';
  const bgColor = isSuccess ? 'bg-green-100' : 'bg-orange-100';
  const cardBgColor = isSuccess ? 'bg-green-50' : 'bg-orange-50';
  const textColor = isSuccess ? 'text-green-800' : 'text-orange-800';
  const mutedTextColor = isSuccess ? 'text-green-700' : 'text-orange-700';

  return (
    <>
      {/* Client-side handler for payment processing and redirection */}
      {isSuccess && provider && (
        <PaymentSuccessHandler
          provider={provider}
          orderId={token ?? undefined}
          sessionId={session_id ?? undefined}
          originUrl={originUrl}
          paymentId={payment_id ?? undefined}
        />
      )}

      {/* Client-side handler for payment cancellation and redirection */}
      {!isSuccess && provider && (
        <PaymentCancelHandler
          provider={provider}
          originUrl={originUrl}
          paymentId={payment_id ?? undefined}
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
                  ? `Your payment has been processed successfully through ${providerName}.`
                  : `The payment was cancelled or could not be completed.`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`${cardBgColor} p-4 rounded-lg`}>
                <h4 className={`font-medium ${textColor} mb-2`}>
                  {isSuccess ? 'Payment Processing' : 'Payment Not Completed'}
                </h4>
                <p className={`text-sm ${mutedTextColor}`}>
                  {isSuccess
                    ? `We're processing your payment and will redirect you back shortly. Please wait...`
                    : `The ${providerName} payment was cancelled. You will be redirected back to the checkout page in a few seconds...`
                  }
                </p>
                {isSuccess && (
                  <div className="flex items-center mt-3">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm">Processing payment...</span>
                  </div>
                )}
                {!isSuccess && (
                  <div className="flex items-center mt-3">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm">Redirecting...</span>
                  </div>
                )}
                
                {/* Payment details */}
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
                {payment_id && (
                  <p className={`text-xs ${mutedTextColor} mt-2`}>
                    Payment ID: {payment_id}
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
                    onClick={() => window.location.href = '/'}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go to Homepage
                  </Button>
                )}
                
                {!isSuccess && (
                  <Button 
                    className="flex-1"
                    onClick={() => window.location.href = originUrl || '/'}
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Loading Payment Result...</CardTitle>
              <CardDescription>Please wait while we process your payment information.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    }>
      <PaymentResultContent />
    </Suspense>
  );
}
