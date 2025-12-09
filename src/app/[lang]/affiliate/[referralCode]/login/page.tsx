'use client';

import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AppDictionary } from '@/i18n/dictionaries';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import { CaptchaWidget, useCaptcha } from '@/components/captcha-widget';
import { sanitizeUserInput } from '@/lib/security/frontend-sanitization';
import { fetchWithCsrf } from '@/lib/utils/admin-csrf-helpers';

interface AffiliateLoginPageProps {
  params: Promise<{ lang: Locale; referralCode: string }>;
}

interface LoginFormProps {
  lang: Locale;
  dict: AppDictionary;
  router: ReturnType<typeof useRouter>;
  referralCode: string;
}

interface LoginState {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
}

const useLoginState = () => {
  const [state, setState] = useState<LoginState>({
    email: '',
    password: '',
    loading: false,
    error: null,
  });

  const setField = <K extends keyof LoginState>(key: K, value: LoginState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  return {
    state,
    setField,
    setError: (value: string | null) => setField('error', value),
    setLoading: (value: boolean) => setField('loading', value),
  };
};

const DesktopLoginForm = ({ dict, lang, router: _router, referralCode }: LoginFormProps) => {
  const { state, setField, setError, setLoading } = useLoginState();
  const { token: captchaToken, handleVerify, handleError: handleCaptchaError, handleExpire, executeV3, isEnabled } = useCaptcha();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Execute reCAPTCHA v3 if CAPTCHA is enabled and no token yet
      let finalCaptchaToken = captchaToken;
      if (isEnabled && !finalCaptchaToken) {
        finalCaptchaToken = await executeV3('login');
      }

      // Build request body with honeypot
      const requestBody: { email: string; password: string; captchaToken?: string | null; website?: string } = {
        email: state.email,
        password: state.password,
        website: '', // Honeypot field - should always be empty
      };

      // Only include captchaToken if CAPTCHA is enabled
      if (isEnabled) {
        requestBody.captchaToken = finalCaptchaToken;
      }

      // Call our API endpoint which has rate limiting and security protection
      const response = await fetchWithCsrf('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? `${retryAfter} seconds` : 'a minute';
          setError(sanitizeUserInput(`Too many login attempts. Please wait ${waitTime} before trying again.`));
          return;
        }

        // Handle other errors - sanitize server messages
        const rawMessage = data.message || 'Invalid email or password';
        setError(sanitizeUserInput(rawMessage));
        return;
      }

      // Login successful - update Supabase session state
      if (data.session) {
        const session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
        };

        // Cookies are managed automatically by @supabase/ssr
        // Update Supabase client state - this triggers onAuthStateChange listeners
        await supabase.auth.setSession(session as any);

        // Small delay to allow event propagation
        await new Promise(resolve => setTimeout(resolve, 150));

        // Redirect back to affiliate store
        const destination = `/${lang}/affiliate/${referralCode}`;

        // Use window.location.href for a full page reload to ensure all components
        // (including header) get the updated session from cookies
        window.location.href = destination;
        return;
      }
    } catch (err) {
      console.error('Login error:', err);
      const rawMessage = dict.auth?.unexpectedError ?? 'An unexpected error occurred';
      setError(sanitizeUserInput(rawMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">{dict.auth.loginTitle}</CardTitle>
          <CardDescription>{dict.auth.loginSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Honeypot field - hidden from users, only bots will fill it */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="sr-only absolute -left-[9999px] h-px w-px"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <Label htmlFor="email">{dict.auth.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={state.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{dict.auth.passwordLabel}</Label>
                <Link
                  href={`/${lang}/auth/forgot-password`}
                  className="text-xs text-muted-foreground hover:text-primary underline"
                >
                  {dict.auth.forgotPassword}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={state.password}
                onChange={(event) => setField('password', event.target.value)}
              />
            </div>
            <CaptchaWidget
              onVerify={handleVerify}
              onError={handleCaptchaError}
              onExpire={handleExpire}
            />
            <Button type="submit" className="w-full" disabled={state.loading}>
              {state.loading ? dict.auth?.loggingIn ?? 'Logging in...' : dict.navigation.login}
            </Button>
          </form>
          {state.error && (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="mt-4 text-center text-sm">
            {dict.auth.noAccount}{' '}
            <Link href={`/${lang}/affiliate/${referralCode}/register`} className="underline hover:text-primary">
              {dict.navigation.register}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MobileLoginForm = ({ dict, lang, router: _router, referralCode }: LoginFormProps) => {
  const { state, setField, setError, setLoading } = useLoginState();
  const { token: captchaToken, handleVerify, handleError: handleCaptchaError, handleExpire, executeV3, isEnabled } = useCaptcha();
  const redirectedRef = useRef(false);

  const redirectToDestination = useCallback(() => {
    if (redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    const destination = `/${lang}/affiliate/${referralCode}`;

    // Use window.location.href for a full page reload to ensure all components
    // (including header) get the updated session from cookies
    window.location.href = destination;
  }, [lang, referralCode]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Execute reCAPTCHA v3 if CAPTCHA is enabled and no token yet
      let finalCaptchaToken = captchaToken;
      if (isEnabled && !finalCaptchaToken) {
        finalCaptchaToken = await executeV3('login');
      }

      // Build request body with honeypot
      const requestBody: { email: string; password: string; captchaToken?: string | null; website?: string } = {
        email: state.email,
        password: state.password,
        website: '', // Honeypot field - should always be empty
      };

      // Only include captchaToken if CAPTCHA is enabled
      if (isEnabled) {
        requestBody.captchaToken = finalCaptchaToken;
      }

      // Call our API endpoint which has rate limiting and security protection
      const response = await fetchWithCsrf('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? `${retryAfter} seconds` : 'a minute';
          setError(sanitizeUserInput(`Too many login attempts. Please wait ${waitTime} before trying again.`));
          return;
        }

        // Handle other errors - sanitize server messages
        const rawMessage = data.message || 'Invalid email or password';
        setError(sanitizeUserInput(rawMessage));
        return;
      }

      // Login successful - update Supabase session state
      if (data.session) {
        const session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
        };

        // Cookies are managed automatically by @supabase/ssr
        // Update Supabase client state - this triggers onAuthStateChange listeners
        await supabase.auth.setSession(session as any);

        // Small delay to allow event propagation
        await new Promise(resolve => setTimeout(resolve, 150));

        redirectToDestination();
        return;
      }
    } catch (err) {
      console.error('Login error:', err);
      const rawMessage = dict.auth?.unexpectedError ?? 'An unexpected error occurred';
      setError(sanitizeUserInput(rawMessage));
    } finally {
      setLoading(false);
    }
  };

  const helperText = useMemo(() => dict.auth.loginSubtitle, [dict.auth.loginSubtitle]);

  return (
    <div className="flex min-h-[100svh] flex-col justify-center gap-8 bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm space-y-3 text-center">
        <h1 className="text-3xl font-headline tracking-tight">{dict.auth.loginTitle}</h1>
        <p className="text-sm text-muted-foreground">{helperText}</p>
      </div>
      <form onSubmit={handleLogin} className="mx-auto flex w-full max-w-sm flex-col gap-4">
        {/* Honeypot field - hidden from users, only bots will fill it */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="sr-only absolute -left-[9999px] h-px w-px"
          aria-hidden="true"
        />
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
            onChange={(event) => setField('email', event.target.value)}
            className="h-12 rounded-xl border-muted"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="mobile-password" className="text-left text-sm font-semibold">
              {dict.auth.passwordLabel}
            </Label>
            <Link
              href={`/${lang}/auth/forgot-password`}
              className="text-xs text-muted-foreground hover:text-primary underline"
            >
              {dict.auth.forgotPassword}
            </Link>
          </div>
          <Input
            id="mobile-password"
            type="password"
            autoComplete="current-password"
            required
            value={state.password}
            onChange={(event) => setField('password', event.target.value)}
            className="h-12 rounded-xl border-muted"
          />
        </div>
        <CaptchaWidget
          onVerify={handleVerify}
          onError={handleCaptchaError}
          onExpire={handleExpire}
        />
        <Button type="submit" size="lg" className="h-12 rounded-xl" disabled={state.loading}>
          {state.loading ? dict.auth?.loggingIn ?? 'Logging in...' : dict.navigation.login}
        </Button>
        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <div className="text-center text-sm">
          {dict.auth.noAccount}{' '}
          <Link href={`/${lang}/affiliate/${referralCode}/register`} className="font-semibold text-primary underline">
            {dict.navigation.register}
          </Link>
        </div>
      </form>
    </div>
  );
};

export default function AffiliateLoginPage({ params }: AffiliateLoginPageProps) {
  const { lang, referralCode } = use(params);
  const dict = useAppDictionary();
  const router = useRouter();
  const isMobile = useIsMobile();
  const supabaseUser = useSupabaseUser();
  const [view, setView] = useState<'mobile' | 'desktop'>('mobile');
  const [hasRedirected, setHasRedirected] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (hasRedirected) {
      return;
    }

    if (!supabaseUser.isLoading && supabaseUser.isAuthenticated) {
      setHasRedirected(true);
      router.replace(`/${lang}/affiliate/${referralCode}`);
    }
  }, [hasRedirected, lang, referralCode, router, supabaseUser.isAuthenticated, supabaseUser.isLoading]);

  useEffect(() => {
    setView(isMobile ? 'mobile' : 'desktop');
  }, [isMobile]);

  if (view === 'mobile') {
    return <MobileLoginForm dict={dict} lang={lang} router={router} referralCode={referralCode} />;
  }

  return <DesktopLoginForm dict={dict} lang={lang} router={router} referralCode={referralCode} />;
}

