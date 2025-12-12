import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/with-auth';
import { requireCsrfToken } from '@/lib/security/csrf-protection';

// Validation schema for email update
const UpdateEmailSchema = z.object({
  newEmail: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase()
    .trim(),
  currentPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/settings/email
 * Update user email with server-side validation
 * 
 * Security features:
 * - Zod schema validation
 * - Current password verification
 * - Email format validation
 * - Authentication required
 */
export const POST = withAuth<any>(async (request) => {
  // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
  const csrfError = await requireCsrfToken(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    
    // Validate request body with Zod
    const validationResult = UpdateEmailSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }
    
    const { newEmail, currentPassword } = validationResult.data;
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify current password by attempting to sign in
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });
    
    if (passwordError) {
      return NextResponse.json(
        { error: 'Invalid current password' },
        { status: 401 }
      );
    }
    
    // Check if new email is already in use
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .neq('id', user.id)
      .single();
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      );
    }
    
    // Update email in Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail,
    });
    
    if (updateError) {
      console.error('Error updating email:', updateError);
      return NextResponse.json(
        { error: 'Failed to update email' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Email updated successfully. Please check your new email for confirmation.',
    });
    
  } catch (error) {
    console.error('Error in email update endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

