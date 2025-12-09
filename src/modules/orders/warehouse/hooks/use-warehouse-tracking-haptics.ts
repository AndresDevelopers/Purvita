'use client';

import { useCallback } from 'react';

type HapticEvent = 'load' | 'create' | 'error';

const vibrate = (pattern: number | number[]) => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  if (!('vibrate' in navigator)) {
    return;
  }

  navigator.vibrate(pattern);
};

export const useWarehouseTrackingHaptics = () => {
  return useCallback((event: HapticEvent) => {
    switch (event) {
      case 'load':
        vibrate([10, 20]);
        break;
      case 'create':
        vibrate([12, 24, 12]);
        break;
      case 'error':
        vibrate([16, 12, 16, 24]);
        break;
      default:
        break;
    }
  }, []);
};
