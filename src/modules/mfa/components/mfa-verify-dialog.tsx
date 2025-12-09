'use client';

/**
 * MFA Verify Dialog Component
 * 
 * A dialog for verifying MFA during login flow.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MfaDictionary } from '../types';
import { defaultMfaDictionary } from '../types';

interface MfaVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factorId: string;
  onVerified: () => void;
  onCancel?: () => void;
  dictionary?: Partial<MfaDictionary>;
}

export function MfaVerifyDialog({
  open,
  onOpenChange,
  factorId,
  onVerified,
  onCancel,
  dictionary,
}: MfaVerifyDialogProps) {
  const dict = { ...defaultMfaDictionary, ...dictionary };
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  // Create a new challenge when dialog opens
  const createChallenge = useCallback(async () => {
    if (!factorId) return;

    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      if (data) {
        setChallengeId(data.id);
      }
    } catch (err) {
      console.error('[MfaVerifyDialog] Error creating challenge:', err);
      setError(dict.errors.genericError);
    }
  }, [factorId, dict.errors.genericError]);

  useEffect(() => {
    if (open && factorId) {
      setCode('');
      setError(null);
      createChallenge();
    }
  }, [open, factorId, createChallenge]);

  const handleVerify = async () => {
    if (!challengeId || code.length !== 6) return;

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
        if (verifyError.message.includes('expired') || verifyError.message.includes('invalid')) {
          await createChallenge();
        }
        setError(verifyError.message);
        return;
      }

      // Success!
      onVerified();
    } catch (err) {
      console.error('[MfaVerifyDialog] Verification error:', err);
      setError(dict.errors.genericError);
    } finally {
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

  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>{dict.verify.title}</DialogTitle>
          </div>
          <DialogDescription>{dict.verify.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">{dict.verify.codeLabel}</Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={dict.verify.codePlaceholder}
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

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || isVerifying}
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {dict.verify.verifying}
                </>
              ) : (
                dict.verify.verifyButton
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
