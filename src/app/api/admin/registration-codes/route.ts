import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceRoleClient } from '@/lib/supabase'
import { verifyAdminAuth } from '@/lib/auth/admin-auth'
import { createRegistrationCodeSchema } from '@/lib/models/registration-code'
import { requireCsrfToken } from '@/lib/security/csrf-protection'
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger'

const DEFAULT_PAGE_SIZE = 10

export async function GET() {
  const authResult = await verifyAdminAuth()
  
  if (!authResult.authorized) {
    return authResult.response
  }

  const client = getServiceRoleClient()
  
  if (!client) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const { data, error } = await client
    .from('registration_access_codes')
    .select('*')
    .order('valid_from', { ascending: false })
    .limit(DEFAULT_PAGE_SIZE)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ codes: data })
}

export async function POST(request: Request) {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  const authResult = await verifyAdminAuth()
  
  if (!authResult.authorized) {
    return authResult.response
  }

  const client = getServiceRoleClient()
  
  if (!client) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const validatedData = createRegistrationCodeSchema.parse(body)

    const { data, error } = await client
      .from('registration_access_codes')
      .insert({
        code: validatedData.code,
        valid_from: validatedData.validFrom,
        valid_to: validatedData.validTo,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Created registration code',
      {
        ...extractRequestMetadata(request),
        action: 'create_registration_code',
        resourceType: 'registration_code',
        code: validatedData.code,
        validFrom: validatedData.validFrom,
        validTo: validatedData.validTo,
      },
      true
    )

    return NextResponse.json({ code: data }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: error.errors 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'Invalid request body' 
    }, { status: 400 })
  }
}
