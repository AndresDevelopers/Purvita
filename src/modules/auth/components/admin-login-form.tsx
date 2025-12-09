'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSafeSession, supabase } from '@/lib/supabase';
import { getCurrentUserProfile } from '@/lib/services/user-service';
import type { Locale } from '@/i18n/config';

export interface AdminLoginFormCopy {
  title?: string;
  subtitle?: string;
  emailLabel?: string;
  passwordLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
  unexpectedError?: string;
}

export interface AdminLoginFormProps {
  lang: Locale;
  copy?: AdminLoginFormCopy;
  redirectTo?: string;
}

export function AdminLoginForm({
  lang,
  copy,
  redirectTo = '/admin/dashboard',
}: AdminLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const hasRedirectedRef = useRef(false);

  // Check if user is already logged in as admin
  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      if (hasRedirectedRef.current) {
        return;
      }

      try {
        const {
          data: { session },
        } = await getSafeSession();

        if (!isMounted) {
          return;
        }

        // If there's a session, check if user is admin
        if (session?.user) {
          const profile = await getCurrentUserProfile();

          if (!isMounted) {
            return;
          }

          // Check if user has admin access (any permissions)
          if (profile) {
            // Use API route to check admin access instead of calling getUserPermissions directly
            // This prevents "cookies() called outside request scope" error
            try {
              const response = await fetch('/api/check-admin-access', {
                method: 'GET',
                credentials: 'include',
              });

              if (!isMounted) {
                return;
              }

              if (response.ok) {
                const data = await response.json();

                // If user has admin access, redirect to admin dashboard
                if (data.hasAccess === true) {
                  hasRedirectedRef.current = true;
                  const redirectUrl = new URL(redirectTo, window.location.origin);
                  redirectUrl.searchParams.set('lang', lang);
                  router.replace(`${redirectUrl.pathname}${redirectUrl.search}`);
                  return;
                }
              }
            } catch (error) {
              console.error('Error checking admin access:', error);
              // Continue to show login form if check fails
            }
          }
        }

        // If not admin or no session, show login form
        if (isMounted) {
          setIsCheckingSession(false);
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [lang, redirectTo, router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // ✅ SECURITY: Check rate limiting before attempting login
      const rateLimitResponse = await fetch('/api/admin/login-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (rateLimitResponse.ok) {
        const rateLimitData = await rateLimitResponse.json();
        if (rateLimitData.limited) {
          setError('Too many login attempts. Please try again in 5 minutes.');
          setLoading(false);
          return;
        }
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        await supabase.auth.signOut({ scope: 'local' });
        setError(signInError.message);
        return;
      }

      if (!data.session) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error('No session returned after successful admin authentication');
        }
      }

      const redirectUrl = new URL(redirectTo, window.location.origin);
      redirectUrl.searchParams.set('lang', lang);
      router.push(`${redirectUrl.pathname}${redirectUrl.search}`);
    } catch (_error) {
      await supabase.auth.signOut({ scope: 'local' });
      setError(copy?.unexpectedError ?? 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = copy?.submitLabel ?? 'Login';
  const submittingLabel = copy?.submittingLabel ?? 'Logging in...';

  // Show loading state while checking for existing session
  if (isCheckingSession) {
    return (
      <div className="container flex min-h-[80vh] items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Checking session...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">{copy?.title ?? 'Admin Login'}</CardTitle>
          <CardDescription>{copy?.subtitle ?? 'Sign in to access the admin panel'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{copy?.emailLabel ?? 'Email'}</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{copy?.passwordLabel ?? 'Password'}</Label>
                <Link
                  href={`/${lang}/auth/forgot-password`}
                  className="text-xs text-muted-foreground hover:text-primary underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? submittingLabel : submitLabel}
            </Button>
          </form>
          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
