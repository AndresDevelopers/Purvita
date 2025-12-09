'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AdminSecurityStats {
  suspiciousActivitiesCount: number;
  blockedIPsCount: number;
  activeWhitelistCount: number;
  whitelistEnabled: boolean;
  activeFraudAlertsCount: number;
  securityEventsLast24h: number;
  criticalEvents: number;
}

export interface SuspiciousActivity {
  type: string;
  severity: string;
  userId: string;
  description: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  message: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  created_at: string;
  expires_at: string | null;
}

export interface WhitelistEntry {
  id: string;
  ip_address: string;
  description: string;
  enabled: boolean;
  created_at: string;
}

export interface FraudAlert {
  id: string;
  user_id: string;
  risk_score: number;
  reason: string;
  status: string;
  created_at: string;
}

export interface AdminSecurityDashboardData {
  stats: AdminSecurityStats;
  suspiciousActivities: SuspiciousActivity[];
  securityEvents: SecurityEvent[];
  blockedIPs: BlockedIP[];
  whitelistEntries: WhitelistEntry[];
  fraudAlerts: FraudAlert[];
}

export const useAdminSecurityDashboard = () => {
  const [data, setData] = useState<AdminSecurityDashboardData>({
    stats: {
      suspiciousActivitiesCount: 0,
      blockedIPsCount: 0,
      activeWhitelistCount: 0,
      whitelistEnabled: false,
      activeFraudAlertsCount: 0,
      securityEventsLast24h: 0,
      criticalEvents: 0,
    },
    suspiciousActivities: [],
    securityEvents: [],
    blockedIPs: [],
    whitelistEntries: [],
    fraudAlerts: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/security/dashboard', {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[useAdminSecurityDashboard] Response not OK:', response.status, errorText);
        throw new Error(`Failed to fetch admin security dashboard: ${response.status}`);
      }

      const fetchedData = await response.json();
      console.log('[useAdminSecurityDashboard] Data loaded successfully');
      setData(fetchedData);
    } catch (err) {
      console.error('[useAdminSecurityDashboard] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
};
