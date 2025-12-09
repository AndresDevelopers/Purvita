'use client';

import { useEffect, useState } from 'react';
import { PaymentReturnUrlService } from '../services/payment-return-url-service';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentCancelHandlerProps {
  provider: PaymentProvider;
  originUrl?: string | null; // Decoded origin URL
  paymentId?: string;
}

/**
 * Component that handles automatic redirection when a payment is cancelled.
 * Redirects the user back to the origin URL (checkout page) after a short delay.
 */
export const PaymentCancelHandler = ({ 
  provider, 
  originUrl,
  paymentId 
}: PaymentCancelHandlerProps) => {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const redirectToOrigin = async () => {
      // Only redirect once
      if (redirecting) return;

      setRedirecting(true);

      try {
        // Default to homepage if no origin URL
        const targetUrl = originUrl || '/';

        // Build return URL with cancelled status
        const returnUrl = PaymentReturnUrlService.buildReturnUrlWithStatus(
          targetUrl,
          'cancelled',
          provider,
          {
            ...(paymentId && { payment_id: paymentId }),
          }
        );

        console.log('[PaymentCancelHandler] Redirecting to:', returnUrl);

        // Clean up sessionStorage
        try {
          sessionStorage.removeItem('payment_return_url');
          sessionStorage.removeItem('paypal_payment_metadata');
        } catch (storageError) {
          console.error('[PaymentCancelHandler] Failed to clean up sessionStorage:', storageError);
        }

        // Delay to show the cancellation message (3 seconds)
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 3000);

      } catch (err) {
        console.error('[PaymentCancelHandler] Redirect error:', err);
        // Fallback to homepage
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    redirectToOrigin();
  }, [provider, originUrl, paymentId, redirecting]);

  // This component doesn't render anything visible
  // The cancellation message is shown by the parent page
  return null;
};

