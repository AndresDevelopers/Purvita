/**
 * Hooks para manejar problemas de concurrencia de forma segura
 * Previene race conditions, memory leaks y actualizaciones de estado después de desmontar
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook para hacer fetch con cancelación automática
 * Previene actualizaciones de estado después de desmontar y cancela peticiones anteriores
 */
export function useCancellableFetch<T = any>() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchData = useCallback(async (
    url: string, 
    options?: RequestInit
  ): Promise<T | null> => {
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Solo retornar si el componente sigue montado
      if (isMountedRef.current) {
        return data as T;
      }
      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
        return null;
      }
      throw error;
    }
  }, []);

  return { fetchData, isMounted: () => isMountedRef.current };
}

/**
 * Hook para debouncing de funciones
 * Útil para prevenir llamadas excesivas a APIs en eventos frecuentes (typing, scrolling, etc.)
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  
  // Actualizar la referencia del callback sin causar re-renders
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
  
  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback;
}

/**
 * Hook para throttling de funciones
 * Limita la frecuencia de ejecución de una función
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;
    
    if (timeSinceLastCall >= delay) {
      lastCallRef.current = now;
      callbackRef.current(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callbackRef.current(...args);
      }, delay - timeSinceLastCall);
    }
  }, [delay]) as T;
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return throttledCallback;
}

/**
 * Hook para prevenir ejecución múltiple de funciones async
 * Útil para prevenir doble-submit en formularios o doble-click en botones
 */
export function useSingleExecution() {
  const isExecutingRef = useRef(false);
  
  const execute = useCallback(async <T,>(
    fn: () => Promise<T>
  ): Promise<T | null> => {
    if (isExecutingRef.current) {
      console.log('Execution prevented: already executing');
      return null;
    }
    
    isExecutingRef.current = true;
    
    try {
      const result = await fn();
      return result;
    } finally {
      isExecutingRef.current = false;
    }
  }, []);
  
  return { execute, isExecuting: () => isExecutingRef.current };
}

/**
 * Hook para manejar estado async de forma segura
 * Previene actualizaciones de estado después de desmontar
 */
export function useSafeState<T>(initialState: T) {
  const [state, setState] = useState(initialState);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const setSafeState = useCallback((newState: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState);
    }
  }, []);
  
  return [state, setSafeState] as const;
}

/**
 * Hook para manejar promesas con caché y deduplicación
 * Evita peticiones duplicadas para la misma clave
 */
export function usePromiseCache<T>() {
  const cacheRef = useRef<Map<string, { promise: Promise<T>; timestamp: number }>>(new Map());
  const TTL = 30000; // 30 segundos por defecto
  
  const getOrCreate = useCallback(async (
    key: string,
    factory: () => Promise<T>,
    ttl = TTL
  ): Promise<T> => {
    const now = Date.now();
    const cached = cacheRef.current.get(key);
    
    // Si existe en caché y no ha expirado, retornar la promesa existente
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.promise;
    }
    
    // Crear nueva promesa
    const promise = factory().finally(() => {
      // Limpiar después del TTL
      setTimeout(() => {
        cacheRef.current.delete(key);
      }, ttl);
    });
    
    cacheRef.current.set(key, { promise, timestamp: now });
    return promise;
  }, []);
  
  const invalidate = useCallback((key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }, []);
  
  // Limpiar al desmontar
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      cache.clear();
    };
  }, []);
  
  return { getOrCreate, invalidate };
}

/**
 * Hook para ejecutar efectos async de forma segura
 * Maneja la cancelación y previene actualizaciones después de desmontar
 */
export function useAsyncEffect(
  effect: (signal: AbortSignal) => Promise<void>,
  deps: React.DependencyList
) {
  useEffect(() => {
    const controller = new AbortController();
    
    effect(controller.signal).catch((error) => {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Async effect was cancelled');
        return;
      }
      console.error('Async effect error:', error);
    });
    
    return () => {
      controller.abort();
    };
   
  }, deps);
}

/**
 * Hook para reintentar operaciones fallidas con exponential backoff
 */
export function useRetry() {
  const retriesRef = useRef<Map<string, number>>(new Map());
  
  const retry = useCallback(async <T,>(
    key: string,
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> => {
    const currentRetries = retriesRef.current.get(key) || 0;
    
    try {
      const result = await fn();
      retriesRef.current.delete(key); // Reset en éxito
      return result;
    } catch (error) {
      if (currentRetries >= maxRetries) {
        retriesRef.current.delete(key);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, currentRetries); // Exponential backoff
      retriesRef.current.set(key, currentRetries + 1);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(key, fn, maxRetries, baseDelay);
    }
  }, []);
  
  const reset = useCallback((key?: string) => {
    if (key) {
      retriesRef.current.delete(key);
    } else {
      retriesRef.current.clear();
    }
  }, []);
  
  return { retry, reset };
}
