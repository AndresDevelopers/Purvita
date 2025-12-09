/**
 * Browser Compatibility Utilities
 * Safe wrappers for browser APIs with fallbacks for all browsers
 * Supports: Chrome, Firefox, Safari, Edge, Opera, iOS Safari, Android Chrome
 * 
 * Edge-specific: Full support for Edge 79+ (Chromium-based)
 * Mobile: iOS Safari 14+, Android Chrome 80+, Samsung Internet 14+
 */

// ============================================================================
// Polyfills for older browsers
// ============================================================================

/**
 * Polyfill for structuredClone (Edge 79-88, Safari < 15.4)
 */
export function safeStructuredClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  // Fallback using JSON for simple objects
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // For objects with circular references, return shallow copy
    if (typeof obj === 'object' && obj !== null) {
      return { ...obj } as T;
    }
    return obj;
  }
}

/**
 * Polyfill for Object.hasOwn (Edge < 93)
 */
export function safeHasOwn(obj: object, key: PropertyKey): boolean {
  if (typeof Object.hasOwn === 'function') {
    return Object.hasOwn(obj, key);
  }
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Polyfill for Array.prototype.at (Edge < 92)
 */
export function safeArrayAt<T>(arr: T[], index: number): T | undefined {
  if (typeof arr.at === 'function') {
    return arr.at(index);
  }
  // Polyfill
  const len = arr.length;
  const relativeIndex = index >= 0 ? index : len + index;
  if (relativeIndex < 0 || relativeIndex >= len) {
    return undefined;
  }
  return arr[relativeIndex];
}

/**
 * Polyfill for String.prototype.replaceAll (Edge < 85)
 */
export function safeReplaceAll(str: string, search: string | RegExp, replacement: string): string {
  if (typeof str.replaceAll === 'function') {
    return str.replaceAll(search, replacement);
  }
  // Polyfill
  if (typeof search === 'string') {
    return str.split(search).join(replacement);
  }
  // For RegExp, ensure global flag
  const flags = search.flags.includes('g') ? search.flags : search.flags + 'g';
  return str.replace(new RegExp(search.source, flags), replacement);
}

/**
 * Polyfill for crypto.randomUUID (Edge < 92, some mobile browsers)
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if code is running in browser environment
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Check if code is running on server (SSR)
 */
export const isServer = typeof window === 'undefined';

/**
 * Detect browser type
 */
export function getBrowserInfo(): {
  name: string;
  version: string;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isChrome: boolean;
  isFirefox: boolean;
} {
  if (isServer) {
    return {
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
  }

  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isEdge = /Edg/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !isEdge;
  const isFirefox = /Firefox/i.test(ua);

  let name = 'unknown';
  let version = '0';

  if (isEdge) {
    name = 'Edge';
    version = ua.match(/Edg\/(\d+)/)?.[1] || '0';
  } else if (isChrome) {
    name = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
  } else if (isFirefox) {
    name = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || '0';
  } else if (isSafari) {
    name = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || '0';
  }

  return {
    name,
    version,
    isMobile,
    isIOS,
    isAndroid,
    isSafari,
    isEdge,
    isChrome,
    isFirefox,
  };
}

// ============================================================================
// Storage Utilities (localStorage & sessionStorage)
// ============================================================================

/**
 * Check if storage is available
 * Some browsers block storage in private mode or with certain security settings
 */
function isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
  if (isServer) return false;

  try {
    const storage = window[type];
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch {
    // Safari private mode, storage quota exceeded, or security restrictions
    return false;
  }
}

/**
 * Memory fallback for when storage is unavailable
 */
const memoryStorage: Map<string, string> = new Map();

/**
 * Safe localStorage wrapper with memory fallback
 */
export const safeLocalStorage = {
  isAvailable: (): boolean => isStorageAvailable('localStorage'),

  getItem(key: string): string | null {
    if (isServer) return null;
    
    try {
      if (isStorageAvailable('localStorage')) {
        return localStorage.getItem(key);
      }
      return memoryStorage.get(`local_${key}`) ?? null;
    } catch (e) {
      console.warn('[BrowserCompat] localStorage.getItem failed:', e);
      return memoryStorage.get(`local_${key}`) ?? null;
    }
  },

  setItem(key: string, value: string): boolean {
    if (isServer) return false;
    
    try {
      if (isStorageAvailable('localStorage')) {
        localStorage.setItem(key, value);
        return true;
      }
      memoryStorage.set(`local_${key}`, value);
      return true;
    } catch (e) {
      console.warn('[BrowserCompat] localStorage.setItem failed:', e);
      memoryStorage.set(`local_${key}`, value);
      return true;
    }
  },

  removeItem(key: string): boolean {
    if (isServer) return false;
    
    try {
      if (isStorageAvailable('localStorage')) {
        localStorage.removeItem(key);
      }
      memoryStorage.delete(`local_${key}`);
      return true;
    } catch (e) {
      console.warn('[BrowserCompat] localStorage.removeItem failed:', e);
      memoryStorage.delete(`local_${key}`);
      return true;
    }
  },

  clear(): boolean {
    if (isServer) return false;
    
    try {
      if (isStorageAvailable('localStorage')) {
        localStorage.clear();
      }
      // Clear memory storage local items
      for (const key of memoryStorage.keys()) {
        if (key.startsWith('local_')) {
          memoryStorage.delete(key);
        }
      }
      return true;
    } catch (e) {
      console.warn('[BrowserCompat] localStorage.clear failed:', e);
      return false;
    }
  },
};

/**
 * Safe sessionStorage wrapper with memory fallback
 */
export const safeSessionStorage = {
  isAvailable: (): boolean => isStorageAvailable('sessionStorage'),

  getItem(key: string): string | null {
    if (isServer) return null;
    
    try {
      if (isStorageAvailable('sessionStorage')) {
        return sessionStorage.getItem(key);
      }
      return memoryStorage.get(`session_${key}`) ?? null;
    } catch (e) {
      console.warn('[BrowserCompat] sessionStorage.getItem failed:', e);
      return memoryStorage.get(`session_${key}`) ?? null;
    }
  },

  setItem(key: string, value: string): boolean {
    if (isServer) return false;
    
    try {
      if (isStorageAvailable('sessionStorage')) {
        sessionStorage.setItem(key, value);
        return true;
      }
      memoryStorage.set(`session_${key}`, value);
      return true;
    } catch (e) {
      console.warn('[BrowserCompat] sessionStorage.setItem failed:', e);
      memoryStorage.set(`session_${key}`, value);
      return true;
    }
  },

  removeItem(key: string): boolean {
    if (isServer) return false;
    
    try {
      if (isStorageAvailable('sessionStorage')) {
        sessionStorage.removeItem(key);
      }
      memoryStorage.delete(`session_${key}`);
      return true;
    } catch (e) {
      console.warn('[BrowserCompat] sessionStorage.removeItem failed:', e);
      memoryStorage.delete(`session_${key}`);
      return true;
    }
  },

  clear(): boolean {
    if (isServer) return false;
    
    try {
      if (isStorageAvailable('sessionStorage')) {
        sessionStorage.clear();
      }
      // Clear memory storage session items
      for (const key of memoryStorage.keys()) {
        if (key.startsWith('session_')) {
          memoryStorage.delete(key);
        }
      }
      return true;
    } catch (e) {
      console.warn('[BrowserCompat] sessionStorage.clear failed:', e);
      return false;
    }
  },
};

// ============================================================================
// Navigator APIs (Share, Vibrate, Clipboard)
// ============================================================================

/**
 * Check if Web Share API is available
 */
export function canShare(): boolean {
  if (isServer) return false;
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Safe share with fallback
 */
export async function safeShare(data: ShareData): Promise<{ success: boolean; fallback?: 'clipboard' | 'none' }> {
  if (isServer) return { success: false, fallback: 'none' };

  try {
    if (canShare() && navigator.canShare?.(data)) {
      await navigator.share(data);
      return { success: true };
    }

    // Fallback: Copy URL to clipboard
    if (data.url && typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(data.url);
      return { success: true, fallback: 'clipboard' };
    }

    // Legacy fallback for older browsers
    if (data.url && document.execCommand) {
      const textArea = document.createElement('textarea');
      textArea.value = data.url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return { success: true, fallback: 'clipboard' };
    }

    return { success: false, fallback: 'none' };
  } catch (error) {
    // User cancelled or error occurred
    console.warn('[BrowserCompat] Share failed:', error);
    return { success: false, fallback: 'none' };
  }
}

/**
 * Check if Vibration API is available
 */
export function canVibrate(): boolean {
  if (isServer) return false;
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Safe vibrate - no-op on unsupported browsers
 */
export function safeVibrate(pattern: number | number[]): boolean {
  if (isServer) return false;
  
  try {
    if (canVibrate()) {
      return navigator.vibrate(pattern);
    }
    return false;
  } catch {
    // Some browsers throw on vibrate() call
    return false;
  }
}

/**
 * Check if Clipboard API is available
 */
export function canUseClipboard(): boolean {
  if (isServer) return false;
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';
}

/**
 * Safe clipboard write with fallback
 */
export async function safeClipboardWrite(text: string): Promise<boolean> {
  if (isServer) return false;

  try {
    if (canUseClipboard()) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Legacy fallback using execCommand
    if (document.execCommand) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }

    return false;
  } catch (error) {
    console.warn('[BrowserCompat] Clipboard write failed:', error);
    return false;
  }
}

// ============================================================================
// Window/Document Safe Access
// ============================================================================

/**
 * Safe window location access
 */
export function getWindowLocation(): {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
} | null {
  if (isServer) return null;
  
  try {
    return {
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      origin: window.location.origin,
    };
  } catch {
    return null;
  }
}

/**
 * Safe document title access
 */
export function getDocumentTitle(): string {
  if (isServer) return '';
  
  try {
    return document.title;
  } catch {
    return '';
  }
}

/**
 * Safe document referrer access
 */
export function getDocumentReferrer(): string {
  if (isServer) return '';
  
  try {
    return document.referrer;
  } catch {
    return '';
  }
}

/**
 * Safe user agent access
 */
export function getUserAgent(): string {
  if (isServer) return '';
  
  try {
    return navigator.userAgent;
  } catch {
    return '';
  }
}

// ============================================================================
// CSS Feature Detection
// ============================================================================

/**
 * Check if a CSS property is supported
 */
export function supportsCSSProperty(property: string, value?: string): boolean {
  if (isServer) return true; // Assume support on server

  try {
    if (typeof CSS !== 'undefined' && CSS.supports) {
      return value ? CSS.supports(property, value) : CSS.supports(property);
    }
    
    // Fallback for older browsers
    const element = document.createElement('div');
    const camelCase = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return camelCase in element.style;
  } catch {
    return false;
  }
}

/**
 * Check if backdrop-filter is supported
 */
export function supportsBackdropFilter(): boolean {
  return supportsCSSProperty('backdrop-filter', 'blur(10px)') ||
         supportsCSSProperty('-webkit-backdrop-filter', 'blur(10px)');
}

/**
 * Check if CSS Grid subgrid is supported
 */
export function supportsSubgrid(): boolean {
  return supportsCSSProperty('grid-template-columns', 'subgrid');
}

/**
 * Check if CSS gap is supported in flexbox
 */
export function supportsFlexGap(): boolean {
  if (isServer) return true;
  
  try {
    const flex = document.createElement('div');
    flex.style.display = 'flex';
    flex.style.gap = '1px';
    return flex.style.gap === '1px';
  } catch {
    return false;
  }
}

// ============================================================================
// Event Utilities
// ============================================================================

/**
 * Check if touch events are supported
 */
export function supportsTouchEvents(): boolean {
  if (isServer) return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Check if pointer events are supported
 */
export function supportsPointerEvents(): boolean {
  if (isServer) return false;
  return 'PointerEvent' in window;
}

/**
 * Get appropriate event types for touch/click
 */
export function getInteractionEvents(): {
  start: string;
  move: string;
  end: string;
} {
  if (supportsPointerEvents()) {
    return { start: 'pointerdown', move: 'pointermove', end: 'pointerup' };
  }
  if (supportsTouchEvents()) {
    return { start: 'touchstart', move: 'touchmove', end: 'touchend' };
  }
  return { start: 'mousedown', move: 'mousemove', end: 'mouseup' };
}

// ============================================================================
// Scroll Utilities
// ============================================================================

/**
 * Check if smooth scroll is supported
 */
export function supportsSmoothScroll(): boolean {
  if (isServer) return true;
  return 'scrollBehavior' in document.documentElement.style;
}

/**
 * Safe smooth scroll to element
 */
export function safeScrollTo(options: ScrollToOptions): void {
  if (isServer) return;

  try {
    if (supportsSmoothScroll()) {
      window.scrollTo(options);
    } else {
      // Fallback for browsers without smooth scroll
      window.scrollTo(options.left ?? 0, options.top ?? 0);
    }
  } catch (e) {
    console.warn('[BrowserCompat] scrollTo failed:', e);
  }
}

/**
 * Safe scroll into view
 */
export function safeScrollIntoView(
  element: Element | null,
  options?: ScrollIntoViewOptions
): void {
  if (isServer || !element) return;

  try {
    if (supportsSmoothScroll()) {
      element.scrollIntoView(options);
    } else {
      element.scrollIntoView(options?.block === 'start');
    }
  } catch (e) {
    console.warn('[BrowserCompat] scrollIntoView failed:', e);
  }
}

// ============================================================================
// Mobile & Edge Specific Utilities
// ============================================================================

/**
 * Check if running on Edge browser (Chromium-based)
 */
export function isEdgeBrowser(): boolean {
  if (isServer) return false;
  return /Edg/i.test(navigator.userAgent);
}

/**
 * Check if running on a mobile browser
 */
export function isMobileBrowser(): boolean {
  if (isServer) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints > 0 && /Macintosh/i.test(navigator.userAgent));
}

/**
 * Get safe viewport dimensions (handles mobile browsers with dynamic toolbars)
 */
export function getSafeViewport(): { width: number; height: number; visualHeight: number } {
  if (isServer) {
    return { width: 0, height: 0, visualHeight: 0 };
  }

  const width = window.innerWidth || document.documentElement.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight;
  
  // visualViewport is more accurate for mobile browsers with dynamic toolbars
  const visualHeight = window.visualViewport?.height ?? height;

  return { width, height, visualHeight };
}

/**
 * Safe ResizeObserver wrapper with fallback
 */
export function safeResizeObserver(
  callback: (entries: ResizeObserverEntry[]) => void,
  _options?: ResizeObserverOptions
): ResizeObserver | null {
  if (isServer) return null;

  if (typeof ResizeObserver !== 'undefined') {
    // Note: ResizeObserver doesn't accept options in the constructor
    return new ResizeObserver(callback);
  }

  // No fallback for ResizeObserver - return null
  console.warn('[BrowserCompat] ResizeObserver not supported');
  return null;
}

/**
 * Safe IntersectionObserver wrapper with fallback
 */
export function safeIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (isServer) return null;

  if (typeof IntersectionObserver !== 'undefined') {
    return new IntersectionObserver(callback, options);
  }

  console.warn('[BrowserCompat] IntersectionObserver not supported');
  return null;
}

/**
 * Check if passive event listeners are supported
 * Important for mobile scroll performance
 */
export function supportsPassiveEvents(): boolean {
  if (isServer) return false;

  let supported = false;
  try {
    const options: AddEventListenerOptions = Object.defineProperty({}, 'passive', {
      get() {
        supported = true;
        return true;
      }
    });
    const noop = () => {};
    window.addEventListener('testPassive', noop, options);
    window.removeEventListener('testPassive', noop, options);
  } catch {
    supported = false;
  }
  return supported;
}

/**
 * Get passive event listener option for better scroll performance
 */
export function getPassiveOption(): { passive: boolean } | boolean {
  return supportsPassiveEvents() ? { passive: true } : false;
}

/**
 * Safe requestIdleCallback with fallback for Edge and Safari
 */
export function safeRequestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if (isServer) return 0;

  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(callback, options);
  }

  // Fallback using setTimeout
  return window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => 50, // Estimate 50ms remaining
    });
  }, options?.timeout ?? 1) as unknown as number;
}

