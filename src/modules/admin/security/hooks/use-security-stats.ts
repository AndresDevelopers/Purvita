'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SecurityStats {
  blockedIps: number;
  blockedAccounts: number;
  fraudAlerts: number;
  securityEvents24h: number;
}

export const useSecurityStats = () => {
  const [stats, setStats] = useState<SecurityStats>({
    blockedIps: 0,
    blockedAccounts: 0,
    fraudAlerts: 0,
    securityEvents24h: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/security/stats', {
        cache: 'no-store',
        credentials: 'include', // Ensure cookies are sent
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[useSecurityStats] Response not OK:', response.status, errorText);
        throw new Error(`Failed to fetch security stats: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('[useSecurityStats] Stats loaded successfully:', data);
      setStats(data);
    } catch (err) {
      console.error('[useSecurityStats] Error fetching security stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set default stats on error so the UI doesn't break
      setStats({
        blockedIps: 0,
        blockedAccounts: 0,
        fraudAlerts: 0,
        securityEvents24h: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchStats,
  };
};

