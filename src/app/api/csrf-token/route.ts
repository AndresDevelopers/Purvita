import { NextResponse } from 'next/server'
import { generateCsrfToken, setCsrfTokenCookie } from '@/lib/security/csrf-protection'

/**
 * CSRF Token Generation Endpoint
 *
 * GET /api/csrf-token
 * Generates and returns a new CSRF token
 */
export async function GET() {
  try {
    const token = generateCsrfToken()

    // Set token in HTTP-only cookie
    await setCsrfTokenCookie(token)

    return NextResponse.json({
      token,
      expiresIn: 60 * 60 * 24, // 24 hours in seconds
    })
  } catch (error) {
    console.error('Error generating CSRF token:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate CSRF token',
      },
      { status: 500 }
    )
  }
}
