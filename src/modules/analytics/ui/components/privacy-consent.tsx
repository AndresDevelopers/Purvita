'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const CONSENT_KEY = 'purvita_analytics_consent';
const CONSENT_VERSION = '1.0';

interface ConsentPreferences {
  tracking: boolean;
  anonymizeIp: boolean;
  version: string;
  timestamp: string;
}

interface PrivacyConsentProps {
  /**
   * Dictionary for i18n
   */
  dict: {
    title: string;
    description: string;
    trackingLabel: string;
    trackingDescription: string;
    anonymizeIpLabel: string;
    anonymizeIpDescription: string;
    acceptButton: string;
    declineButton: string;
    updateButton: string;
    privacyPolicy: string;
    learnMore: string;
  };
}

/**
 * Privacy Consent Component
 * GDPR/CCPA compliant consent banner for analytics tracking
 *
 * Usage:
 * <PrivacyConsent dict={dictionary.analytics.privacy} />
 */
export function PrivacyConsent({ dict }: PrivacyConsentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [anonymizeIp, setAnonymizeIp] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if consent has been given
    const consent = getConsent();
    if (!consent) {
      // Show banner if no consent
      setIsOpen(true);
    } else {
      // Apply existing consent
      setTracking(consent.tracking);
      setAnonymizeIp(consent.anonymizeIp);
    }
  }, []);

  const saveConsent = (preferences: Omit<ConsentPreferences, 'version' | 'timestamp'>) => {
    const consent: ConsentPreferences = {
      ...preferences,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  };

  const getConsent = (): ConsentPreferences | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    try {
      const consent = JSON.parse(stored) as ConsentPreferences;
      // Check version
      if (consent.version !== CONSENT_VERSION) return null;
      return consent;
    } catch {
      return null;
    }
  };

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      // Save consent preferences
      saveConsent({ tracking, anonymizeIp });

      // Update server-side consent
      await fetch('/api/analytics/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracking_consent: tracking,
          anonymize_ip: anonymizeIp,
          timestamp: new Date().toISOString(),
        }),
      });

      setIsOpen(false);
    } catch (error) {
      console.error('[Privacy Consent] Error saving consent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      // Save decline
      saveConsent({ tracking: false, anonymizeIp: true });

      // Update server-side consent
      await fetch('/api/analytics/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracking_consent: false,
          anonymize_ip: true,
          timestamp: new Date().toISOString(),
        }),
      });

      setIsOpen(false);
    } catch (error) {
      console.error('[Privacy Consent] Error saving consent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>{dict.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="tracking"
              checked={tracking}
              onCheckedChange={(checked) => setTracking(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="tracking" className="text-sm font-medium cursor-pointer">
                {dict.trackingLabel}
              </Label>
              <p className="text-xs text-muted-foreground">{dict.trackingDescription}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="anonymize-ip"
              checked={anonymizeIp}
              onCheckedChange={(checked) => setAnonymizeIp(checked === true)}
              disabled={!tracking}
            />
            <div className="space-y-1">
              <Label
                htmlFor="anonymize-ip"
                className="text-sm font-medium cursor-pointer"
              >
                {dict.anonymizeIpLabel}
              </Label>
              <p className="text-xs text-muted-foreground">
                {dict.anonymizeIpDescription}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {dict.privacyPolicy}{' '}
            <a
              href="/privacy-policy"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {dict.learnMore}
            </a>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDecline} disabled={isLoading}>
            {dict.declineButton}
          </Button>
          <Button onClick={handleAccept} disabled={isLoading}>
            {tracking ? dict.acceptButton : dict.declineButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Get current consent status
 */
export function getConsentStatus(): ConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CONSENT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ConsentPreferences;
  } catch {
    return null;
  }
}

/**
 * Reset consent (for testing or user request)
 */
export function resetConsent(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CONSENT_KEY);
  }
}
