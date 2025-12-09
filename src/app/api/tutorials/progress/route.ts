import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateUserProgress } from '@/modules/tutorials/services/tutorial-service';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

const UpdateProgressSchema = z.object({
  tutorialId: z.string().uuid(),
  currentStep: z.number().int().min(0),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(req);
  if (csrfError) {
    return csrfError;
  }

  // ✅ SECURITY FIX: Use proper Supabase authentication instead of x-user-id header
  // Previous implementation used x-user-id header which could be spoofed by attackers
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id; // ✅ This userId is authenticated and cannot be spoofed

  try {
    const body = await req.json();
    const parsed = UpdateProgressSchema.parse(body);

    const progress = await updateUserProgress(
      userId,
      parsed.tutorialId,
      parsed.currentStep,
      parsed.completed,
      parsed.skipped,
    );

    return NextResponse.json({ progress });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }

    console.error('[TutorialProgressAPI] Failed to update progress', error);
    return NextResponse.json(
      { error: 'Unable to update tutorial progress.' },
      { status: 500 },
    );
  }
}