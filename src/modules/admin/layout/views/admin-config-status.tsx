'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Ban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDictionary } from '@/i18n/dictionaries';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';
import type { Locale } from '@/i18n/config';
import { getPaymentGatewayModule } from '@/modules/payments/factories/payment-gateway-singleton';
import { getPaymentGatewayBroadcast } from '@/modules/payments/domain/events/payment-gateway-broadcast';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

type ServiceMode = 'test' | 'production' | null;

interface PaymentGatewayStatus {
  configured: boolean;
  mode: ServiceMode;
  active: boolean;
}

interface ConfigStatus {
  stripe: PaymentGatewayStatus;
  paypal: PaymentGatewayStatus;
  supabase: boolean;
  email: boolean;
}

interface AdminConfigStatusProps {
  lang: Locale;
}

export const AdminConfigStatus = ({ lang }: AdminConfigStatusProps) => {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const t = getDictionary(lang, DEFAULT_APP_NAME).adminConfigStatus;

  const checkStatus = useCallback(async () => {
    try {
      // Use the unified config-status endpoint that only requires view_dashboard permission
      // Add timestamp to prevent caching
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const configResponse = await adminApi.get(`/api/admin/config-status?t=${Date.now()}`, {
        cache: 'no-store',
      });

      if (!configResponse.ok) {
        throw new Error('Failed to fetch config status');
      }

      const config = await configResponse.json();

      console.log('🔍 [DEBUG] Config received from API:', config);

      setStatus({
        stripe: {
          configured: config.stripe?.configured ?? false,
          mode: config.stripe?.mode as ServiceMode,
          active: config.stripe?.active ?? false,
        },
        paypal: {
          configured: config.paypal?.configured ?? false,
          mode: config.paypal?.mode as ServiceMode,
          active: config.paypal?.active ?? false,
        },
        supabase: config.supabase ?? false,
        email: config.email ?? false,
      });
    } catch (error) {
      console.error('❌ [DEBUG] Error checking config status:', error);
      setStatus({
        stripe: { configured: false, mode: null, active: false },
        paypal: { configured: false, mode: null, active: false },
        supabase: false,
        email: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkStatus();

    // Subscribe to payment gateway events to refresh when settings are updated (same tab)
    const { eventBus } = getPaymentGatewayModule();
    const unsubscribeEventBus = eventBus.subscribe((event) => {
      if (event.type === 'settings_updated') {
        // Refresh the config status when payment settings are updated
        checkStatus();
      }
    });

    // Subscribe to broadcast channel for cross-tab updates
    const broadcast = getPaymentGatewayBroadcast();
    const unsubscribeBroadcast = broadcast.subscribe((message) => {
      if (message.type === 'settings_updated') {
        // Refresh the config status when payment settings are updated in another tab
        checkStatus();
      }
    });

    return () => {
      unsubscribeEventBus();
      unsubscribeBroadcast();
    };
  }, [checkStatus]);

  if (loading) {
    return (
      <Card data-testid="admin-config-status">
        <CardHeader>
          <CardTitle className="text-lg">{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 animate-pulse" />
            <span>{t.checking}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const renderServiceBadge = (
    configured: boolean,
    mode?: ServiceMode,
  ) => {
    if (!configured) {
      return (
        <Badge
          variant="destructive"
          className="bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 flex items-center gap-1"
        >
          <XCircle className="h-3 w-3" />
          {t.notConfigured}
        </Badge>
      );
    }

    const modeLabel = mode === 'test' ? t.testMode : mode === 'production' ? t.productionMode : t.configured;
    const badgeColor = mode === 'test'
      ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20'
      : 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20';

    return (
      <Badge
        variant="default"
        className={`${badgeColor} flex items-center gap-1`}
      >
        <CheckCircle className="h-3 w-3" />
        {modeLabel}
      </Badge>
    );
  };

  const renderPaymentGatewayBadge = (
    gateway: PaymentGatewayStatus,
  ) => {
    // First check if configured
    if (!gateway.configured) {
      return (
        <Badge
          variant="destructive"
          className="bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 flex items-center gap-1"
        >
          <XCircle className="h-3 w-3" />
          {t.notConfigured}
        </Badge>
      );
    }

    // If configured but not active, show inactive status
    if (!gateway.active) {
      const modeLabel = gateway.mode === 'test' ? t.testMode : t.productionMode;
      return (
        <div className="flex items-center gap-1.5">
          <Badge
            variant="default"
            className="bg-gray-500/10 text-gray-600 dark:text-gray-400 hover:bg-gray-500/20 flex items-center gap-1"
          >
            <Ban className="h-3 w-3" />
            {t.inactive}
          </Badge>
          <span className="text-xs text-muted-foreground">({modeLabel})</span>
        </div>
      );
    }

    // Configured and active
    const modeLabel = gateway.mode === 'test' ? t.testMode : gateway.mode === 'production' ? t.productionMode : t.configured;
    const badgeColor = gateway.mode === 'test'
      ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20'
      : 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20';

    return (
      <Badge
        variant="default"
        className={`${badgeColor} flex items-center gap-1`}
      >
        <CheckCircle className="h-3 w-3" />
        {modeLabel}
      </Badge>
    );
  };

  return (
    <Card data-testid="admin-config-status">
      <CardHeader>
        <CardTitle className="text-lg">{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Stripe */}
          <div
            className="flex items-center justify-between p-3 rounded-lg border border-border-light dark:border-border-dark"
            data-testid="config-status-stripe"
          >
            <span className="text-sm font-medium">{t.stripe}</span>
            {renderPaymentGatewayBadge(status.stripe)}
          </div>

          {/* PayPal */}
          <div
            className="flex items-center justify-between p-3 rounded-lg border border-border-light dark:border-border-dark"
            data-testid="config-status-paypal"
          >
            <span className="text-sm font-medium">{t.paypal}</span>
            {renderPaymentGatewayBadge(status.paypal)}
          </div>

          {/* Supabase */}
          <div
            className="flex items-center justify-between p-3 rounded-lg border border-border-light dark:border-border-dark"
            data-testid="config-status-supabase"
          >
            <span className="text-sm font-medium">{t.supabase}</span>
            {renderServiceBadge(status.supabase)}
          </div>

          {/* Email */}
          <div
            className="flex items-center justify-between p-3 rounded-lg border border-border-light dark:border-border-dark"
            data-testid="config-status-email"
          >
            <span className="text-sm font-medium">{t.email}</span>
            {renderServiceBadge(status.email)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

