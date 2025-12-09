'use client';

/**
 * MFA Setup Card Component
 * 
 * A card component for setting up and managing two-factor authentication.
 * Displays current status and allows enabling/disabling MFA.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Shield, ShieldCheck, ShieldOff, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import { useMfa } from '../hooks/use-mfa';
import type { MfaDictionary } from '../types';
import { defaultMfaDictionary } from '../types';

interface MfaSetupCardProps {
  dictionary?: Partial<MfaDictionary>;
  onStatusChange?: (enabled: boolean) => void;
}

export function MfaSetupCard({ dictionary, onStatusChange }: MfaSetupCardProps) {
  const dict = { ...defaultMfaDictionary, ...dictionary };
  const {
    isLoading,
    isEnabled,
    factors,
    enrollment,
    error,
    startEnrollment,
    verifyEnrollment,
    disableMfa,
    clearError,
    clearEnrollment,
  } = useMfa();

  const [verificationCode, setVerificationCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const handleStartEnrollment = async () => {
    clearError();
    const success = await startEnrollment();
    if (!success) {
      // Error is already set in the hook
    }
  };

  const handleVerify = async () => {
    if (!enrollment || verificationCode.length !== 6) return;

    setIsVerifying(true);
    const success = await verifyEnrollment(enrollment.id, verificationCode);
    setIsVerifying(false);

    if (success) {
      setVerificationCode('');
      onStatusChange?.(true);
    }
  };

  const handleDisable = async () => {
    const verifiedFactor = factors.find((f) => f.status === 'verified');
    if (!verifiedFactor) return;

    setIsDisabling(true);
    const success = await disableMfa(verifiedFactor.id);
    setIsDisabling(false);
    setShowDisableDialog(false);

    if (success) {
      onStatusChange?.(false);
    }
  };

  const handleCopySecret = useCallback(async () => {
    if (!enrollment?.totp.secret) return;

    try {
      await navigator.clipboard.writeText(enrollment.totp.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy secret:', err);
    }
  }, [enrollment?.totp.secret]);

  const handleCancel = () => {
    clearEnrollment();
    setVerificationCode('');
    clearError();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
  };

  // Loading state
  if (isLoading && !enrollment) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Enrollment flow
  if (enrollment) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>{dict.setup.title}</CardTitle>
          </div>
          <CardDescription>{dict.setup.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steps */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{dict.setup.step1}</p>
            <p>{dict.setup.step2}</p>
            <p>{dict.setup.step3}</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="rounded-lg border bg-white p-4">
              <div
                dangerouslySetInnerHTML={{ __html: enrollment.totp.qr_code }}
                className="h-48 w-48"
                aria-label={dict.setup.qrCodeAlt}
              />
            </div>
          </div>

          {/* Manual Entry */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{dict.setup.manualEntry}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                {enrollment.totp.secret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySecret}
                className="shrink-0"
              >
                {secretCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-2">
                  {secretCopied ? dict.setup.secretCopied : dict.setup.copySecret}
                </span>
              </Button>
            </div>
          </div>

          {/* Verification Code Input */}
          <div className="space-y-2">
            <Label htmlFor="verification-code">{dict.setup.verificationCode}</Label>
            <Input
              id="verification-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={dict.setup.verificationPlaceholder}
              value={verificationCode}
              onChange={handleCodeChange}
              className="text-center text-2xl tracking-widest font-mono"
              autoComplete="one-time-code"
            />
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              {dict.setup.cancelButton}
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verificationCode.length !== 6 || isVerifying}
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {dict.setup.verifying}
                </>
              ) : (
                dict.setup.verifyButton
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // MFA Enabled state
  if (isEnabled) {
    const verifiedFactor = factors.find((f) => f.status === 'verified');
    const enabledDate = verifiedFactor
      ? new Date(verifiedFactor.updatedAt).toLocaleDateString()
      : null;

    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <CardTitle>{dict.enabled.title}</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Active
              </Badge>
            </div>
            <CardDescription>{dict.enabled.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {enabledDate && (
              <p className="text-sm text-muted-foreground">
                {dict.enabled.lastUpdated}: {enabledDate}
              </p>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              variant="outline"
              onClick={() => setShowDisableDialog(true)}
              className="text-destructive hover:text-destructive"
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              {dict.enabled.disableButton}
            </Button>
          </CardContent>
        </Card>

        {/* Disable Confirmation Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.disable.title}</DialogTitle>
              <DialogDescription>{dict.disable.description}</DialogDescription>
            </DialogHeader>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{dict.disable.warning}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
                {dict.disable.cancelButton}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={isDisabling}
              >
                {isDisabling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {dict.enabled.disabling}
                  </>
                ) : (
                  dict.disable.confirmButton
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // MFA Not Enabled state
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{dict.enable.title}</CardTitle>
        </div>
        <CardDescription>{dict.enable.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{dict.description}</p>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleStartEnrollment} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {dict.enable.scanning}
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              {dict.enable.button}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
