'use client';

import { useEffect, useState } from 'react';

interface SubscriptionPaymentHandlerProps {
  orderId: string; // PayPal order token
  userId: string;
  planId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const SubscriptionPaymentHandler = ({
  orderId,
  userId,
  planId,
  onSuccess,
  onError,
}: SubscriptionPaymentHandlerProps) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const capturePayment = async () => {
      // Only process once
      if (processing) return;

      setProcessing(true);
      try {
        console.log('[SubscriptionPaymentHandler] Capturing PayPal subscription order:', orderId);

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
          throw new Error(errorData.error || 'Failed to capture PayPal subscription payment');
        }

        const result = await response.json();
        console.log('[SubscriptionPaymentHandler] PayPal capture successful:', result);

        // Payment captured successfully
        if (result.success) {
          console.log('[SubscriptionPaymentHandler] Subscription payment processed successfully');
          onSuccess?.();
        }
      } catch (err) {
        console.error('[SubscriptionPaymentHandler] PayPal capture error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to process subscription payment';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setProcessing(false);
      }
    };

    capturePayment();
  }, [orderId, userId, planId, processing, onSuccess, onError]);

  // Show error if capture failed
  if (error) {
    return (
      <div className="container mx-auto py-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">Subscription Payment Processing Error</h4>
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              Your payment may have been processed. Please refresh the page or contact support.
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
              <p className="text-sm text-blue-800">Processing your subscription payment...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

