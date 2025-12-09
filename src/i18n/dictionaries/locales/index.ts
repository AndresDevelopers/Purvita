import type { DictionaryFactory } from '../types';

import { createEnDictionary } from './en';
import { createEsDictionary } from './es';

export const localeFactories = {
  en: createEnDictionary,
  es: createEsDictionary,
} satisfies Record<string, DictionaryFactory>;