/**
 * Safe cancelIdleCallback with fallback
 */
export function safeCancelIdleCallback(handle: number): void {
  if (isServer) return;

  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

/**
 * Detect if the browser supports the `loading="lazy"` attribute
 */
export function supportsLazyLoading(): boolean {
  if (isServer) return true;
  return 'loading' in HTMLImageElement.prototype;
}

/**
 * Check if the browser supports the Intl API
 */
export function supportsIntl(): boolean {
  if (isServer) return true;
  return typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';
}

/**
 * Safe date formatting with Intl fallback
 */
export function safeFormatDate(
  date: Date,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    if (supportsIntl()) {
      return new Intl.DateTimeFormat(locale, options).format(date);
    }
  } catch {
    // Fall through to fallback
  }
  return date.toLocaleDateString();
}

/**
 * Safe number formatting with Intl fallback
 */
export function safeFormatNumber(
  num: number,
  locale: string = 'en-US',
  options?: Intl.NumberFormatOptions
): string {
  try {
    if (supportsIntl()) {
      return new Intl.NumberFormat(locale, options).format(num);
    }
  } catch {
    // Fall through to fallback
  }
  return num.toLocaleString();
}

/**
 * Check if matchMedia is supported (for responsive JavaScript)
 */
export function supportsMatchMedia(): boolean {
  if (isServer) return false;
  return typeof window.matchMedia === 'function';
}

/**
 * Safe matchMedia wrapper
 */
export function safeMatchMedia(query: string): MediaQueryList | null {
  if (isServer || !supportsMatchMedia()) return null;
  
  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

/**
 * Check if the browser prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (isServer) return false;
  
  const mediaQuery = safeMatchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery?.matches ?? false;
}

/**
 * Check if the browser is in dark mode
 */
export function prefersDarkMode(): boolean {
  if (isServer) return false;
  
  const mediaQuery = safeMatchMedia('(prefers-color-scheme: dark)');
  return mediaQuery?.matches ?? false;
}

/**
 * Safe focus management for mobile accessibility
 */
export function safeFocus(element: HTMLElement | null, options?: FocusOptions): boolean {
  if (isServer || !element) return false;

  try {
    // Check if preventScroll is supported (Edge < 79 doesn't support it)
    if (options?.preventScroll !== undefined) {
      element.focus(options);
    } else {
      element.focus();
    }
    return document.activeElement === element;
  } catch {
    return false;
  }
}
