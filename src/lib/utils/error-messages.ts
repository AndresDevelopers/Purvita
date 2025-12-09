/**
 * Standardized Error Messages
 *
 * Provides generic error messages that don't expose system internals
 * or implementation details to clients.
 */

export const ErrorMessages = {
  // Generic errors
  INTERNAL_ERROR: 'An error occurred while processing your request',
  VALIDATION_ERROR: 'Invalid request data',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource already exists',
  RATE_LIMITED: 'Too many requests. Please try again later',

  // Authentication
  AUTH_INVALID_CREDENTIALS: 'Invalid credentials',
  AUTH_SESSION_EXPIRED: 'Session expired. Please sign in again',
  AUTH_ACCOUNT_DISABLED: 'Account access has been restricted',

  // Authorization
  AUTHZ_INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  AUTHZ_ADMIN_REQUIRED: 'Admin access required',

  // CSRF
  CSRF_INVALID_TOKEN: 'Security token validation failed. Please refresh and try again',

  // Data operations
  DATA_CREATE_FAILED: 'Failed to create resource',
  DATA_UPDATE_FAILED: 'Failed to update resource',
  DATA_DELETE_FAILED: 'Failed to delete resource',
  DATA_FETCH_FAILED: 'Failed to retrieve data',

  // Payments
  PAYMENT_FAILED: 'Payment processing failed',
  PAYMENT_INVALID: 'Invalid payment information',

  // File uploads
  UPLOAD_FAILED: 'File upload failed',
  UPLOAD_INVALID_TYPE: 'Invalid file type',
  UPLOAD_TOO_LARGE: 'File size exceeds limit',
} as const;

/**
 * Get a generic error message based on error type
 * Never exposes internal error details to client
 */
export function getGenericErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Map specific error patterns to generic messages
    if (message.includes('not found') || message.includes('does not exist')) {
      return ErrorMessages.NOT_FOUND;
    }

    if (message.includes('already exists') || message.includes('duplicate')) {
      return ErrorMessages.CONFLICT;
    }

    if (message.includes('unauthorized') || message.includes('not authenticated')) {
      return ErrorMessages.UNAUTHORIZED;
    }

    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorMessages.FORBIDDEN;
    }

    if (message.includes('invalid') || message.includes('validation')) {
      return ErrorMessages.VALIDATION_ERROR;
    }
  }

  // Default to generic internal error
  return ErrorMessages.INTERNAL_ERROR;
}

/**
 * Log error details server-side while returning generic message to client
 */
export function logAndGetGenericError(
  error: unknown,
  context: string
): { message: string; statusCode: number } {
  // Log full error server-side
  console.error(`[${context}] Error:`, error);

  // Determine status code
  let statusCode = 500;
  const genericMessage = getGenericErrorMessage(error);

  if (genericMessage === ErrorMessages.NOT_FOUND) {
    statusCode = 404;
  } else if (genericMessage === ErrorMessages.CONFLICT) {
    statusCode = 409;
  } else if (genericMessage === ErrorMessages.UNAUTHORIZED) {
    statusCode = 401;
  } else if (genericMessage === ErrorMessages.FORBIDDEN) {
    statusCode = 403;
  } else if (genericMessage === ErrorMessages.VALIDATION_ERROR) {
    statusCode = 400;
  }

  return { message: genericMessage, statusCode };
}
