import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { createSecurityModule } from '@/modules/security/factories/security-module';

const { rateLimitService } = createSecurityModule();

// Admin client for server-side operations
const getAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
};

export async function DELETE(request: NextRequest) {
    try {
        // ✅ SECURITY: Rate limiting to prevent abuse of account deletion
        const guard = await rateLimitService.guard(request, 'api:user:delete');
        if (!guard.result.allowed) {
            const response = NextResponse.json(
                rateLimitService.buildErrorPayload(guard.locale),
                { status: 429 }
            );
            return rateLimitService.applyHeaders(response, guard.result);
        }

        // Validate CSRF token
        const csrfError = await requireCsrfToken(request);
        if (csrfError) {
            return csrfError;
        }

        // Get the current user session
        const cookieStore = await cookies()
        const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            },
          },
        });

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Use admin client to delete
        const supabaseAdmin = getAdminClient();

        // Delete from profiles table first
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) {
            console.error('Profile delete error:', profileError);
            // ✅ SECURITY: Sanitize error message in production
            const errorMessage = process.env.NODE_ENV === 'production'
                ? 'Error deleting profile'
                : `Error deleting profile: ${profileError.message}`;
            return NextResponse.json(
                { error: errorMessage },
                { status: 400 }
            );
        }

        // Delete from auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            console.error('Auth delete error:', authError);
            // ✅ SECURITY: Sanitize error message in production
            const errorMessage = process.env.NODE_ENV === 'production'
                ? 'Error deleting user'
                : `Error deleting user: ${authError.message}`;
            return NextResponse.json(
                { error: errorMessage },
                { status: 400 }
            );
        }

        // Sign out the user from the current session
        await supabase.auth.signOut();

        const response = NextResponse.json({ message: 'Account deleted successfully' });
        return rateLimitService.applyHeaders(response, guard.result);
    } catch (error) {
        console.error('API error:', error);
        // ✅ SECURITY: Sanitize error message in production
        const errorMessage = process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : (error instanceof Error ? error.message : 'Internal server error');

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}