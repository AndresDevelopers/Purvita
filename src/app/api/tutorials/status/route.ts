import { NextResponse } from 'next/server';
import { getUserTutorialStatus } from '@/modules/tutorials/services/tutorial-service';
import { withAuth } from '@/lib/auth/with-auth';

/**
 * GET /api/tutorials/status
 * SECURED: Uses Supabase session authentication
 */
export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;

  try {
    const status = await getUserTutorialStatus(userId);
    return NextResponse.json({ status });
  } catch (error) {
    console.error('[TutorialStatusAPI] Failed to fetch tutorial status', error);
    return NextResponse.json(
      { error: 'Unable to fetch tutorial status.' },
      { status: 500 },
    );
  }
});