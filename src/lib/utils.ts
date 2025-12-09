import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unexpected error');
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
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

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}

/**
 * Extracts the storage path from a Supabase public URL
 * @param publicUrl - The public URL from Supabase storage
 * @returns The storage path or null if not a valid Supabase storage URL
 */
export function extractStoragePathFromUrl(publicUrl: string): string | null {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    // Supabase storage URLs have the format: /storage/v1/object/public/{bucket}/{path}
    const pathParts = url.pathname.split('/storage/v1/object/public/');
    if (pathParts.length !== 2) return null;

    const bucketAndPath = pathParts[1];
    const firstSlashIndex = bucketAndPath.indexOf('/');
    if (firstSlashIndex === -1) return null;

    return bucketAndPath.substring(firstSlashIndex + 1);
  } catch {
    return null;
  }
}
