'use client';

import { useEffect, useState } from 'react';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentResultHandlerProps {
  provider: PaymentProvider;
  orderId?: string; // PayPal order token
  sessionId?: string; // Stripe session ID
}

export const PaymentResultHandler = ({ provider, orderId, sessionId }: PaymentResultHandlerProps) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const capturePayment = async () => {
      // Only process once
      if (processing) return;

      // PayPal requires order capture
      if (provider === 'paypal' && orderId) {
        setProcessing(true);
        try {
          console.log('[PaymentResultHandler] Capturing PayPal order:', orderId);
          
          const response = await fetch('/api/payments/paypal/capture-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId,
              isTest: true, // Detect from environment or credentials
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to capture PayPal payment');
          }

          const result = await response.json();
          console.log('[PaymentResultHandler] PayPal capture successful:', result);

          // Show success message or redirect
          if (result.success) {
            // Payment captured successfully
            console.log('[PaymentResultHandler] Payment processed successfully');
          }
        } catch (err) {
          console.error('[PaymentResultHandler] PayPal capture error:', err);
          setError(err instanceof Error ? err.message : 'Failed to process payment');
        } finally {
          setProcessing(false);
        }
      }

      // Stripe payments are automatically captured when the session completes
      // The webhook handles the rest
      if (provider === 'stripe' && sessionId) {
        console.log('[PaymentResultHandler] Stripe payment completed, session:', sessionId);
        // No additional action needed for Stripe
      }
    };

    capturePayment();
  }, [provider, orderId, sessionId, processing]);

  // Show error if capture failed
  if (error) {
    return (
      <div className="container mx-auto py-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">Payment Processing Error</h4>
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              Your payment may have been processed. Please check your account or contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show processing indicator
  if (processing) {
    return (
      <div className="container mx-auto py-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-sm text-blue-800">Processing your payment...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

