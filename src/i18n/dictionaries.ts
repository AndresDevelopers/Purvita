import { DEFAULT_APP_NAME } from '@/lib/config/app-config';

import { createDefaultDictionary, type DefaultDictionary } from './dictionaries/default';
import { localeFactories } from './dictionaries/locales';
import type { DictionaryOverrides } from './dictionaries/types';

export type AppDictionary = DefaultDictionary;
export type Locale = keyof typeof localeFactories;

const DEFAULT_LOCALE_CODE: Locale = 'en';

const rawLocales = Object.freeze(
  Object.keys(localeFactories) as Locale[],
);

export const availableLocales = rawLocales as readonly Locale[];
export const DEFAULT_LOCALE = DEFAULT_LOCALE_CODE;

if (!(DEFAULT_LOCALE_CODE in localeFactories)) {
  throw new Error(`Missing locale factory for default locale "${DEFAULT_LOCALE_CODE}"`);
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneArray = (input: unknown[]): unknown[] =>
  input.map((entry) => (isPlainObject(entry) ? mergeInto({}, entry) : entry));

const mergeInto = <T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T => {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      (target as Record<string, unknown[]>)[key] = cloneArray(value);
      continue;
    }

    if (isPlainObject(value)) {
      const current = target[key];
      if (isPlainObject(current)) {
        mergeInto(current, value);
      } else {
        (target as Record<string, unknown>)[key] = mergeInto({}, value);
      }
      continue;
    }

    (target as Record<string, unknown>)[key] = value;
  }

  return target;
};

const mergeDictionaries = (
  base: AppDictionary,
  overrides: DictionaryOverrides | undefined,
): AppDictionary => {
  if (!overrides || Object.keys(overrides).length === 0) {
    return base;
  }

  return mergeInto(base, overrides as Record<string, unknown>);
};

export const getDictionary = (
  locale: Locale,
  appName: string = DEFAULT_APP_NAME,
): AppDictionary => {
  const defaultDictionary = createDefaultDictionary(appName);

  if (!availableLocales.includes(locale) || locale === DEFAULT_LOCALE) {
    return defaultDictionary;
  }

  const factory = localeFactories[locale];
  if (!factory) {
    return defaultDictionary;
  }

  const overrides = factory(appName);
  return mergeDictionaries(defaultDictionary, overrides);
};
