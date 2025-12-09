'use client';

import { useEffect, useRef, useState } from 'react';

export interface PullToRefreshState {
  status: 'idle' | 'armed' | 'triggered';
  distance: number;
}

interface UsePullToRefreshOptions {
  threshold?: number;
  enabled?: boolean;
}

const defaultState: PullToRefreshState = {
  status: 'idle',
  distance: 0,
};

export const usePullToRefresh = (
  refresh: () => Promise<void> | void,
  { threshold = 80, enabled = true }: UsePullToRefreshOptions = {},
): PullToRefreshState => {
  const [state, setState] = useState<PullToRefreshState>(defaultState);
  const refreshingRef = useRef(false);
  const triggeredRef = useRef(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = event.touches[0]?.clientY ?? null;
      triggeredRef.current = false;
      setState(defaultState);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startYRef.current === null) {
        return;
      }
      const currentY = event.touches[0]?.clientY ?? 0;
      const distance = currentY - startYRef.current;
      if (distance <= 0) {
        setState(defaultState);
        return;
      }

      if (distance > threshold && !triggeredRef.current && !refreshingRef.current) {
        triggeredRef.current = true;
        refreshingRef.current = true;
        setState({ status: 'triggered', distance });
        Promise.resolve(refresh()).finally(() => {
          refreshingRef.current = false;
        });
        return;
      }

      setState({ status: triggeredRef.current ? 'triggered' : 'armed', distance });
    };

    const handleTouchEnd = () => {
      startYRef.current = null;
      triggeredRef.current = false;
      setState(defaultState);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, refresh, threshold]);

  return state;
};
