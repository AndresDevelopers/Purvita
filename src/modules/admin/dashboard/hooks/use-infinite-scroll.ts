'use client';

import { useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
  enabled?: boolean;
  rootMargin?: string;
}

export const useInfiniteScroll = (
  onLoadMore: () => void,
  { enabled = true, rootMargin = '120px' }: UseInfiniteScrollOptions = {},
) => {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!enabled || !node) {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              onLoadMore();
            }
          });
        },
        { root: null, rootMargin, threshold: 0.1 },
      );

      observerRef.current.observe(node);
    },
    [enabled, onLoadMore, rootMargin],
  );

  return sentinelRef;
};
