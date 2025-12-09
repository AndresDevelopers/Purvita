'use client';

import { useEffect, useState } from 'react';
import { PaymentReturnUrlService } from '../services/payment-return-url-service';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentSuccessHandlerProps {
  provider: PaymentProvider;
  orderId?: string; // PayPal order token
  sessionId?: string; // Stripe session ID
  originUrl?: string | null; // Decoded origin URL
  paymentId?: string;
}

export const PaymentSuccessHandler = ({ 
  provider, 
  orderId, 
  sessionId, 
  originUrl,
  paymentId 
}: PaymentSuccessHandlerProps) => {
  const [processing, setProcessing] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const processPaymentAndRedirect = async () => {
      // Only process once
      if (processing || redirecting) return;

      setProcessing(true);

      try {
        // Process PayPal payment capture
        if (provider === 'paypal' && orderId) {
          console.log('[PaymentSuccessHandler] Capturing PayPal payment:', orderId);

          // Retrieve metadata from sessionStorage if available
          let metadata: Record<string, unknown> | undefined;
          try {
            const storedMetadata = sessionStorage.getItem('paypal_payment_metadata');
            if (storedMetadata) {
              metadata = JSON.parse(storedMetadata);
              // Clear it after retrieval
              sessionStorage.removeItem('paypal_payment_metadata');
              console.log('[PaymentSuccessHandler] Retrieved payment metadata from session');
            }
          } catch (storageError) {
            console.error('[PaymentSuccessHandler] Failed to retrieve metadata:', storageError);
          }

          const response = await fetch('/api/payments/paypal/capture-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId,
              metadata,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to capture PayPal payment');
          }

          const result = await response.json();
          console.log('[PaymentSuccessHandler] PayPal capture result:', result);

          if (!result.success) {
            throw new Error(result.error || 'PayPal capture failed');
          }
        }

        // For Stripe, check if this is a setup session (payment method update)
        if (provider === 'stripe' && sessionId) {
          console.log('[PaymentSuccessHandler] Stripe session completed:', sessionId);
          
          // Check if this is a setup session by looking at the metadata
          // Setup sessions are used for payment method updates
          try {
            const response = await fetch('/api/subscription/setup-complete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId,
              }),
            });

            if (response.ok) {
              console.log('[PaymentSuccessHandler] Setup session processed successfully');
            } else {
              // If it's not a setup session, that's okay - it might be a regular subscription
              console.log('[PaymentSuccessHandler] Not a setup session or already processed');
            }
          } catch (setupError) {
            console.error('[PaymentSuccessHandler] Setup session processing error:', setupError);
            // Continue anyway - the webhook might handle it
          }
        }

        // Wait a moment for webhooks to process
        console.log('[PaymentSuccessHandler] Waiting for webhook processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Redirect to origin URL
        await redirectToOrigin();

      } catch (err) {
        console.error('[PaymentSuccessHandler] Payment processing error:', err);
        setError(err instanceof Error ? err.message : 'Failed to process payment');
        
        // Even if processing fails, try to redirect after a delay
        setTimeout(() => {
          redirectToOrigin();
        }, 3000);
      } finally {
        setProcessing(false);
      }
    };

    const redirectToOrigin = async () => {
      if (redirecting) return;

      setRedirecting(true);

      try {
        const targetUrl = originUrl || '/';

        // Build return URL with success status
        const returnUrl = PaymentReturnUrlService.buildReturnUrlWithStatus(
          targetUrl,
          'success',
          provider,
          {
            ...(paymentId && { payment_id: paymentId }),
            ...(sessionId && { session_id: sessionId }),
            ...(orderId && { order_id: orderId }),
          }
        );

        console.log('[PaymentSuccessHandler] Redirecting to:', returnUrl);

        // Clean up sessionStorage
        try {
          sessionStorage.removeItem('payment_return_url');
        } catch (storageError) {
          console.error('[PaymentSuccessHandler] Failed to clean up sessionStorage:', storageError);
        }

        // Small delay to show success message
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 1500);

      } catch (err) {
        console.error('[PaymentSuccessHandler] Redirect error:', err);
        // Fallback to homepage
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      }
    };

    processPaymentAndRedirect();
  }, [provider, orderId, sessionId, originUrl, paymentId, processing, redirecting]);

  // This component doesn't render anything visible
  // The processing state is shown by the parent page
  return null;
};
