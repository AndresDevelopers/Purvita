/**
 * Payment Gateway Helper Utilities
 * 
 * Shared utilities for payment gateway operations to reduce code duplication
 * across different payment provider endpoints.
 */

import { NextResponse } from 'next/server';
import { GatewayCredentialsService } from '../services/gateway-credentials-service';
import type { PaymentProvider } from '../domain/models/payment-gateway';

/**
 * Standard timeout for payment gateway API requests (15 seconds)
 */
export const PAYMENT_API_TIMEOUT_MS = 15000;

export interface GatewayCredentialsResult<T> {
  credentials: T;
  record: unknown;
  environment: 'test' | 'live';
}

/**
 * Fetch and validate payment gateway credentials
 * 
 * @param provider - Payment provider (stripe, paypal, etc.)
 * @param isTest - Optional test mode flag
 * @returns Credentials and gateway record, or NextResponse error
 */
export async function fetchGatewayCredentials<T>(
  provider: PaymentProvider,
  isTest?: boolean
): Promise<GatewayCredentialsResult<T> | NextResponse> {
  const requestedEnvironment = isTest === true ? 'test' : isTest === false ? 'live' : 'auto';
  
  try {
    const result = await GatewayCredentialsService.getProviderCredentials(
      provider,
      requestedEnvironment,
    );
    
    const { credentials, record } = result;

    // Check if gateway is active
    if (record.status !== 'active') {
      console.error(`[${provider}] Gateway is not active:`, record);
      return NextResponse.json(
        { 
          error: `${provider} is not active`, 
          message: 'This payment method is currently unavailable' 
        },
        { status: 503 },
      );
    }

    return {
      credentials: credentials as T,
      record,
      environment: result.requestedEnvironment,
    };
  } catch (credError) {
    console.error(`[${provider}] Failed to get credentials:`, credError);
    return NextResponse.json(
      { 
        error: `${provider} is not configured`,
        message: credError instanceof Error ? credError.message : 'Payment provider configuration error',
        details: `Please configure ${provider} credentials in the admin panel or environment variables`
      },
      { status: 503 },
    );
  }
}

/**
 * Type guard to check if result is an error response
 */
export function isErrorResponse(
  result: GatewayCredentialsResult<any> | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
