'use client';

import { useEffect, useState } from 'react';
import { PaymentReturnUrlService } from '../services/payment-return-url-service';

interface SubscriptionReturnHandlerProps {
  orderId?: string; // PayPal order token
  sessionId?: string; // Stripe session ID
  userId: string;
  planId?: string;
  originUrl?: string | null; // Decoded origin URL
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const SubscriptionReturnHandler = ({ 
  orderId, 
  sessionId, 
  userId,
  planId,
  originUrl,
  onSuccess,
  onError
}: SubscriptionReturnHandlerProps) => {
  const [processing, setProcessing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const processSubscriptionAndRedirect = async () => {
      // Only process once
      if (processing || redirecting) return;

      setProcessing(true);

      try {
        // Process PayPal subscription payment capture
        if (orderId) {
          console.log('[SubscriptionReturnHandler] Capturing PayPal subscription payment:', orderId);
          
          const response = await fetch('/api/payments/paypal/capture-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              orderId,
              isTest: true // This should be determined from environment
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to capture PayPal subscription payment');
          }

          const result = await response.json();
          console.log('[SubscriptionReturnHandler] PayPal capture result:', result);

          if (!result.success) {
            throw new Error(result.error || 'PayPal subscription capture failed');
          }
        }

        // For Stripe subscriptions, the webhook handles everything automatically
        if (sessionId) {
          console.log('[SubscriptionReturnHandler] Stripe subscription completed, session:', sessionId);
          // We could optionally verify the session status here
        }

        // Wait a moment for webhooks to process
        console.log('[SubscriptionReturnHandler] Waiting for webhook processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Call success callback
        if (onSuccess) {
          onSuccess();
        }

        // Redirect to origin URL
        await redirectToOrigin();

      } catch (err) {
        console.error('[SubscriptionReturnHandler] Subscription processing error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to process subscription payment';
        
        if (onError) {
          onError(errorMessage);
        }
        
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
        const targetUrl = originUrl || '/subscription';
        
        // Build return URL with success status
        const returnUrl = PaymentReturnUrlService.buildReturnUrlWithStatus(
          targetUrl,
          'success',
          orderId ? 'paypal' : 'stripe',
          {
            subscription: 'activated',
            ...(planId && { plan_id: planId }),
            ...(sessionId && { session_id: sessionId }),
            ...(orderId && { order_id: orderId }),
          }
        );

        console.log('[SubscriptionReturnHandler] Redirecting to:', returnUrl);
        
        // Small delay to show success message
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 2000);

      } catch (err) {
        console.error('[SubscriptionReturnHandler] Redirect error:', err);
        // Fallback to subscription page
        setTimeout(() => {
          window.location.href = '/subscription?subscription=activated';
        }, 2000);
      }
    };

    processSubscriptionAndRedirect();
  }, [orderId, sessionId, userId, planId, originUrl, onSuccess, onError, processing, redirecting]);

  // This component doesn't render anything visible
  // The processing state is shown by the parent page
  return null;
};
