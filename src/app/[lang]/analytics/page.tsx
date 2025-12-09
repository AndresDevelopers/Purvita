'use client';

import { use, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
import SubscriptionGuard from '@/components/subscription-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BasicMetrics } from '@/modules/analytics/ui/components/basic-metrics';
import { RefreshCw, Calendar, Info } from 'lucide-react';
import type { AnalyticsMetrics, MetricsPeriod } from '@/modules/analytics/domain/models/analytics-metrics';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AnalyticsPageProps {
  params: Promise<{
    lang: Locale;
  }>;
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { lang } = use(params);
  const dict = useAppDictionary();

  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [period, setPeriod] = useState<MetricsPeriod>('last_30_days');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadMetrics = async (selectedPeriod: MetricsPeriod) => {
    try {
      setIsRefreshing(true);

      // Load metrics
      const metricsResponse = await fetch(
        `/api/analytics/metrics?period=${selectedPeriod}&include_advanced=false`
      );

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }
    } catch (error) {
      console.error('[Analytics] Error loading metrics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics(period);
  }, [period]);

  const handleRefresh = () => {
    loadMetrics(period);
  };

  const handlePeriodChange = (newPeriod: MetricsPeriod) => {
    setPeriod(newPeriod);
  };

  const analyticsCopy = dict.analytics;

  const infoText = analyticsCopy.infoText;
  const dataCollectedTitle = analyticsCopy.dataCollected?.title;
  const dataCollectedItems = analyticsCopy.dataCollected?.items || [];

  if (isLoading) {
    return (
      <AuthGuard lang={lang}>
        <SubscriptionGuard lang={lang}>
          <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="animate-pulse space-y-6">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SubscriptionGuard>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard lang={lang}>
      <SubscriptionGuard lang={lang}>
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {analyticsCopy.title}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {analyticsCopy.description}
            </p>
          </div>

          {/* Info Alert */}
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-gray-700 dark:text-gray-300 ml-2">
              {infoText}
            </AlertDescription>
          </Alert>

          {/* Data Collected Card */}
          <Card className="mb-6 border-purple-200 dark:border-purple-900">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                {dataCollectedTitle}
              </CardTitle>
              <CardDescription>
                <ul className="mt-3 space-y-2">
                  {dataCollectedItems.map((item, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                      {item}
                    </li>
                  ))}
                </ul>
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Period Selector */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <CardTitle className="text-lg">
                    {analyticsCopy.analysisPeriod}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Select value={period} onValueChange={(value) => handlePeriodChange(value as MetricsPeriod)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">{analyticsCopy.period.today}</SelectItem>
                      <SelectItem value="yesterday">{analyticsCopy.period.yesterday}</SelectItem>
                      <SelectItem value="last_7_days">{analyticsCopy.period.last7Days}</SelectItem>
                      <SelectItem value="last_30_days">{analyticsCopy.period.last30Days}</SelectItem>
                      <SelectItem value="last_90_days">{analyticsCopy.period.last90Days}</SelectItem>
                      <SelectItem value="this_month">{analyticsCopy.period.thisMonth}</SelectItem>
                      <SelectItem value="last_month">{analyticsCopy.period.lastMonth}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Metrics */}
          {metrics?.basic && (
            <BasicMetrics
              metrics={metrics.basic}
              dict={analyticsCopy.metrics}
            />
          )}
        </div>
        </div>
      </SubscriptionGuard>
    </AuthGuard>
  );
}
