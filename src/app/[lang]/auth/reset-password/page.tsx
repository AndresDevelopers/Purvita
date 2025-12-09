'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useAppDictionary } from '@/contexts/locale-content-context';
import type { Locale } from '@/i18n/config';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResetPasswordState {
  password: string;
  confirmPassword: string;
  loading: boolean;
  error: string | null;
  success: boolean;
}

const DesktopResetPasswordForm = ({ lang }: { lang: Locale }) => {
  const dict = useAppDictionary();
  const router = useRouter();
  const [state, setState] = useState<ResetPasswordState>({
    password: '',
    confirmPassword: '',
    loading: false,
    error: null,
    success: false,
  });
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid session (Supabase handles the token from the URL)
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setValidToken(false);
      } else {
        setValidToken(true);
      }
    };
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: null }));

    // Validate passwords match
    if (state.password.trim() !== state.confirmPassword.trim()) {
      setState(prev => ({
        ...prev,
        error: dict.auth.passwordsDoNotMatch,
        loading: false
      }));
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: state.password.trim(),
      });

      if (error) {
        setState(prev => ({ ...prev, error: error.message, loading: false }));
      } else {
        setState(prev => ({ ...prev, success: true, loading: false }));
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push(`/${lang}/auth/login`);
        }, 2000);
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setState(prev => ({
        ...prev,
        error: dict.auth?.unexpectedError ?? 'An unexpected error occurred',
        loading: false
      }));
    }
  };

  if (validToken === null) {
    return (
      <div className="container flex min-h-[80vh] items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Loading...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div className="container flex min-h-[80vh] items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">
              {dict.auth.invalidResetLink}
            </CardTitle>
            <CardDescription>
              The password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <Link
                href={`/${lang}/auth/forgot-password`}
                className="text-sm text-primary underline hover:text-primary/80"
              >
                {dict.auth.forgotPassword}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="container flex min-h-[80vh] items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">
              {dict.auth.passwordResetSuccess}
            </CardTitle>
            <CardDescription>
              Redirecting to login...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <Link
                href={`/${lang}/auth/login`}
                className="text-sm text-primary underline hover:text-primary/80"
              >
                {dict.auth.backToLogin}
              </Link>
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
          <CardTitle className="text-2xl font-headline">
            {dict.auth.resetPasswordTitle}
          </CardTitle>
          <CardDescription>
            {dict.auth.resetPasswordSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{dict.auth.newPasswordLabel}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={state.password}
                onChange={(e) => setState(prev => ({ ...prev, password: e.target.value }))}
                disabled={state.loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{dict.auth.passwordConfirmLabel}</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={state.confirmPassword}
                onChange={(e) => setState(prev => ({ ...prev, confirmPassword: e.target.value }))}
                disabled={state.loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={state.loading}>
              {state.loading ? dict.auth.resettingPassword : dict.auth.resetPasswordButton}
            </Button>
          </form>
          {state.error && (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="mt-4 text-center text-sm">
            <Link
              href={`/${lang}/auth/login`}
              className="text-primary underline hover:text-primary/80"
            >
              {dict.auth.backToLogin}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MobileResetPasswordForm = ({ lang }: { lang: Locale }) => {
  const dict = useAppDictionary();
  const router = useRouter();
  const [state, setState] = useState<ResetPasswordState>({
    password: '',
    confirmPassword: '',
    loading: false,
    error: null,
    success: false,
  });
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid session (Supabase handles the token from the URL)
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setValidToken(false);
      } else {
        setValidToken(true);
      }
    };
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: null }));

    // Validate passwords match
    if (state.password.trim() !== state.confirmPassword.trim()) {
      setState(prev => ({
        ...prev,
        error: dict.auth.passwordsDoNotMatch,
        loading: false
      }));
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: state.password.trim(),
      });

      if (error) {
        setState(prev => ({ ...prev, error: error.message, loading: false }));
      } else {
        setState(prev => ({ ...prev, success: true, loading: false }));
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push(`/${lang}/auth/login`);
        }, 2000);
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setState(prev => ({
        ...prev,
        error: dict.auth?.unexpectedError ?? 'An unexpected error occurred',
        loading: false
      }));
    }
  };

  if (validToken === null) {
    return (
      <div className="flex min-h-[100svh] flex-col justify-center gap-8 bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-sm text-center text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div className="flex min-h-[100svh] flex-col justify-center gap-8 bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-sm space-y-3 text-center">
          <h1 className="text-3xl font-headline tracking-tight">
            {dict.auth.invalidResetLink}
          </h1>
          <p className="text-sm text-muted-foreground">
            The password reset link is invalid or has expired. Please request a new one.
          </p>
        </div>
        <div className="mx-auto w-full max-w-sm text-center">
          <Link
            href={`/${lang}/auth/forgot-password`}
            className="font-semibold text-primary underline"
          >
            {dict.auth.forgotPassword}
          </Link>
        </div>
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="flex min-h-[100svh] flex-col justify-center gap-8 bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-sm space-y-3 text-center">
          <h1 className="text-3xl font-headline tracking-tight">
            {dict.auth.passwordResetSuccess}
          </h1>
          <p className="text-sm text-muted-foreground">
            Redirecting to login...
          </p>
        </div>
        <div className="mx-auto w-full max-w-sm text-center">
          <Link
            href={`/${lang}/auth/login`}
            className="font-semibold text-primary underline"
          >
            {dict.auth.backToLogin}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col justify-center gap-8 bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-3 text-center">
        <h1 className="text-3xl font-headline tracking-tight">
          {dict.auth.resetPasswordTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.auth.resetPasswordSubtitle}
        </p>
      </div>
      <form onSubmit={handleResetPassword} className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <div className="space-y-1">
          <Label htmlFor="mobile-password" className="text-left text-sm font-semibold">
            {dict.auth.newPasswordLabel}
          </Label>
          <Input
            id="mobile-password"
            type="password"
            required
            minLength={8}
            value={state.password}
            onChange={(e) => setState(prev => ({ ...prev, password: e.target.value }))}
            className="h-12 rounded-xl border-muted"
            disabled={state.loading}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mobile-confirmPassword" className="text-left text-sm font-semibold">
            {dict.auth.passwordConfirmLabel}
          </Label>
          <Input
            id="mobile-confirmPassword"
            type="password"
            required
            minLength={8}
            value={state.confirmPassword}
            onChange={(e) => setState(prev => ({ ...prev, confirmPassword: e.target.value }))}
            className="h-12 rounded-xl border-muted"
            disabled={state.loading}
          />
        </div>
        <Button type="submit" size="lg" className="h-12 rounded-xl" disabled={state.loading}>
          {state.loading ? dict.auth.resettingPassword : dict.auth.resetPasswordButton}
        </Button>
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <div className="text-center text-sm">
          <Link
            href={`/${lang}/auth/login`}
            className="font-semibold text-primary underline"
          >
            {dict.auth.backToLogin}
          </Link>
        </div>
      </form>
    </div>
  );
};

export default function ResetPasswordPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileResetPasswordForm lang={lang} />;
  }

  return <DesktopResetPasswordForm lang={lang} />;
}
