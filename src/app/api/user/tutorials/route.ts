import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's tutorial status
    const { data: tutorialStatus, error } = await supabase
      .rpc('get_user_tutorial_status', { p_user_id: user.id });

    if (error) {
      console.error('Error fetching user tutorial status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tutorial status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tutorials: tutorialStatus || [] });
  } catch (error) {
    console.error('Error in GET /api/user/tutorials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
      return csrfError;
    }

    const supabase = await createClient();
    const body = await request.json();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tutorial_id, current_step, completed, skipped } = body;

    if (!tutorial_id) {
      return NextResponse.json(
        { error: 'Tutorial ID is required' },
        { status: 400 }
      );
    }

    const { data: result, error } = await supabase
      .rpc('update_tutorial_progress', {
        p_user_id: user.id,
        p_tutorial_id: tutorial_id,
        p_current_step: current_step ?? 0,
        p_completed: completed ?? false,
        p_skipped: skipped ?? false,
      });

    if (error) {
      console.error('Error updating tutorial progress:', error);
      return NextResponse.json(
        { error: 'Failed to update tutorial progress' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error('Error in POST /api/user/tutorials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}