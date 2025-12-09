/**
 * Cached Settings Helper
 * 
 * Versión mejorada de settings-helper.ts que usa Redis para caché
 * cuando está disponible, con fallback a caché en memoria.
 * 
 * Ventajas sobre el helper original:
 * - Caché compartido entre instancias serverless
 * - TTL automático (no requiere limpieza manual)
 * - Mejor rendimiento en producción
 * - Fallback a caché en memoria si Redis no está disponible
 * 
 * @example
 * ```typescript
 * import { getCachedAppSettings, getCachedPhaseLevels } from '@/lib/helpers/cached-settings-helper';
 * 
 * const settings = await getCachedAppSettings();
 * const phaseLevels = await getCachedPhaseLevels();
 * ```
 */

import { redisCache, CacheKeys } from '@/lib/redis';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { getPhaseLevels } from '@/modules/phase-levels/services/phase-level-service';
import type { AppSettings } from '@/modules/app-settings/domain/models/app-settings';
import type { PhaseLevel } from '@/modules/phase-levels/domain/models/phase-level';

// Fallback: Caché en memoria (usado cuando Redis no está disponible)
let cachedSettings: AppSettings | null = null;
let cachedPhaseLevels: PhaseLevel[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

/**
 * TTL para Redis (en segundos)
 */
const REDIS_TTL = {
  APP_SETTINGS: 300, // 5 minutos
  PHASE_LEVELS: 300, // 5 minutos
} as const;

/**
 * Obtener configuración de la app con caché
 * 
 * Usa Redis si está disponible, sino usa caché en memoria.
 * 
 * @returns Configuración de la aplicación
 */
export async function getCachedAppSettings(): Promise<AppSettings> {
  // Intentar obtener de Redis primero
  if (redisCache.isAvailable()) {
    return await redisCache.getOrSet(
      CacheKeys.appSettings(),
      async () => {
        console.log('[CachedSettings] Fetching app settings from database (Redis miss)');
        return await getAppSettings();
      },
      REDIS_TTL.APP_SETTINGS
    );
  }

  // Fallback: Caché en memoria
  const now = Date.now();
  const isExpired = now - cacheTimestamp > CACHE_TTL;

  if (!cachedSettings || isExpired) {
    console.log('[CachedSettings] Fetching app settings from database (memory cache miss)');
    cachedSettings = await getAppSettings();
    cacheTimestamp = now;
  }

  return cachedSettings;
}

/**
 * Obtener niveles de fase con caché
 * 
 * Usa Redis si está disponible, sino usa caché en memoria.
 * 
 * @returns Lista de niveles de fase
 */
export async function getCachedPhaseLevels(): Promise<PhaseLevel[]> {
  // Intentar obtener de Redis primero
  if (redisCache.isAvailable()) {
    return await redisCache.getOrSet(
      CacheKeys.phaseLevels(),
      async () => {
        console.log('[CachedSettings] Fetching phase levels from database (Redis miss)');
        return await getPhaseLevels();
      },
      REDIS_TTL.PHASE_LEVELS
    );
  }

  // Fallback: Caché en memoria
  const now = Date.now();
  const isExpired = now - cacheTimestamp > CACHE_TTL;

  if (!cachedPhaseLevels || isExpired) {
    console.log('[CachedSettings] Fetching phase levels from database (memory cache miss)');
    cachedPhaseLevels = await getPhaseLevels();
    cacheTimestamp = now;
  }

  return cachedPhaseLevels;
}

/**
 * Invalidar caché de configuración de la app
 * 
 * Llama a esta función después de actualizar la configuración
 * para asegurar que los cambios se reflejen inmediatamente.
 * 
 * @example
 * ```typescript
 * await updateAppSettings(newSettings);
 * await invalidateAppSettingsCache();
 * ```
 */
export async function invalidateAppSettingsCache(): Promise<void> {
  // Invalidar Redis
  if (redisCache.isAvailable()) {
    await redisCache.delete(CacheKeys.appSettings());
    console.log('[CachedSettings] App settings cache invalidated (Redis)');
  }

  // Invalidar caché en memoria
  cachedSettings = null;
  cacheTimestamp = 0;
  console.log('[CachedSettings] App settings cache invalidated (memory)');
}

/**
 * Invalidar caché de niveles de fase
 * 
 * Llama a esta función después de actualizar los niveles de fase.
 * 
 * @example
 * ```typescript
 * await updatePhaseLevel(levelId, newData);
 * await invalidatePhaseLevelsCache();
 * ```
 */
export async function invalidatePhaseLevelsCache(): Promise<void> {
  // Invalidar Redis
  if (redisCache.isAvailable()) {
    await redisCache.delete(CacheKeys.phaseLevels());
    console.log('[CachedSettings] Phase levels cache invalidated (Redis)');
  }

  // Invalidar caché en memoria
  cachedPhaseLevels = null;
  cacheTimestamp = 0;
  console.log('[CachedSettings] Phase levels cache invalidated (memory)');
}

/**
 * Invalidar todo el caché de configuración
 * 
 * Útil cuando se hacen cambios masivos a la configuración.
 */
export async function invalidateAllSettingsCache(): Promise<void> {
  await Promise.all([
    invalidateAppSettingsCache(),
    invalidatePhaseLevelsCache(),
  ]);
  console.log('[CachedSettings] All settings cache invalidated');
}

/**
 * Pre-cargar caché de configuración
 * 
 * Útil para warm-up de la aplicación o después de invalidar caché.
 * 
 * @example
 * ```typescript
 * // En un endpoint de warm-up
 * await warmupSettingsCache();
 * ```
 */
export async function warmupSettingsCache(): Promise<void> {
  console.log('[CachedSettings] Warming up settings cache...');
  
  await Promise.all([
    getCachedAppSettings(),
    getCachedPhaseLevels(),
  ]);
  
  console.log('[CachedSettings] Settings cache warmed up');
}

/**
 * Obtener estadísticas del caché
 * 
 * Útil para debugging y monitoreo.
 */
export async function getSettingsCacheStats(): Promise<{
  redisAvailable: boolean;
  appSettingsCached: boolean;
  phaseLevelsCached: boolean;
  memoryCacheAge: number;
}> {
  const redisAvailable = redisCache.isAvailable();
  
  let appSettingsCached = false;
  let phaseLevelsCached = false;

  if (redisAvailable) {
    appSettingsCached = await redisCache.exists(CacheKeys.appSettings());
    phaseLevelsCached = await redisCache.exists(CacheKeys.phaseLevels());
  } else {
    const now = Date.now();
    const isExpired = now - cacheTimestamp > CACHE_TTL;
    appSettingsCached = !!cachedSettings && !isExpired;
    phaseLevelsCached = !!cachedPhaseLevels && !isExpired;
  }

  return {
    redisAvailable,
    appSettingsCached,
    phaseLevelsCached,
    memoryCacheAge: Date.now() - cacheTimestamp,
  };
}

