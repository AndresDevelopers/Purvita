import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSecurityModule } from '@/modules/security/factories/security-module'
import { createRegistrationAccessModule } from '@/modules/registration-access/factories/registration-access-module'

const bodySchema = z.object({
  code: z.string(),
})

const { rateLimitService } = createSecurityModule()

export async function POST(req: NextRequest) {
  const guard = await rateLimitService.guard(req, 'api:auth:registration-code:validate:post')

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), { status: 429 })
    return rateLimitService.applyHeaders(response, guard.result)
  }

  let body: z.infer<typeof bodySchema>

  try {
    const json = await req.json()
    body = bodySchema.parse(json)
  } catch (error) {
    console.warn('[api.auth.registration-code.validate] Invalid request body', error)
    const response = NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    return rateLimitService.applyHeaders(response, guard.result)
  }

  const { service } = createRegistrationAccessModule()

  try {
    const result = await service.validateCode(body.code)

    if (!result.valid) {
      const response = NextResponse.json(
        {
          valid: false,
          reason: result.reason ?? 'mismatch',
        },
        { status: 401 },
      )

      return rateLimitService.applyHeaders(response, guard.result)
    }

    const response = NextResponse.json(
      {
        valid: true,
        code: {
          value: result.code?.code,
          validFrom: result.code?.validFrom,
          validTo: result.code?.validTo,
        },
      },
      { status: 200 },
    )

    return rateLimitService.applyHeaders(response, guard.result)
  } catch (error) {
    console.error('[api.auth.registration-code.validate] Unexpected error validating registration code', error)
    const response = NextResponse.json({ error: 'Failed to validate registration code' }, { status: 500 })
    return rateLimitService.applyHeaders(response, guard.result)
  }
}
