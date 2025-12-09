import { cache } from 'react';

/**
 * Enhanced cache wrapper with proper invalidation support
 */
export class CacheManager<TArgs extends unknown[], TResult> {
  private cacheMap = new Map<string, TResult>();
  private cachedFn: (...args: TArgs) => Promise<TResult>;

  constructor(
    private fn: (...args: TArgs) => Promise<TResult>,
    private keyGenerator?: (...args: TArgs) => string
  ) {
    this.cachedFn = cache(this.fn);
  }

  async get(...args: TArgs): Promise<TResult> {
    return this.cachedFn(...args);
  }

  clear(key?: string): void {
    if (key) {
      this.cacheMap.delete(key);
    } else {
      this.cacheMap.clear();
    }
    
    // For React cache, we need to create a new cached function
    this.cachedFn = cache(this.fn);
  }

  invalidate(...args: TArgs): void {
    const key = this.keyGenerator ? this.keyGenerator(...args) : JSON.stringify(args);
    this.clear(key);
  }
}

/**
 * Creates a managed cache instance
 */
export function createManagedCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyGenerator?: (...args: TArgs) => string
): CacheManager<TArgs, TResult> {
  return new CacheManager(fn, keyGenerator);
}