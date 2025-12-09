import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';
import { createAdminBroadcastModule } from '@/modules/admin/messages/factories/admin-broadcast-module';
import { AdminBroadcastAudienceSchema } from '@/modules/admin/messages/domain/models/admin-broadcast';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';

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
 * POST /api/admin/broadcasts/preview
 * Preview broadcast audience
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
    const audience = AdminBroadcastAudienceSchema.parse(payload);
    const preview = await broadcastModule.service.previewAudience(audience);
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid audience payload.' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Unable to preview audience.';
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
})
