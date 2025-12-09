 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTeamMessagingService } from '@/modules/team-messaging/factories/team-messaging-service-factory';
import { TeamMessagingError } from '@/modules/team-messaging/domain/errors/team-messaging-error';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const { rateLimitService } = createSecurityModule();

const errorResponse = (message: string, status = 400, code = 'team_messaging_error') => {
  return NextResponse.json({ error: code, message }, { status });
};

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await rateLimitService.guard(req, 'api:team-messages:delete');

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
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      const response = errorResponse('Unauthorized', 401, 'unauthorized');
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const service = createTeamMessagingService();
    await service.deleteMessage(id, session.user.id);

    const response = NextResponse.json({ success: true });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof TeamMessagingError) {
      const statusMap: Record<TeamMessagingError['code'], number> = {
        recipient_not_in_team: 403,
        parent_message_not_found: 404,
        not_participant: 403,
        self_message_not_allowed: 400,
        message_not_found: 404,
        not_message_owner: 403,
      };
      const status = statusMap[error.code] ?? 400;
      const response = errorResponse(error.message, status, error.code);
      return rateLimitService.applyHeaders(response, guard.result);
    }

    console.error('[TeamMessaging] Failed to delete message', error);
    const response = errorResponse('Unable to delete message');
    return rateLimitService.applyHeaders(response, guard.result);
  }
}

