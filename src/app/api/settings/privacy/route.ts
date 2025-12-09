import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/settings/privacy
 * Get user's privacy preferences
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('show_reviews, allow_personalized_recommendations, allow_team_messages')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching privacy settings:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch privacy settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      showReviews: profile.show_reviews ?? true,
      allowPersonalizedRecommendations: profile.allow_personalized_recommendations ?? true,
      allowTeamMessages: profile.allow_team_messages ?? true,
    });
  } catch (error) {
    console.error('Error in GET /api/settings/privacy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/privacy
 * Update user's privacy preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate and map the request body
    const updates: Record<string, boolean> = {};
    
    if (typeof body.showReviews === 'boolean') {
      updates.show_reviews = body.showReviews;
    }
    if (typeof body.allowPersonalizedRecommendations === 'boolean') {
      updates.allow_personalized_recommendations = body.allowPersonalizedRecommendations;
    }
    if (typeof body.allowTeamMessages === 'boolean') {
      updates.allow_team_messages = body.allowTeamMessages;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid privacy settings provided' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating privacy settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to update privacy settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Privacy settings updated successfully' 
    });
  } catch (error) {
    console.error('Error in PATCH /api/settings/privacy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
