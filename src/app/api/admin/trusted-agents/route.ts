import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { requireCsrfToken } from '@/lib/security/csrf-protection'
import { withAdminPermission } from '@/lib/auth/with-auth'
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger'

/**
 * GET /api/admin/trusted-agents
 *
 * List all trusted agents
 *
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async (_request) => {
  try {
    const supabase = await createClient()

    // Fetch all trusted agents
    const { data: agents, error } = await supabase
      .from('trusted_agents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching trusted agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch trusted agents' },
        { status: 500 }
      )
    }

    return NextResponse.json({ agents })
  } catch (error) {
    console.error('Error in GET /api/admin/trusted-agents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

const CreateTrustedAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  user_agent_pattern: z.string().optional(),
  ip_address: z.string().optional(),
  api_key: z.string().optional(),
  bypass_captcha: z.boolean().default(true),
  bypass_rate_limiting: z.boolean().default(true),
  bypass_csrf: z.boolean().default(true),
  bypass_csp: z.boolean().default(false),
  is_active: z.boolean().default(true),
}).refine(
  (data) => data.user_agent_pattern || data.ip_address || data.api_key,
  {
    message: 'At least one detection method (user_agent_pattern, ip_address, or api_key) must be provided',
  }
)

/**
 * POST /api/admin/trusted-agents
 *
 * Create a new trusted agent
 *
 * Requires: manage_security permission
 */
export const POST = withAdminPermission('manage_security', async (request) => {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request)
    if (csrfError) return csrfError

    const supabase = createAdminClient()

    // Validate request body
    const body = await request.json()
    const validatedData = CreateTrustedAgentSchema.parse(body)

    // Get admin user ID from the request (set by withAdminPermission middleware)
    const adminUserId = (request as any).user?.id

    // Create trusted agent
    const { data: agent, error } = await supabase
      .from('trusted_agents')
      .insert({
        ...validatedData,
        created_by: adminUserId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating trusted agent:', error)

      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A trusted agent with this name or API key already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create trusted agent' },
        { status: 500 }
      )
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Created trusted agent',
      {
        ...extractRequestMetadata(request),
        action: 'create_trusted_agent',
        resourceType: 'trusted_agent',
        agentId: agent.id,
        agentName: agent.name,
        bypassCaptcha: agent.bypass_captcha,
        bypassRateLimiting: agent.bypass_rate_limiting,
      },
      true
    )

    return NextResponse.json({ agent }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error in POST /api/admin/trusted-agents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

