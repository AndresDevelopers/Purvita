import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Standardized API error response structure
 */
interface ApiErrorResponse {
  error: string;
  details?: string | object;
}

/**
 * Creates a standardized error response for API routes
 * @param error - The caught error
 * @param defaultMessage - Default error message for users
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with error details
 */
export const handleApiError = (
  error: unknown,
  defaultMessage: string,
  status: number = 500
): NextResponse<ApiErrorResponse> => {
  console.error(defaultMessage, error);

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.flatten(),
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: defaultMessage,
        details: error.message,
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      error: defaultMessage,
      details: 'Unknown error occurred',
    },
    { status }
  );
};

/**
 * Type guard to check if error is a Zod validation error
 */
export const isZodError = (error: unknown): error is z.ZodError => {
  return error instanceof z.ZodError;
};

/**
 * Type guard to check if error is a standard Error
 */
export const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};