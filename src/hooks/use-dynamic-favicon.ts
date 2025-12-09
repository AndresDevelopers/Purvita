import { useEffect } from 'react';

export function useDynamicFavicon(faviconUrl: string | null | undefined) {
  useEffect(() => {
    if (!faviconUrl) return;

    // Get or create favicon link elements
    const updateFavicon = (selector: string, rel: string) => {
      let link = document.querySelector(selector) as HTMLLinkElement;
      
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      
      link.href = faviconUrl;
      
      // Set type based on file extension
      if (faviconUrl.endsWith('.svg')) {
        link.type = 'image/svg+xml';
      } else if (faviconUrl.endsWith('.ico')) {
        link.type = 'image/x-icon';
      } else if (faviconUrl.endsWith('.png')) {
        link.type = 'image/png';
      }
    };

    // Update all favicon variants
    updateFavicon('link[rel="icon"]', 'icon');
    updateFavicon('link[rel="shortcut icon"]', 'shortcut icon');
    updateFavicon('link[rel="apple-touch-icon"]', 'apple-touch-icon');

    // Cleanup function to restore original favicon
    return () => {
      // Note: We don't restore the original favicon on unmount
      // because these views replace the entire page
    };
  }, [faviconUrl]);
}
