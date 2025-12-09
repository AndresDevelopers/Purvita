import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';
import { createAdminBroadcastModule } from '@/modules/admin/messages/factories/admin-broadcast-module';
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
 * GET /api/admin/broadcasts/users
 * Search users for broadcast
 * Requires: manage_content permission
 */
export const GET = withAdminPermission('manage_content', async (request) => {
  try {
    const broadcastModule = await buildModule();
    const query = request.nextUrl.searchParams.get('query') ?? '';

    if (query.trim().length < 2) {
      return NextResponse.json([]);
    }

    const results = await broadcastModule.repository.searchUsers(query.trim(), 12);
    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to search users.';
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
})
