'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getBrowserInfo,
  safeLocalStorage,
  safeSessionStorage,
  safeShare,
  safeVibrate,
  safeClipboardWrite,
  supportsTouchEvents,
  supportsBackdropFilter,
  supportsFlexGap,
  supportsSmoothScroll,
  isBrowser,
  isEdgeBrowser,
  isMobileBrowser,
  getSafeViewport,
  supportsPassiveEvents,
  supportsLazyLoading,
  prefersReducedMotion,
  prefersDarkMode,
  safeStructuredClone,
  safeRandomUUID,
} from '@/lib/utils/browser-compat';

interface BrowserInfo {
  name: string;
  version: string;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isChrome: boolean;
  isFirefox: boolean;
}

interface BrowserFeatures {
  localStorage: boolean;
  sessionStorage: boolean;
  share: boolean;
  vibration: boolean;
  clipboard: boolean;
  touch: boolean;
  backdropFilter: boolean;
  flexGap: boolean;
  smoothScroll: boolean;
  passiveEvents: boolean;
  lazyLoading: boolean;
  reducedMotion: boolean;
  darkMode: boolean;
}

interface UseBrowserCompatReturn {
  mounted: boolean;
  browser: BrowserInfo;
  features: BrowserFeatures;
  // Storage utilities
  getLocalItem: (key: string) => string | null;
  setLocalItem: (key: string, value: string) => boolean;
  removeLocalItem: (key: string) => boolean;
  getSessionItem: (key: string) => string | null;
  setSessionItem: (key: string, value: string) => boolean;
  removeSessionItem: (key: string) => boolean;
  // Navigator utilities
  share: (data: ShareData) => Promise<{ success: boolean; fallback?: 'clipboard' | 'none' }>;
  vibrate: (pattern: number | number[]) => boolean;
  copyToClipboard: (text: string) => Promise<boolean>;
  // Edge & Mobile utilities
  isEdge: boolean;
  isMobile: boolean;
  getViewport: () => { width: number; height: number; visualHeight: number };
  cloneObject: <T>(obj: T) => T;
  generateUUID: () => string;
}

const defaultBrowserInfo: BrowserInfo = {
  name: 'unknown',
  version: '0',
  isMobile: false,
  isIOS: false,
  isAndroid: false,
  isSafari: false,
  isEdge: false,
  isChrome: false,
  isFirefox: false,
};

const defaultFeatures: BrowserFeatures = {
  localStorage: false,
  sessionStorage: false,
  share: false,
  vibration: false,
  clipboard: false,
  touch: false,
  backdropFilter: true,
  flexGap: true,
  smoothScroll: true,
  passiveEvents: false,
  lazyLoading: true,
  reducedMotion: false,
  darkMode: false,
};

/**
 * Hook for browser compatibility detection and safe API usage
 * Ensures hydration safety and provides fallbacks for all browsers
 */
export function useBrowserCompat(): UseBrowserCompatReturn {
  const [mounted, setMounted] = useState(false);
  const [browser, setBrowser] = useState<BrowserInfo>(defaultBrowserInfo);
  const [features, setFeatures] = useState<BrowserFeatures>(defaultFeatures);

  useEffect(() => {
    setMounted(true);

    if (isBrowser) {
      // Detect browser info
      setBrowser(getBrowserInfo());

      // Detect feature support
      setFeatures({
        localStorage: safeLocalStorage.isAvailable(),
        sessionStorage: safeSessionStorage.isAvailable(),
        share: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
        vibration: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
        clipboard: typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function',
        touch: supportsTouchEvents(),
        backdropFilter: supportsBackdropFilter(),
        flexGap: supportsFlexGap(),
        smoothScroll: supportsSmoothScroll(),
        passiveEvents: supportsPassiveEvents(),
        lazyLoading: supportsLazyLoading(),
        reducedMotion: prefersReducedMotion(),
        darkMode: prefersDarkMode(),
      });
    }
  }, []);

  // Storage utilities
  const getLocalItem = useCallback((key: string) => {
    return safeLocalStorage.getItem(key);
  }, []);

  const setLocalItem = useCallback((key: string, value: string) => {
    return safeLocalStorage.setItem(key, value);
  }, []);

  const removeLocalItem = useCallback((key: string) => {
    return safeLocalStorage.removeItem(key);
  }, []);

  const getSessionItem = useCallback((key: string) => {
    return safeSessionStorage.getItem(key);
  }, []);

  const setSessionItem = useCallback((key: string, value: string) => {
    return safeSessionStorage.setItem(key, value);
  }, []);

  const removeSessionItem = useCallback((key: string) => {
    return safeSessionStorage.removeItem(key);
  }, []);

  // Navigator utilities
  const share = useCallback(async (data: ShareData) => {
    return safeShare(data);
  }, []);

  const vibrate = useCallback((pattern: number | number[]) => {
    return safeVibrate(pattern);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    return safeClipboardWrite(text);
  }, []);

  // Edge & Mobile utilities
  const getViewport = useCallback(() => {
    return getSafeViewport();
  }, []);

  const cloneObject = useCallback(<T,>(obj: T): T => {
    return safeStructuredClone(obj);
  }, []);

  const generateUUID = useCallback(() => {
    return safeRandomUUID();
  }, []);

  return {
    mounted,
    browser,
    features,
    getLocalItem,
    setLocalItem,
    removeLocalItem,
    getSessionItem,
    setSessionItem,
    removeSessionItem,
    share,
    vibrate,
    copyToClipboard,
    isEdge: mounted ? isEdgeBrowser() : false,
    isMobile: mounted ? isMobileBrowser() : false,
    getViewport,
    cloneObject,
    generateUUID,
  };
}

/**
 * Hook specifically for storage operations with type-safe JSON handling
 */
export function useStorage<T>(
  key: string,
  initialValue: T,
  type: 'local' | 'session' = 'session'
): [T, (value: T) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (!isBrowser) return;

    try {
      const storage = type === 'local' ? safeLocalStorage : safeSessionStorage;
      const item = storage.getItem(key);
      
      if (item) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.warn(`[useStorage] Error reading ${key}:`, error);
    }
  }, [key, type]);

  const setValue = useCallback((value: T) => {
    if (!isBrowser) return;

    try {
      setStoredValue(value);
      const storage = type === 'local' ? safeLocalStorage : safeSessionStorage;
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[useStorage] Error setting ${key}:`, error);
    }
  }, [key, type]);

  const removeValue = useCallback(() => {
    if (!isBrowser) return;

    try {
      setStoredValue(initialValue);
      const storage = type === 'local' ? safeLocalStorage : safeSessionStorage;
      storage.removeItem(key);
    } catch (error) {
      console.warn(`[useStorage] Error removing ${key}:`, error);
    }
  }, [key, type, initialValue]);

  // Return initial value during SSR
  return [mounted ? storedValue : initialValue, setValue, removeValue];
}
