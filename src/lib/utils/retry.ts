/**
 * Retry Logic with Exponential Backoff
 * 
 * Implementa reintentos automáticos con backoff exponencial para
 * operaciones que pueden fallar temporalmente (APIs externas, red, etc.)
 * 
 * Características:
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s...
 * - Jitter: Añade aleatoriedad para evitar thundering herd
 * - Retry solo en errores recuperables (network, timeout, 5xx)
 * - No retry en errores de cliente (4xx excepto 429)
 */

export interface RetryOptions {
  /** Número máximo de reintentos */
  maxRetries?: number;
  /** Delay inicial en ms (se duplica en cada reintento) */
  initialDelay?: number;
  /** Delay máximo en ms */
  maxDelay?: number;
  /** Factor de multiplicación del delay (default: 2 para exponencial) */
  backoffMultiplier?: number;
  /** Añadir jitter aleatorio (0-1) para evitar thundering herd */
  jitter?: boolean;
  /** Función para determinar si un error es recuperable */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Callback antes de cada reintento */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Determina si un error HTTP es recuperable
 */
function isRetryableHttpError(error: any): boolean {
  // Network errors
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return true;
  }

  // Fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP status codes
  if (error.response || error.status) {
    const status = error.response?.status || error.status;
    
    // 429 Too Many Requests - retry con backoff
    if (status === 429) return true;
    
    // 5xx Server errors - retry
    if (status >= 500 && status < 600) return true;
    
    // 408 Request Timeout - retry
    if (status === 408) return true;
    
    // 4xx Client errors - NO retry (excepto 429)
    if (status >= 400 && status < 500) return false;
  }

  // Por defecto, retry en errores desconocidos
  return true;
}

/**
 * Calcula el delay con exponential backoff y jitter opcional
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  
  // Cap al máximo
  delay = Math.min(delay, maxDelay);
  
  // Añadir jitter (0-100% del delay)
  if (jitter) {
    const jitterAmount = delay * Math.random();
    delay = delay - jitterAmount;
  }
  
  return Math.floor(delay);
}

/**
 * Ejecuta una función con retry logic y exponential backoff
 * 
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error('API error');
 *     return response.json();
 *   },
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms due to:`, error.message);
 *     }
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    shouldRetry = isRetryableHttpError,
    onRetry,
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Si es el último intento, lanzar error
      if (attempt === maxRetries) {
        throw new RetryError(
          `Failed after ${attempt + 1} attempts: ${lastError.message}`,
          attempt + 1,
          lastError
        );
      }
      
      // Verificar si el error es recuperable
      if (!shouldRetry(error, attempt)) {
        throw error; // No retry en errores no recuperables
      }
      
      // Calcular delay para el siguiente intento
      const delay = calculateDelay(
        attempt,
        initialDelay,
        maxDelay,
        backoffMultiplier,
        jitter
      );
      
      // Callback antes de retry
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }
      
      // Esperar antes del siguiente intento
      await sleep(delay);
    }
  }
  
  // TypeScript safety (nunca debería llegar aquí)
  throw lastError!;
}

/**
 * Retry con timeout por intento
 * 
 * @example
 * ```typescript
 * const result = await retryWithTimeout(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     return response.json();
 *   },
 *   {
 *     maxRetries: 3,
 *     timeout: 5000, // 5 segundos por intento
 *   }
 * );
 * ```
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { timeout?: number } = {}
): Promise<T> {
  const { timeout = 10000, ...retryOptions } = options;
  
  return retry(
    () => withTimeout(fn(), timeout),
    retryOptions
  );
}

/**
 * Ejecuta una promesa con timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Operation timed out after ${timeoutMs}ms`);
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry específico para fetch con mejores defaults
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return retry(
    async () => {
      const response = await fetch(url, init);
      
      // Lanzar error si no es 2xx para que retry lo maneje
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = (response as any).status;
        (error as any).response = response;
        throw error;
      }
      
      return response;
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      jitter: true,
      ...options,
    }
  );
}
