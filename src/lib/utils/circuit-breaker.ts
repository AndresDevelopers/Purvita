/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protege la aplicación de fallos en cascada cuando servicios externos
 * (Stripe, PayPal, etc.) están caídos o lentos.
 * 
 * Estados:
 * - CLOSED: Funcionamiento normal, todas las requests pasan
 * - OPEN: Servicio caído, rechaza requests inmediatamente
 * - HALF_OPEN: Probando si el servicio se recuperó
 * 
 * Configuración:
 * - failureThreshold: Número de fallos antes de abrir el circuito
 * - successThreshold: Número de éxitos en HALF_OPEN para cerrar
 * - timeout: Tiempo en ms antes de intentar HALF_OPEN
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Número de fallos consecutivos antes de abrir el circuito */
  failureThreshold?: number;
  /** Número de éxitos en HALF_OPEN para cerrar el circuito */
  successThreshold?: number;
  /** Tiempo en ms antes de intentar HALF_OPEN desde OPEN */
  timeout?: number;
  /** Nombre del circuito para logging */
  name?: string;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public circuitName: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 60000; // 1 minuto
    this.name = options.name ?? 'CircuitBreaker';
  }

  /**
   * Ejecuta una función protegida por el circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.name}. Service temporarily unavailable.`,
          this.name
        );
      }
      // Intentar HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      console.log(`[CircuitBreaker:${this.name}] Success in HALF_OPEN (${this.successCount}/${this.successThreshold})`);

      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Circuit CLOSED - service recovered`);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    console.warn(`[CircuitBreaker:${this.name}] Failure recorded (${this.failureCount}/${this.failureThreshold})`);

    if (this.state === CircuitState.HALF_OPEN) {
      // Un solo fallo en HALF_OPEN vuelve a abrir el circuito
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
      this.failureCount = 0;
      console.error(`[CircuitBreaker:${this.name}] Circuit OPEN again - service still failing`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`[CircuitBreaker:${this.name}] Circuit OPEN - too many failures`);
    }
  }

  /**
   * Obtiene el estado actual del circuito
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Resetea el circuit breaker manualmente (útil para testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    console.log(`[CircuitBreaker:${this.name}] Circuit manually reset`);
  }

  /**
   * Obtiene métricas del circuit breaker
   */
  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptIn: this.state === CircuitState.OPEN 
        ? Math.max(0, this.nextAttempt - Date.now())
        : 0,
    };
  }
}

/**
 * Registry global de circuit breakers para reutilización
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ ...options, name }));
    }
    return this.breakers.get(name)!;
  }

  getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  reset(name: string): void {
    this.breakers.get(name)?.reset();
  }

  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();
