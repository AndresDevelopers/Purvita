import type { DictionaryOverrides } from '../types';
import { createDefaultDictionary } from '../default';

export const createEnDictionary = (
  appName: string,
): DictionaryOverrides => createDefaultDictionary(appName);
