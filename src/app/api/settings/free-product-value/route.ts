import { NextResponse } from 'next/server';
import { getFreeProductValueCents } from '@/lib/helpers/settings-helper';

/**
 * GET /api/settings/free-product-value
 * Returns the free product value in cents
 * Used by client components that need this configuration value
 */
export async function GET() {
  try {
    const valueCents = await getFreeProductValueCents();

    return NextResponse.json(
      { valueCents },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('[API] Failed to get free product value:', error);
    return NextResponse.json(
      { error: 'Failed to fetch free product value' },
      { status: 500 }
    );
  }
}
