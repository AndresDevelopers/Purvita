import { availableLocales, DEFAULT_LOCALE, type Locale as DictionaryLocale } from './dictionaries';

export const i18n = {
  defaultLocale: DEFAULT_LOCALE,
  locales: availableLocales,
} as const;

export type Locale = DictionaryLocale;
