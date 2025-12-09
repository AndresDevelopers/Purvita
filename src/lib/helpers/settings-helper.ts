/**
 * Settings Helper
 * Centralized access to app settings and phase levels configuration
 * This is the SINGLE SOURCE OF TRUTH for all configuration values
 */

import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { getPhaseLevels } from '@/modules/phase-levels/services/phase-level-service';
import type { AppSettings } from '@/modules/app-settings/domain/models/app-settings';
import type { PhaseLevel } from '@/modules/phase-levels/domain/models/phase-level';

let cachedSettings: AppSettings | null = null;
let cachedPhaseLevels: PhaseLevel[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get app settings with caching
 */
export async function getCachedAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }
  
  cachedSettings = await getAppSettings();
  cacheTimestamp = now;
  return cachedSettings;
}

/**
 * Get phase levels with caching
 */
export async function getCachedPhaseLevels(): Promise<PhaseLevel[]> {
  const now = Date.now();
  
  if (cachedPhaseLevels && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPhaseLevels;
  }
  
  cachedPhaseLevels = await getPhaseLevels();
  cacheTimestamp = now;
  return cachedPhaseLevels;
}

/**
 * Clear cache (useful after updates)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
  cachedPhaseLevels = null;
  cacheTimestamp = 0;
}

/**
 * Get commission rate for a specific phase
 */
export async function getPhaseCommissionRate(phase: number): Promise<number> {
  const phaseLevels = await getCachedPhaseLevels();
  const phaseLevel = phaseLevels.find(p => p.level === phase);

  if (!phaseLevel) {
    // Fallback to global e-commerce rate
    const settings = await getCachedAppSettings();
    return settings.ecommerceCommissionRate;
  }

  return phaseLevel.commissionRate;
}

/**
 * Get the group gain rate for a specific phase
 */
export async function getPhaseGroupGainRate(phase: number): Promise<number> {
  const phaseLevels = await getCachedPhaseLevels();
  const phaseLevel = phaseLevels.find(p => p.level === phase);

  return phaseLevel?.subscriptionDiscountRate ?? 0;
}

/**
 * Get reward credit amount for a specific phase
 */
export async function getPhaseCreditCents(phase: number): Promise<number> {
  const phaseLevels = await getCachedPhaseLevels();
  const phaseLevel = phaseLevels.find(p => p.level === phase);
  return phaseLevel?.creditCents ?? 0;
}

/**
 * Get phase name (localized if available)
 */
export async function getPhaseName(phase: number, locale: 'en' | 'es' = 'en'): Promise<string> {
  const phaseLevels = await getCachedPhaseLevels();
  const phaseLevel = phaseLevels.find(p => p.level === phase);
  
  if (!phaseLevel) {
    return `Phase ${phase}`;
  }
  
  if (locale === 'es' && phaseLevel.nameEs) {
    return phaseLevel.nameEs;
  }
  
  if (locale === 'en' && phaseLevel.nameEn) {
    return phaseLevel.nameEn;
  }
  
  return phaseLevel.name;
}

/**
 * Get global e-commerce commission rate
 */
export async function getGlobalCommissionRate(): Promise<number> {
  const settings = await getCachedAppSettings();
  return settings.ecommerceCommissionRate;
}

/**
 * Get max members for a specific level in the MLM tree
 */
export async function getMaxMembersPerLevel(level: number): Promise<number> {
  const settings = await getCachedAppSettings();
  const capacity = settings.maxMembersPerLevel.find(c => c.level === level);
  return capacity?.maxMembers ?? 0;
}

/**
 * Get all capacity configuration
 */
export async function getAllCapacities(): Promise<Array<{ level: number; maxMembers: number }>> {
  const settings = await getCachedAppSettings();
  return settings.maxMembersPerLevel as any;
}

/**
 * Check if a phase has free product benefit
 * Uses cached phase configuration when available and falls back to legacy behaviour
 */
export function hasPhaseProduct(phase: number): boolean {
  const cachedValue = cachedPhaseLevels?.find(p => p.level === phase)?.freeProductValueCents;
  if (typeof cachedValue === 'number') {
    return cachedValue > 0;
  }
  return phase >= 1;
}

/**
 * Get configured free product value for a specific phase
 */
export async function getPhaseFreeProductValueCents(phase: number): Promise<number> {
  const phaseLevels = await getCachedPhaseLevels();
  const phaseLevel = phaseLevels.find(p => p.level === phase);
  if (!phaseLevel) {
    return phase === 1 ? 6500 : 0;
  }
  return phaseLevel.freeProductValueCents ?? (phaseLevel.level === 1 ? 6500 : 0);
}

/**
 * Get the global free product value used for phase 1 rewards
 */
export async function getFreeProductValueCents(): Promise<number> {
  return getPhaseFreeProductValueCents(1);
}

/**
 * Retrieve the list of configured currencies and their visibility rules
 */
export async function getSupportedCurrencies(): Promise<Array<{ code: string; countryCodes: string[] }>> {
  const settings = await getCachedAppSettings();
  const currencyMap = new Map<string, { code: string; countryCodes: string[] }>();

  for (const entry of settings.currencies) {
    const code = entry.code.toUpperCase();
    const countries = Array.from(new Set(entry.countryCodes.map((country) => country.toUpperCase())));
    currencyMap.set(code, { code, countryCodes: countries });
  }

  const defaultCode = settings.currency.toUpperCase();
  if (!currencyMap.has(defaultCode)) {
    currencyMap.set(defaultCode, { code: defaultCode, countryCodes: [] });
  }

  return Array.from(currencyMap.values());
}

/**
 * Resolve which currency should be displayed for a specific ISO country code.
 * Falls back to the default payout currency when no mapping is found.
 */
export async function resolveCurrencyForCountry(countryCode: string | null | undefined): Promise<string> {
  const normalizedCountry = countryCode?.trim().toUpperCase();
  const settings = await getCachedAppSettings();

  if (!normalizedCountry) {
    return settings.currency.toUpperCase();
  }

  const supportedCurrencies = await getSupportedCurrencies();
  const match = supportedCurrencies.find((entry) => entry.countryCodes.includes(normalizedCountry));

  return (match?.code ?? settings.currency).toUpperCase();
}
