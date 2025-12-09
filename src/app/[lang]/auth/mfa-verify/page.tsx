'use client';

/**
 * MFA Verification Page
 * 
 * Page for verifying MFA during the login flow.
 * Users are redirected here after successful password authentication
 * if they have MFA enabled.
 */

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppDictionary } from '@/contexts/locale-content-context';
import type { MfaDictionary } from '@/modules/mfa/types';
import { defaultMfaDictionary } from '@/modules/mfa/types';

interface MfaVerifyPageProps {
  params: Promise<{ lang: Locale }>;
}

export default function MfaVerifyPage({ params }: MfaVerifyPageProps) {
  const { lang } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const dict = useAppDictionary();
  
  // Get MFA dictionary
  const mfaDictionary: MfaDictionary = {
    ...defaultMfaDictionary,
    ...((dict as any).mfa || {}),
  };

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const redirectPath = searchParams.get('redirect') || `/${lang}/dashboard`;

  // Check for MFA factors and create challenge
  const initializeMfa = useCallback(async () => {
    try {
      // Get MFA factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        console.error('[MFA Verify] Error listing factors:', factorsError);
        setError('Failed to initialize MFA verification');
        setIsLoading(false);
        return;
      }

      // Find verified TOTP factor
      const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified');

      if (!verifiedFactor) {
        // No MFA enabled, redirect to dashboard
        console.log('[MFA Verify] No verified MFA factor found, redirecting...');
        router.replace(redirectPath);
        return;
      }

      setFactorId(verifiedFactor.id);

      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });

      if (challengeError) {
        console.error('[MFA Verify] Error creating challenge:', challengeError);
        setError('Failed to create verification challenge');
        setIsLoading(false);
        return;
      }

      setChallengeId(challengeData.id);
      setIsLoading(false);
    } catch (err) {
      console.error('[MFA Verify] Initialization error:', err);
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  }, [router, redirectPath]);

  useEffect(() => {
    initializeMfa();
  }, [initializeMfa]);

  const handleVerify = async () => {
    if (!factorId || !challengeId || code.length !== 6) return;

    setIsVerifying(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (verifyError) {
        // If code is invalid or expired, create a new challenge
        if (verifyError.message.includes('expired')) {
          const { data: newChallenge } = await supabase.auth.mfa.challenge({
            factorId,
          });
          if (newChallenge) {
            setChallengeId(newChallenge.id);
          }
          setError(mfaDictionary.errors.expiredCode);
        } else {
          setError(mfaDictionary.errors.invalidCode);
        }
        setIsVerifying(false);
        return;
      }

      // Success! Redirect to intended destination
      window.location.href = redirectPath;
    } catch (err) {
      console.error('[MFA Verify] Verification error:', err);
      setError(mfaDictionary.errors.genericError);
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6 && !isVerifying) {
      handleVerify();
    }
  };

  const handleCancel = async () => {
    // Sign out and redirect to login
    await supabase.auth.signOut();
    router.replace(`/${lang}/auth/login`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container flex min-h-[80vh] items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
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
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">
            {mfaDictionary.verify.title}
          </CardTitle>
          <CardDescription>
            {mfaDictionary.verify.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">{mfaDictionary.verify.codeLabel}</Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={mfaDictionary.verify.codePlaceholder}
              value={code}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              className="text-center text-2xl tracking-widest font-mono"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || isVerifying}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mfaDictionary.verify.verifying}
                </>
              ) : (
                mfaDictionary.verify.verifyButton
              )}
            </Button>
            <Button variant="ghost" onClick={handleCancel} className="w-full">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
