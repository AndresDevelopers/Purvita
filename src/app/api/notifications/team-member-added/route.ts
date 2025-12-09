import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotificationModule } from '@/modules/notifications/factories/notification-module';
import { NotificationEmailService } from '@/modules/notifications/services/notification-email-service';
import { z } from 'zod';
import { withAdminAuth } from '@/lib/auth/with-auth';

const TeamMemberAddedSchema = z.object({
  sponsorId: z.string().uuid(),
  newMemberId: z.string().uuid(),
});

/**
 * POST /api/notifications/team-member-added
 * Send notification when a new team member is added
 * This is called internally after user registration
 *
 * ✅ SECURITY: This endpoint is protected by admin authentication
 * Previous implementation had no authentication, allowing anyone to trigger notifications
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    
    let validated;
    try {
      validated = TeamMemberAddedSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request payload', details: error.flatten() },
          { status: 400 }
        );
      }
      throw error;
    }

    const supabase = await createClient();

    // Get sponsor information
    const { data: sponsor } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', validated.sponsorId)
      .single();

    if (!sponsor) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
    }

    // Get new member information
    const { data: newMember } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', validated.newMemberId)
      .single();

    if (!newMember) {
      return NextResponse.json({ error: 'New member not found' }, { status: 404 });
    }

    // Check if sponsor has team update notifications enabled
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('team_updates')
      .eq('user_id', sponsor.id)
      .single();

    // If no preferences exist or team_updates is enabled (default is true)
    const teamUpdatesEnabled = preferences?.team_updates ?? true;

    if (!teamUpdatesEnabled) {
      return NextResponse.json({ 
        success: true, 
        message: 'Sponsor has team updates disabled' 
      });
    }

    // Send notification email
    const { repository } = await createNotificationModule();
    const emailService = new NotificationEmailService(repository);

    await emailService.notifyTeamMemberAdded({
      sponsorEmail: sponsor.email,
      sponsorName: sponsor.name,
      newMemberName: newMember.name,
      newMemberEmail: newMember.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending team member notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
});

