'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SiteBranding } from '@/modules/site-content/domain/models/site-branding';
import { getSiteBranding } from '@/modules/site-content/services/site-content-service';

export interface SiteBrandingContextValue {
  branding: SiteBranding;
  refreshBranding: () => Promise<void>;
}

// Default context value for SSR safety
const defaultContextValue: SiteBrandingContextValue = {
  branding: {} as SiteBranding,
  refreshBranding: async () => {},
};

const SiteBrandingContext = createContext<SiteBrandingContextValue>(defaultContextValue);

export interface SiteBrandingProviderProps {
  initialBranding: SiteBranding;
  children: React.ReactNode;
}

export const SiteBrandingProvider = ({ initialBranding, children }: SiteBrandingProviderProps) => {
  const [branding, setBranding] = useState<SiteBranding>(initialBranding);

  const refreshBranding = useCallback(async () => {
    try {
      const latest = await getSiteBranding();
      setBranding(latest);
    } catch (error) {
      console.error('Failed to fetch branding:', error);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  return <SiteBrandingContext.Provider value={{ branding, refreshBranding }}>{children}</SiteBrandingContext.Provider>;
};

export const useSiteBranding = (): SiteBrandingContextValue => {
  const context = useContext(SiteBrandingContext);
  return context;
};
