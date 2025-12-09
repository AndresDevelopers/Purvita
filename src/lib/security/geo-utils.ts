/**
 * @fileoverview Geolocation Utilities
 * 
 * Provides utilities for IP-based geolocation.
 * Used for payment risk assessment and fraud detection.
 */

import { IPGeolocationService, type GeolocationData } from '@/lib/services/ip-geolocation-service';

/**
 * Gets country information from an IP address
 * 
 * @param ipAddress - The IP address to geolocate
 * @returns Geolocation data including country code and risk information
 */
export async function getCountryFromIP(ipAddress: string | null): Promise<GeolocationData> {
  // Handle null/undefined IP
  if (!ipAddress) {
    return {
      countryCode: 'XX',
      countryName: 'Unknown',
      isVpn: false,
      isTor: false,
      isProxy: false,
      riskScore: 0,
    };
  }

  // Use the IP geolocation service
  return await IPGeolocationService.geolocateIP(ipAddress);
}

/**
 * Checks if an IP address is from a high-risk country
 * 
 * @param ipAddress - The IP address to check
 * @returns True if the IP is from a high-risk country
 */
export async function isHighRiskCountry(ipAddress: string | null): Promise<boolean> {
  const geoData = await getCountryFromIP(ipAddress);
  
  // High-risk countries for fraud (can be configured)
  const highRiskCountries = [
    // This list should be configurable via environment variables
    // For now, we'll use the risk score from the geolocation service
  ];

  return geoData.riskScore > 50 || highRiskCountries.includes(geoData.countryCode);
}

/**
 * Checks if an IP address is using a VPN, Tor, or Proxy
 * 
 * @param ipAddress - The IP address to check
 * @returns True if the IP is using anonymization services
 */
export async function isAnonymizedIP(ipAddress: string | null): Promise<boolean> {
  const geoData = await getCountryFromIP(ipAddress);
  return geoData.isVpn || geoData.isTor || geoData.isProxy;
}

