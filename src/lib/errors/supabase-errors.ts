import type { AuthApiError } from '@supabase/supabase-js';

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigurationError';
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor(originalError: AuthApiError) {
    super(`Invalid refresh token: ${originalError.message}`);
    this.name = 'InvalidRefreshTokenError';
    this.cause = originalError;
  }
}

export const isInvalidRefreshTokenError = (error: unknown): error is AuthApiError => {
  const e = error as { name?: string; message?: string; status?: number } | null | undefined;
  if (!e || typeof e !== 'object') return false;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const looksLikeAuthApiError = e.name === 'AuthApiError' || typeof e.status === 'number';
  return (
    looksLikeAuthApiError &&
    (msg.includes('invalid refresh token') || msg.includes('refresh token not found'))
  );
};

export const handleSupabaseAuthError = (error: unknown): never => {
  if (isInvalidRefreshTokenError(error)) {
    throw new InvalidRefreshTokenError(error);
  }
  throw error;
};
