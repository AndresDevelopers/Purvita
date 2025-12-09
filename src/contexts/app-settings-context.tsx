'use client';

import { createContext, useContext, useMemo } from 'react';
import type { AppSettings } from '@/modules/app-settings/domain/models/app-settings';

type NormalizedCurrencyEntry = {
  code: string;
  countryCodes: string[];
};

interface ResolvedAppSettings {
  settings: AppSettings;
  currencies: NormalizedCurrencyEntry[];
  defaultCurrency: string;
  resolveCurrency: (countryCode: string | null | undefined) => string;
  getCurrencyForCountry: (countryCode: string | null | undefined) => string;
  countryCurrencyMap: Record<string, string>;
}

// Default context value for SSR safety
const defaultContextValue: ResolvedAppSettings = {
  settings: {} as AppSettings,
  currencies: [],
  defaultCurrency: 'USD',
  resolveCurrency: () => 'USD',
  getCurrencyForCountry: () => 'USD',
  countryCurrencyMap: {},
};

const AppSettingsContext = createContext<ResolvedAppSettings>(defaultContextValue);

export interface AppSettingsProviderProps {
  settings: AppSettings;
  children: React.ReactNode;
}

const normalizeCurrencyEntries = (entries: AppSettings['currencies']): NormalizedCurrencyEntry[] => {
  return entries.map((entry) => ({
    code: entry.code.toUpperCase(),
    countryCodes: (entry.countryCodes ?? []).map((country) => country.toUpperCase()),
  }));
};

const buildCountryCurrencyMap = (
  entries: NormalizedCurrencyEntry[],
): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const entry of entries) {
    for (const country of entry.countryCodes) {
      if (!map[country]) {
        map[country] = entry.code;
      }
    }
  }
  return map;
};

export const AppSettingsProvider: React.FC<AppSettingsProviderProps> = ({ settings, children }) => {
  const value = useMemo<ResolvedAppSettings>(() => {
    const normalizedCurrency = settings.currency.toUpperCase();
    const normalizedEntries = normalizeCurrencyEntries(settings.currencies ?? []);
    const countryCurrencyMap = buildCountryCurrencyMap(normalizedEntries);
    const globalFallbackEntry =
      normalizedEntries.find((entry) => entry.countryCodes.length === 0) ?? null;
    const defaultCurrency = globalFallbackEntry?.code ?? normalizedCurrency;

    const resolveCurrency = (countryCode: string | null | undefined): string => {
      if (!countryCode) {
        return defaultCurrency;
      }
      const normalized = countryCode.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(normalized)) {
        return defaultCurrency;
      }
      return countryCurrencyMap[normalized] ?? defaultCurrency;
    };

    return {
      settings: {
        ...settings,
        currency: normalizedCurrency,
        currencies: settings.currencies ?? [],
      },
      currencies: normalizedEntries,
      defaultCurrency,
      resolveCurrency,
      getCurrencyForCountry: resolveCurrency,
      countryCurrencyMap,
    };
  }, [settings]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = (): ResolvedAppSettings => {
  const context = useContext(AppSettingsContext);
  return context;
};

export const useCurrencyForCountry = (): ResolvedAppSettings['resolveCurrency'] => {
  return useAppSettings().resolveCurrency;
};
