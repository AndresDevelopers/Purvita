'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Hook to clean up Tawk.to widget when navigating away from products pages.
 * This ensures the chat widget only appears on product-related pages.
 */
export function useTawkCleanup() {
  const pathname = usePathname();
  const isProductsPage = pathname?.includes('/products');

  useEffect(() => {
    // Only clean up when NOT on products pages
    if (isProductsPage) {
      return;
    }

    // Small delay to ensure navigation is complete
    const timeoutId = setTimeout(() => {
      // Remove all Tawk.to scripts
      document.querySelectorAll('script[src*="tawk.to"]').forEach((el) => el.remove());

      // Remove Tawk.to widget container and iframes
      document.querySelectorAll('[id*="tawk"], [class*="tawk"], iframe[src*="tawk"]').forEach((el) => el.remove());

      // Also remove by common Tawk.to element IDs
      ['tawk-tooltip-container', 'tawk-bubble-container', 'tawk-notification-container'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      // Remove Tawk.to global variables and hide widget
      if (typeof window !== 'undefined') {
         
        const win = window as any;
        if (win.Tawk_API?.hideWidget) {
          try { win.Tawk_API.hideWidget(); } catch { /* ignore */ }
        }
        delete win.Tawk_API;
        delete win.Tawk_LoadStart;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isProductsPage]);
}
