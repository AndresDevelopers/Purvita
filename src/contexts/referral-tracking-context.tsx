'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface ReferralTrackingContextType {
  referralCode: string | null;
  affiliateId: string | null;
  setReferralTracking: (code: string, affiliateId: string) => void;
  clearReferralTracking: () => void;
  hasReferralTracking: boolean;
}

// Default context value for SSR safety
const defaultContextValue: ReferralTrackingContextType = {
  referralCode: null,
  affiliateId: null,
  setReferralTracking: () => {},
  clearReferralTracking: () => {},
  hasReferralTracking: false,
};

const ReferralTrackingContext = createContext<ReferralTrackingContextType>(defaultContextValue);

const STORAGE_KEY = 'affiliate_referral';
const EXPIRY_DAYS = 30; // Cookie-like expiry

interface StoredReferral {
  code: string;
  affiliateId: string;
  timestamp: number;
}

export function ReferralTrackingProvider({ children }: { children: ReactNode }) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);

  // ✅ SECURITY FIX: Use localStorage for persistent tracking (survives tab close)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredReferral = JSON.parse(stored);
        const now = Date.now();
        const expiryTime = data.timestamp + (EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        // Check if not expired
        if (now < expiryTime) {
          setReferralCode(data.code);
          setAffiliateId(data.affiliateId);
        } else {
          // Expired, clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('Error loading referral tracking from localStorage:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setReferralTracking = useCallback((code: string, affId: string) => {
    const data: StoredReferral = {
      code,
      affiliateId: affId,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setReferralCode(code);
    setAffiliateId(affId);
  }, []);

  const clearReferralTracking = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setReferralCode(null);
    setAffiliateId(null);
  }, []);

  const hasReferralTracking = referralCode !== null && affiliateId !== null;

  return (
    <ReferralTrackingContext.Provider
      value={{
        referralCode,
        affiliateId,
        setReferralTracking,
        clearReferralTracking,
        hasReferralTracking,
      }}
    >
      {children}
    </ReferralTrackingContext.Provider>
  );
}

export function useReferralTracking() {
  const context = useContext(ReferralTrackingContext);
  return context;
}

