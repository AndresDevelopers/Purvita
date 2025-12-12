import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { requireCsrfToken } from '@/lib/security/csrf-protection'
import { withAdminPermission } from '@/lib/auth/with-auth'
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger'

const UpdateTrustedAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  user_agent_pattern: z.string().optional(),
  ip_address: z.string().optional(),
  api_key: z.string().optional(),
  bypass_captcha: z.boolean().optional(),
  bypass_rate_limiting: z.boolean().optional(),
  bypass_csrf: z.boolean().optional(),
  bypass_csp: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

/**
 * PATCH /api/admin/trusted-agents/[id]
 *
 * Update a trusted agent
 *
 * Requires: manage_security permission
 */
export const PATCH = withAdminPermission('manage_security', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request)
    if (csrfError) return csrfError

    const supabase = await createClient()

    // Validate request body
    const body = await request.json()
    const validatedData = UpdateTrustedAgentSchema.parse(body)

    // Get agent ID from params
    const { id } = await params

    // Update trusted agent
    const { data: agent, error } = await supabase
      .from('trusted_agents')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating trusted agent:', error)
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Trusted agent not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update trusted agent' },
        { status: 500 }
      )
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Updated trusted agent',
      {
        ...extractRequestMetadata(request),
        action: 'update_trusted_agent',
        resourceType: 'trusted_agent',
        agentId: id,
        changes: validatedData,
      },
      true
    )

    return NextResponse.json({ agent })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error in PATCH /api/admin/trusted-agents/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/trusted-agents/[id]
 *
 * Delete a trusted agent
 *
 * Requires: manage_security permission
 */
export const DELETE = withAdminPermission('manage_security', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request)
    if (csrfError) return csrfError

    const supabase = await createClient()

    // Get agent ID from params
    const { id } = await params

    // Delete trusted agent
    const { error } = await supabase
      .from('trusted_agents')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting trusted agent:', error)
      return NextResponse.json(
        { error: 'Failed to delete trusted agent' },
        { status: 500 }
      )
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Deleted trusted agent',
      {
        ...extractRequestMetadata(request),
        action: 'delete_trusted_agent',
        resourceType: 'trusted_agent',
        agentId: id,
      },
      true
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/trusted-agents/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

