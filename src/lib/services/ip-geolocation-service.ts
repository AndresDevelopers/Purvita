/**
 * IP Geolocation Service
 *
 * Provides IP geolocation using multiple providers:
 * 1. ipapi.co (free tier: 30,000 req/month, HTTPS supported)
 * 2. ipapi.co as fallback (HTTPS)
 * 3. Fallback to database cache
 *
 * También detecta VPN/Tor/Proxy usando IPHub o similar
 */

import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export interface GeolocationData {
  countryCode: string;
  countryName: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isVpn: boolean;
  isTor: boolean;
  isProxy: boolean;
  riskScore: number;
}

export class IPGeolocationService {
  private static readonly CACHE_TTL_DAYS = 30;

  /**
   * Hash IP address para almacenamiento seguro (GDPR compliant)
   */
  private static hashIP(ipAddress: string): string {
    return createHash('sha256')
      .update(ipAddress + (process.env.CUSTOM_ID_SECRET || ''))
      .digest('hex');
  }

  /**
   * Obtener geolocalización desde cache
   */
  private static async getFromCache(ipHash: string): Promise<GeolocationData | null> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('ip_geolocation_cache')
        .select('*')
        .eq('ip_hash', ipHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return {
        countryCode: data.country_code,
        countryName: data.country_name || '',
        city: data.city || undefined,
        latitude: data.latitude ? parseFloat(data.latitude) : undefined,
        longitude: data.longitude ? parseFloat(data.longitude) : undefined,
        timezone: data.timezone || undefined,
        isVpn: data.is_vpn || false,
        isTor: data.is_tor || false,
        isProxy: data.is_proxy || false,
        riskScore: data.risk_score || 0,
      };
    } catch (error) {
      logger.error('Failed to get geolocation from cache', error as Error, { ipHash });
      return null;
    }
  }

  /**
   * Guardar en cache
   */
  private static async saveToCache(ipHash: string, data: GeolocationData): Promise<void> {
    try {
      const supabase = createAdminClient();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.CACHE_TTL_DAYS);

      await supabase
        .from('ip_geolocation_cache')
        .upsert({
          ip_hash: ipHash,
          country_code: data.countryCode,
          country_name: data.countryName,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone,
          is_vpn: data.isVpn,
          is_tor: data.isTor,
          is_proxy: data.isProxy,
          risk_score: data.riskScore,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      logger.error('Failed to save geolocation to cache', error as Error, { ipHash });
    }
  }

  /**
   * Obtener geolocalización desde ipapi.co
   */
  private static async fetchFromIPAPI(ipAddress: string): Promise<GeolocationData | null> {
    try {
      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
        headers: {
          'User-Agent': 'PurVita-Fraud-Detection/1.0',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`IPAPI returned ${response.status}`);
      }

      const data = await response.json();

      // ipapi.co no detecta VPN/Tor, solo geolocalización
      return {
        countryCode: data.country_code || 'XX',
        countryName: data.country_name || 'Unknown',
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        isVpn: false, // No detecta VPN
        isTor: false,
        isProxy: false,
        riskScore: 0,
      };
    } catch (error) {
      logger.warn('Failed to fetch from ipapi.co', { error: (error as Error).message, ipAddress });
      return null;
    }
  }

  /**
   * Obtener geolocalización desde ipapi.co (fallback) - HTTPS supported
   */
  private static async fetchFromIPAPIcom(ipAddress: string): Promise<GeolocationData | null> {
    try {
      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`ipapi.co returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error('ipapi.co returned error status');
      }

      return {
        countryCode: data.country_code || 'XX',
        countryName: data.country_name || 'Unknown',
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        isVpn: false,
        isTor: false,
        isProxy: false,
        riskScore: 0,
      };
    } catch (error) {
      logger.warn('Failed to fetch from ipapi.co', { error: (error as Error).message, ipAddress });
      return null;
    }
  }

  /**
   * Obtener geolocalización con fallbacks
   */
  public static async geolocateIP(ipAddress: string): Promise<GeolocationData> {
    // Validar IP
    if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === 'localhost') {
      return {
        countryCode: 'XX',
        countryName: 'Localhost',
        isVpn: false,
        isTor: false,
        isProxy: false,
        riskScore: 0,
      };
    }

    const ipHash = this.hashIP(ipAddress);

    // 1. Intentar obtener desde cache
    const cached = await this.getFromCache(ipHash);
    if (cached) {
      logger.debug('Geolocation from cache', { countryCode: cached.countryCode });
      return cached;
    }

    // 2. Intentar ipapi.co
    let geoData = await this.fetchFromIPAPI(ipAddress);

    // 3. Fallback a ip-api.com
    if (!geoData) {
      geoData = await this.fetchFromIPAPIcom(ipAddress);
    }

    // 4. Si todo falla, usar valor por defecto
    if (!geoData) {
      logger.warn('All geolocation providers failed', { ipAddress });
      geoData = {
        countryCode: 'XX',
        countryName: 'Unknown',
        isVpn: false,
        isTor: false,
        isProxy: false,
        riskScore: 0,
      };
    }

    // Guardar en cache
    await this.saveToCache(ipHash, geoData);

    logger.info('Geolocation resolved', {
      countryCode: geoData.countryCode,
      isVpn: geoData.isVpn,
      isTor: geoData.isTor,
    });

    return geoData;
  }

  /**
   * Detectar si una IP es VPN/Tor usando IPHub (opcional, requiere API key)
   */
  public static async detectVPNTor(ipAddress: string): Promise<{
    isVpn: boolean;
    isTor: boolean;
    isProxy: boolean;
    riskScore: number;
  }> {
    const iphubApiKey = process.env.IPHUB_API_KEY;

    if (!iphubApiKey) {
      // Sin API key, no podemos detectar
      return {
        isVpn: false,
        isTor: false,
        isProxy: false,
        riskScore: 0,
      };
    }

    try {
      const response = await fetch(`https://v2.api.iphub.info/ip/${ipAddress}`, {
        headers: {
          'X-Key': iphubApiKey,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`IPHub returned ${response.status}`);
      }

      const data = await response.json();

      // block: 0 = residential, 1 = non-residential, 2 = non-residential & hosting
      const isVpnOrProxy = data.block === 1 || data.block === 2;

      return {
        isVpn: isVpnOrProxy,
        isTor: false, // IPHub no distingue Tor específicamente
        isProxy: isVpnOrProxy,
        riskScore: isVpnOrProxy ? 60 : 0,
      };
    } catch (error) {
      logger.warn('Failed to check VPN/Tor with IPHub', { error: (error as Error).message });
      return {
        isVpn: false,
        isTor: false,
        isProxy: false,
        riskScore: 0,
      };
    }
  }

  /**
   * Obtener geolocalización completa con detección de VPN/Tor
   */
  public static async getCompleteGeolocation(ipAddress: string): Promise<GeolocationData> {
    const geoData = await this.geolocateIP(ipAddress);

    // Si tenemos IPHub API key, verificar VPN/Tor
    if (process.env.IPHUB_API_KEY) {
      const vpnCheck = await this.detectVPNTor(ipAddress);
      geoData.isVpn = vpnCheck.isVpn;
      geoData.isTor = vpnCheck.isTor;
      geoData.isProxy = vpnCheck.isProxy;
      geoData.riskScore = Math.max(geoData.riskScore, vpnCheck.riskScore);
    }

    return geoData;
  }
}
