import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';
import { createAdminBroadcastModule } from '@/modules/admin/messages/factories/admin-broadcast-module';
import { AdminBroadcastSendRequestSchema } from '@/modules/admin/messages/domain/models/admin-broadcast';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const buildModule = async () => {
  const adminClient = await createAdminClient();
  const brandName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME;
  const fromName = process.env.CONTACT_FROM_NAME?.trim() ?? null;
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim() ?? null;
  const replyTo = process.env.CONTACT_REPLY_TO_EMAIL?.trim() ?? null;

  return createAdminBroadcastModule({
    client: adminClient,
    brandName,
    fromName,
    fromEmail,
    replyTo,
  });
};

/**
 * GET /api/admin/broadcasts
 * Get broadcast overview
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async (_request) => {
  try {
    const broadcastModule = await buildModule();
    const overview = await broadcastModule.service.getOverview();
    return NextResponse.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load broadcast overview.';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
})

/**
 * POST /api/admin/broadcasts
 * Send a broadcast message
 * Requires: manage_content permission
 */
export const POST = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const broadcastModule = await buildModule();
    const payload = await request.json();
    const parsed = AdminBroadcastSendRequestSchema.parse(payload);

    const result = await broadcastModule.service.sendBroadcast(parsed, {
      senderId: request.user.id,
      senderEmail: request.user.email ?? null,
    });

    // Audit log
    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      `Admin sent broadcast message: ${parsed.subject}`,
      {
        ...extractRequestMetadata(request),
        userId: request.user.id,
        userEmail: request.user.email,
        action: 'send_broadcast',
        resourceType: 'broadcast',
        subject: parsed.subject,
        recipientCount: result.deliveredCount,
        audienceType: parsed.type,
      },
      true
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid broadcast payload.' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to send broadcast.';
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    const status = message.includes('No recipients') ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
})
