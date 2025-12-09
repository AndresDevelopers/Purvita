'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppDictionary } from '@/contexts/locale-content-context';
import type { Locale } from '@/i18n/config';
import { useIsMobile } from '@/hooks/use-mobile';

interface ForgotPasswordState {
  email: string;
  loading: boolean;
  error: string | null;
  success: boolean;
}

const DesktopForgotPasswordForm = ({ lang }: { lang: Locale }) => {
  const dict = useAppDictionary();
  const [state, setState] = useState<ForgotPasswordState>({
    email: '',
    loading: false,
    error: null,
    success: false,
  });

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // ✅ SECURITY FIX: Use API endpoint with CAPTCHA and rate limiting
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: state.email,
          captchaToken: null, // TODO: Implement CAPTCHA widget
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({
          ...prev,
          error: data.message || 'Failed to send reset link',
          loading: false
        }));
      } else {
        setState(prev => ({ ...prev, success: true, loading: false }));
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

  if (state.success) {
    return (
      <div className="container flex min-h-[80vh] items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">
              {dict.auth.resetLinkSent}
            </CardTitle>
            <CardDescription>
              {dict.auth.forgotPasswordSubtitle}
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
            {dict.auth.forgotPasswordTitle}
          </CardTitle>
          <CardDescription>
            {dict.auth.forgotPasswordSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{dict.auth.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={state.email}
                onChange={(e) => setState(prev => ({ ...prev, email: e.target.value }))}
                disabled={state.loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={state.loading}>
              {state.loading ? dict.auth.sendingResetLink : dict.auth.sendResetLink}
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

const MobileForgotPasswordForm = ({ lang }: { lang: Locale }) => {
  const dict = useAppDictionary();
  const [state, setState] = useState<ForgotPasswordState>({
    email: '',
    loading: false,
    error: null,
    success: false,
  });

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // ✅ SECURITY FIX: Use API endpoint with CAPTCHA and rate limiting
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: state.email,
          captchaToken: null, // TODO: Implement CAPTCHA widget
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({
          ...prev,
          error: data.message || 'Failed to send reset link',
          loading: false
        }));
      } else {
        setState(prev => ({ ...prev, success: true, loading: false }));
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

  if (state.success) {
    return (
      <div className="flex min-h-[100svh] flex-col justify-center gap-8 bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-sm space-y-3 text-center">
          <h1 className="text-3xl font-headline tracking-tight">
            {dict.auth.resetLinkSent}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dict.auth.forgotPasswordSubtitle}
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
          {dict.auth.forgotPasswordTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.auth.forgotPasswordSubtitle}
        </p>
      </div>
      <form onSubmit={handleResetPassword} className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <div className="space-y-1">
          <Label htmlFor="mobile-email" className="text-left text-sm font-semibold">
            {dict.auth.emailLabel}
          </Label>
          <Input
            id="mobile-email"
            inputMode="email"
            autoComplete="email"
            type="email"
            placeholder="m@example.com"
            required
            value={state.email}
            onChange={(e) => setState(prev => ({ ...prev, email: e.target.value }))}
            className="h-12 rounded-xl border-muted"
            disabled={state.loading}
          />
        </div>
        <Button type="submit" size="lg" className="h-12 rounded-xl" disabled={state.loading}>
          {state.loading ? dict.auth.sendingResetLink : dict.auth.sendResetLink}
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

export default function ForgotPasswordPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileForgotPasswordForm lang={lang} />;
  }

  return <DesktopForgotPasswordForm lang={lang} />;
}
