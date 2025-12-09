
'use client';

import { Suspense, useEffect, useMemo, useState, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Locale } from '@/i18n/config';
import { supabase as _supabase } from '@/lib/supabase';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { CaptchaWidget, useCaptcha } from '@/components/captcha-widget';
import { sanitizeUserInput } from '@/lib/security/frontend-sanitization';

export default function RegisterPage(props: { params: Promise<{ lang: Locale }> }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <RegisterPageContent {...props} />
    </Suspense>
  );
}

function RegisterPageContent({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const dict = useAppDictionary();
  const searchParams = useSearchParams();
  const router = useRouter();
  const refCode = searchParams.get('ref');
  const sponsorParam = searchParams.get('sponsor');
  const { token: captchaToken, handleVerify, handleError: handleCaptchaError, handleExpire, executeV3, isEnabled } = useCaptcha();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessCodeStatus, setAccessCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resolvedSponsor, setResolvedSponsor] = useState<{
    name: string | null;
    email: string | null;
  } | null>(null);

  const normalizedReferral = useMemo(() => referral.trim(), [referral]);
  const referralInvalidMessage = useMemo(
    () => dict.auth?.referralInvalid ?? 'Invalid referral code provided.',
    [dict.auth?.referralInvalid],
  );
  const registrationCodeInvalidMessage = useMemo(
    () => dict.auth?.registrationCodeInvalid ?? 'The registration code is invalid or expired.',
    [dict.auth?.registrationCodeInvalid],
  );
  const registrationCodeVerifiedMessage = useMemo(
    () =>
      dict.auth?.registrationCodeVerified ??
      'Access code verified. Finish the form to complete your registration.',
    [dict.auth?.registrationCodeVerified],
  );
  const referralResolvedMessage = useMemo(() => {
    if (!resolvedSponsor) {
      return null;
    }

    const value = [resolvedSponsor.name, resolvedSponsor.email].filter(Boolean).join(' • ');

    if (value) {
      return (dict.auth?.referralResolved ?? 'Sponsor confirmed: {{value}}').replace('{{value}}', value);
    }

    return dict.auth?.referralResolvedAnonymous ?? 'Sponsor confirmed! Your account will join their network automatically.';
  }, [dict.auth?.referralResolved, dict.auth?.referralResolvedAnonymous, resolvedSponsor]);

  // We use useEffect to safely interact with the DOM after the component mounts
  useEffect(() => {
    const initial = refCode ?? sponsorParam;
    if (initial) {
      setReferral(initial);
    }
  }, [refCode, sponsorParam]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResolvedSponsor(null);
    setSuccess(false);

    // Validate password confirmation
    if (password !== confirmPassword) {
      setLoading(false);
      setError(dict.auth?.passwordsDoNotMatch ?? 'Passwords do not match');
      return;
    }

    const sanitizedAccessCode = accessCode.trim();

    if (!sanitizedAccessCode) {
      setLoading(false);
      setAccessCodeStatus('invalid');
      setError(dict.auth?.registrationCodeRequired ?? 'A registration code is required.');
      return;
    }

    setAccessCodeStatus('validating');

    try {
      const validationResponse = await fetch('/api/auth/registration-code/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: sanitizedAccessCode }),
      });

      if (!validationResponse.ok) {
        setAccessCodeStatus('invalid');
        const payload = await validationResponse.json().catch(() => ({ reason: 'mismatch' }));
        const reason = typeof payload.reason === 'string' ? payload.reason : 'mismatch';
        if (reason === 'missing') {
          setError(dict.auth?.registrationCodeRequired ?? 'A registration code is required.');
        } else {
          setError(registrationCodeInvalidMessage);
        }
        return;
      }

      setAccessCodeStatus('valid');

      let sponsorMetadata: {
        sponsorId: string;
        referralCode: string | null;
        normalizedCode: string;
        sponsor: { name: string | null; email: string | null };
      } | null = null;

      if (normalizedReferral) {
        const response = await fetch('/api/referrals/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: normalizedReferral }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: referralInvalidMessage }));
          const rawMessage = typeof payload.error === 'string' ? payload.error : referralInvalidMessage;
          // ✅ SECURITY: Sanitize error message before displaying
          setError(sanitizeUserInput(rawMessage));
          return;
        }

        const payload = (await response.json()) as {
          sponsorId: string;
          normalizedCode: string;
          referralCode: string | null;
          sponsor: { name: string | null; email: string | null };
        };

        sponsorMetadata = {
          sponsorId: payload.sponsorId,
          referralCode: payload.referralCode,
          normalizedCode: payload.normalizedCode,
          sponsor: payload.sponsor,
        };

        setReferral(payload.normalizedCode);
        setResolvedSponsor(payload.sponsor);
      }

      // Generate a unique referral code for the new user
      const userReferralCode = await generateReferralCode(name);

      const metadata: Record<string, string> = {
        name,
        referral_code: userReferralCode,
      };

      if (sponsorMetadata) {
        metadata.referred_by = sponsorMetadata.sponsorId;
        metadata.sponsor_id = sponsorMetadata.sponsorId;
        if (sponsorMetadata.referralCode) {
          metadata.referred_by_code = sponsorMetadata.referralCode;
        } else {
          metadata.referred_by_code = sponsorMetadata.normalizedCode;
        }
      }

      // Execute reCAPTCHA v3 if CAPTCHA is enabled and no token yet
      let finalCaptchaToken = captchaToken;
      if (isEnabled && !finalCaptchaToken) {
        finalCaptchaToken = await executeV3('register');
      }

      // Build request body
      const requestBody: { email: string; password: string; name: string; metadata: Record<string, string>; captchaToken?: string | null; website?: string } = {
        email,
        password,
        name,
        metadata,
        website: '', // Honeypot field
      };

      // Only include captchaToken if CAPTCHA is enabled
      if (isEnabled) {
        requestBody.captchaToken = finalCaptchaToken;
      }

      // Call our API endpoint which has CAPTCHA verification and rate limiting
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // ✅ SECURITY: Sanitize error message before displaying
        const rawMessage = responseData.message || 'Registration failed';
        setError(sanitizeUserInput(rawMessage));
      } else {
        setSuccess(true);
        const data = responseData;

        // Subscribe to Mailchimp (non-blocking)
        fetch('/api/auth/mailchimp-subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, name }),
        }).catch((err) => {
          console.error('Failed to subscribe to Mailchimp:', err);
        });

        // Send team member notification to sponsor if there is one (non-blocking)
        if (data?.user?.id && sponsorMetadata?.sponsorId) {
          fetch('/api/notifications/team-member-added', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sponsorId: sponsorMetadata.sponsorId,
              newMemberId: data.user.id,
            }),
          }).catch((err) => {
            console.error('Failed to send team member notification:', err);
          });
        }

        // Redirect to login after successful registration
        setTimeout(() => {
          router.push(`/${lang}/auth/login`);
        }, 2000);
      }
    } catch (_err) {
      setAccessCodeStatus((previous) => (previous === 'valid' ? previous : 'invalid'));
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      setAccessCodeStatus((previous) => {
        if (previous === 'valid' || previous === 'invalid') {
          return previous;
        }

        return 'idle';
      });
    }
  };

  // Helper function to generate referral code (server-side for security)
  const generateReferralCode = async (name: string): Promise<string> => {
    try {
      const response = await fetch('/api/auth/generate-referral-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate referral code');
      }

      const data = await response.json();
      return data.referralCode;
    } catch (error) {
      console.error('Error generating referral code:', error);
      // Fallback to client-side generation if server fails
      const baseCode = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
      return `${baseCode}${Math.random().toString(36).substring(2, 6)}`;
    }
  };

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-12">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">{dict.auth.registerTitle}</CardTitle>
          <CardDescription>{dict.auth.registerSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Honeypot field - hidden from users, only bots will fill it */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
              aria-hidden="true"
            />
            <div className="space-y-2">
              <Label htmlFor="name">{dict.auth.nameLabel}</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{dict.auth.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{dict.auth.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{dict.auth.passwordConfirmLabel}</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder={dict.auth.passwordConfirmPlaceholder}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-code">{dict.auth.registrationCodeLabel}</Label>
              <Input
                id="registration-code"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                placeholder={dict.auth.registrationCodePlaceholder}
                required
                value={accessCode}
                onChange={(e) => {
                  setAccessCode(e.target.value);
                  setAccessCodeStatus('idle');
                }}
              />
              {accessCodeStatus === 'validating' ? (
                <p className="text-xs text-muted-foreground">{dict.auth.registrationCodeChecking ?? 'Validating registration code...'}</p>
              ) : null}
              {accessCodeStatus === 'valid' ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-300">{registrationCodeVerifiedMessage}</p>
              ) : null}
              {accessCodeStatus === 'invalid' ? (
                <p className="text-xs text-destructive">{registrationCodeInvalidMessage}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral">{dict.auth.referralLabel}</Label>
              <Input
                id="referral"
                type="text"
                placeholder={dict.auth.referralPlaceholder}
                value={referral}
                readOnly
              />
              {referralResolvedMessage ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-300">{referralResolvedMessage}</p>
              ) : null}
            </div>
            <CaptchaWidget
              onVerify={handleVerify}
              onError={handleCaptchaError}
              onExpire={handleExpire}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Registering...' : dict.navigation.register}
            </Button>
          </form>
          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mt-4">
              <AlertDescription>
                Registration successful! Please check your email to confirm your account.
              </AlertDescription>
            </Alert>
          )}
          <div className="mt-4 text-center text-sm">
            {dict.auth.haveAccount}{' '}
            <Link href={`/${lang}/auth/login`} className="underline hover:text-primary">
              {dict.navigation.login}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
