 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TeamMessageMarkReadSchema } from '@/modules/team-messaging/domain/models/team-message';
import { createTeamMessagingService } from '@/modules/team-messaging/factories/team-messaging-service-factory';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const { rateLimitService } = createSecurityModule();

export async function POST(req: NextRequest) {
  const guard = await rateLimitService.guard(req, 'api:team-messages:mark-read');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), {
      status: 429,
    });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(req);
    if (csrfError) return csrfError;
    const body = await req.json();
    const payload = TeamMessageMarkReadSchema.parse(body);

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      const response = NextResponse.json({ error: 'unauthorized', message: 'Unauthorized' }, { status: 401 });
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const service = createTeamMessagingService();
    await service.markMessagesAsRead(session.user.id, payload.messageIds);

    const response = NextResponse.json({ success: true });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    console.error('[TeamMessaging] Failed to mark messages as read', error);
    const response = NextResponse.json(
      { error: 'team_messaging_error', message: 'Unable to update messages' },
      { status: 400 },
    );
    return rateLimitService.applyHeaders(response, guard.result);
  }
}
