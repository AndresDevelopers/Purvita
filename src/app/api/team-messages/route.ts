 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createTeamMessagingService } from '@/modules/team-messaging/factories/team-messaging-service-factory';
import { TeamMessageSendRequestSchema } from '@/modules/team-messaging/domain/models/team-message';
import { TeamMessagingError } from '@/modules/team-messaging/domain/errors/team-messaging-error';
import { createSecurityModule } from '@/modules/security/factories/security-module';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { moderateContent } from '@/lib/security/content-moderation';

const { rateLimitService } = createSecurityModule();

const errorResponse = (message: string, status = 500, code?: string) => {
  return NextResponse.json(
    {
      error: code ?? 'team_messaging_error',
      message,
    },
    { status },
  );
};

export async function GET(req: NextRequest) {
  const guard = await rateLimitService.guard(req, 'api:team-messages:get');

  if (!guard.result.allowed) {
    const response = NextResponse.json(rateLimitService.buildErrorPayload(guard.locale), {
      status: 429,
    });
    return rateLimitService.applyHeaders(response, guard.result);
  }

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      const response = errorResponse('Unauthorized', 401, 'unauthorized');
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const service = createTeamMessagingService();
    const threads = await service.listThreadsForUser(session.user.id);

    const response = NextResponse.json(threads);
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    console.error('[TeamMessaging] Failed to load threads', error);
    const response = errorResponse('Unable to load messages');
    return rateLimitService.applyHeaders(response, guard.result);
  }
}

export async function POST(req: NextRequest) {
  const guard = await rateLimitService.guard(req, 'api:team-messages:post');

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
    const payload = TeamMessageSendRequestSchema.parse(body);

    // ✅ SECURITY: Check for blocked words in message content
    const moderation = await moderateContent(payload.body);
    if (moderation.isBlocked) {
      const response = errorResponse(
        'Your message contains inappropriate content and cannot be sent.',
        400,
        'content_blocked'
      );
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      const response = errorResponse('Unauthorized', 401, 'unauthorized');
      return rateLimitService.applyHeaders(response, guard.result);
    }

    const service = createTeamMessagingService();
    const message = await service.sendMessage({
      senderId: session.user.id,
      recipientId: payload.recipientId,
      body: payload.body,
      parentMessageId: payload.parentMessageId ?? null,
    });

    const response = NextResponse.json(message, { status: 201 });
    return rateLimitService.applyHeaders(response, guard.result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = errorResponse('Invalid payload', 400, 'validation_error');
      return rateLimitService.applyHeaders(response, guard.result);
    }

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

    console.error('[TeamMessaging] Failed to send message', error);
    const response = errorResponse('Unable to send message');
    return rateLimitService.applyHeaders(response, guard.result);
  }
}
