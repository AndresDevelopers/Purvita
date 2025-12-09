'use client';

import { createContext, useContext } from 'react';
import type { AppDictionary } from '@/i18n/dictionaries';
import type { LandingContent } from '@/modules/site-content/domain/models/landing-content';

export interface LocaleContentContextValue {
  dictionary: AppDictionary;
  landingContent: LandingContent;
}

// Default context value for SSR safety
// These values will be replaced by the provider during hydration
const defaultContextValue: LocaleContentContextValue = {
  dictionary: {} as AppDictionary,
  landingContent: {} as LandingContent,
};

const LocaleContentContext = createContext<LocaleContentContextValue>(defaultContextValue);

export interface LocaleContentProviderProps {
  dictionary: AppDictionary;
  landingContent: LandingContent;
  children: React.ReactNode;
}

export const LocaleContentProvider: React.FC<LocaleContentProviderProps> = ({ dictionary, landingContent, children }) => {
  return (
    <LocaleContentContext.Provider value={{ dictionary, landingContent }}>
      {children}
    </LocaleContentContext.Provider>
  );
};

export const useLocaleContent = (): LocaleContentContextValue => {
  const context = useContext(LocaleContentContext);
  return context;
};

export const useAppDictionary = (): AppDictionary => {
  return useLocaleContent().dictionary;
};

export const useLandingPageContent = (): LandingContent => {
  return useLocaleContent().landingContent;
};
