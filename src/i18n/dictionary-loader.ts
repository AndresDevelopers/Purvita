import type { Locale } from './config';
import { adminDictionary } from './dictionaries/admin';

/**
 * Type-safe dictionary loader with lazy loading support
 */
export class DictionaryLoader {
  private static cache = new Map<string, unknown>();

  /**
   * Load a specific dictionary section
   */
  static async loadSection<T>(locale: Locale, section: string): Promise<T> {
    const cacheKey = `${locale}-${section}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as T;
    }

    let dictionary: T;
    
    switch (section) {
      case 'admin':
        dictionary = adminDictionary as T;
        break;
      default:
        throw new Error(`Unknown dictionary section: ${section}`);
    }

    this.cache.set(cacheKey, dictionary);
    return dictionary;
  }

  /**
   * Clear cache for a specific locale or section
   */
  static clearCache(locale?: Locale, section?: string): void {
    if (locale && section) {
      this.cache.delete(`${locale}-${section}`);
    } else if (locale) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${locale}-`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Convenience function to load admin dictionary
 */
export const loadAdminDictionary = (locale: Locale) => 
  DictionaryLoader.loadSection<typeof adminDictionary>(locale, 'admin');