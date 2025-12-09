'use client';

import { use, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import AuthGuard from '@/components/auth-guard';
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
import { TrendChart } from '@/modules/analytics/ui/components/trend-chart';
import { ConversionFunnel } from '@/modules/analytics/ui/components/conversion-funnel';
import { DataCollectionInfo } from '@/modules/analytics/ui/components/data-collection-info';
import { RefreshCw, Calendar, ArrowLeft, BarChart3 } from 'lucide-react';
import type { AnalyticsMetrics, MetricsPeriod } from '@/modules/analytics/domain/models/analytics-metrics';
import { useRouter } from 'next/navigation';
import { format, subDays } from 'date-fns';

interface AffiliateAnalyticsPageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

export default function AffiliateAnalyticsPage({ params }: AffiliateAnalyticsPageProps) {
  const { lang, referralCode } = use(params);
  const dict = useAppDictionary();
  const router = useRouter();

  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [period, setPeriod] = useState<MetricsPeriod>('last_30_days');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ownershipValidated, setOwnershipValidated] = useState(false);
  const [accessError, setAccessError] = useState<{ type: 'unauthorized' | 'subscription' | 'waitlisted'; message: string } | null>(null);

  // ✅ SECURITY FIX: Validate ownership AND subscription before allowing access
  useEffect(() => {
    const validateOwnership = async () => {
      try {
        const response = await fetch(`/api/affiliate/${referralCode}/validate-ownership`);
        const data = await response.json();

        if (!response.ok) {
          console.warn('[SECURITY] Ownership validation failed:', data);
          
          // Handle specific error cases - messages will be set from dict in render
          if (data.requiresSubscription) {
            setAccessError({
              type: 'subscription',
              message: '', // Will use dict in render
            });
          } else if (data.waitlisted) {
            setAccessError({
              type: 'waitlisted',
              message: '', // Will use dict in render
            });
          } else {
            setAccessError({
              type: 'unauthorized',
              message: '', // Will use dict in render
            });
          }
          setIsLoading(false);
          return;
        }

        if (data.valid) {
          setOwnershipValidated(true);
        } else {
          router.push(`/${lang}/dashboard`);
        }
      } catch (error) {
        console.error('[SECURITY] Error validating ownership:', error);
        router.push(`/${lang}/dashboard`);
      }
    };

    validateOwnership();
  }, [referralCode, lang, router]);

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
    // Only load metrics if ownership is validated
    if (ownershipValidated) {
      loadMetrics(period);
    }
  }, [period, ownershipValidated]);

  const handleRefresh = () => {
    loadMetrics(period);
  };

  const handlePeriodChange = (newPeriod: MetricsPeriod) => {
    setPeriod(newPeriod);
  };

  const analyticsCopy = dict.analytics;

  // Generate mock trend data for visualization
  const generateTrendData = () => {
    const days = period === 'today' ? 24 : period === 'yesterday' ? 24 : period === 'last_7_days' ? 7 : period === 'last_30_days' ? 30 : 90;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const baseVisits = metrics?.basic.total_visits || 0;
      const baseRevenue = metrics?.basic.total_revenue || 0;
      const baseOrders = metrics?.basic.total_orders || 0;

      data.push({
        date: period === 'today' || period === 'yesterday' ? format(date, 'HH:mm') : format(date, 'MMM dd'),
        visits: Math.floor((baseVisits / days) * (0.8 + Math.random() * 0.4)),
        revenue: (baseRevenue / days) * (0.8 + Math.random() * 0.4),
        orders: Math.floor((baseOrders / days) * (0.8 + Math.random() * 0.4)),
        conversion: metrics?.basic.conversion_rate ? metrics.basic.conversion_rate * (0.8 + Math.random() * 0.4) : 0,
      });
    }

    return data;
  };

  const dataCollectionDict = analyticsCopy.dataCollected;

  const trendData = metrics ? generateTrendData() : [];

  // Show access error if validation failed
  if (accessError) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <Card className="border-destructive/50">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <BarChart3 className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-xl">
                  {accessError.type === 'subscription' 
                    ? analyticsCopy.errors?.subscriptionRequired
                    : accessError.type === 'waitlisted'
                    ? analyticsCopy.errors?.accountWaitlisted
                    : analyticsCopy.errors?.accessDenied}
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  {accessError.type === 'subscription'
                    ? analyticsCopy.errors?.needsSubscription
                    : accessError.type === 'waitlisted'
                    ? analyticsCopy.errors?.waitlistedMessage
                    : analyticsCopy.errors?.noPermission}
                </CardDescription>
              </CardHeader>
              <div className="p-6 pt-0 flex flex-col gap-3">
                {accessError.type === 'subscription' && (
                  <Button 
                    onClick={() => router.push(`/${lang}/subscription`)}
                    className="w-full"
                  >
                    {analyticsCopy.errors?.viewPlans}
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => router.push(`/${lang}/affiliate/${referralCode}`)}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {analyticsCopy.errors?.backToStore}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (isLoading) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="animate-pulse space-y-6">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
                ))}
              </div>
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {analyticsCopy.back}
          </Button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                {analyticsCopy.title}
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {analyticsCopy.description}
            </p>
          </div>

          {/* Data Collection Info */}
          <div className="mb-6">
            <DataCollectionInfo
              title={dataCollectionDict.title}
              description={dataCollectionDict.description}
              dict={dataCollectionDict}
            />
          </div>

          {/* Period Selector */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-lg">
                      {analyticsCopy.analysisPeriod}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {analyticsCopy.analysisPeriodDescription}
                    </CardDescription>
                  </div>
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
            <>
              <BasicMetrics
                metrics={metrics.basic}
                dict={analyticsCopy.metrics}
                showTrends={true}
              />

              {/* Charts Section */}
              <div className="grid gap-6 mt-6 lg:grid-cols-2">
                {/* Revenue & Orders Trend */}
                <TrendChart
                  data={trendData}
                  title={analyticsCopy.trends?.revenueOrders}
                  description={analyticsCopy.trends?.revenueOrdersDescription}
                  dataKeys={[
                    { key: 'revenue', name: analyticsCopy.metrics.revenue, color: '#10b981', format: 'currency' },
                    { key: 'orders', name: analyticsCopy.advanced?.timeSeries?.orders ?? 'Orders', color: '#f59e0b', format: 'number' },
                  ]}
                  type="area"
                  height={300}
                />

                {/* Visits Trend */}
                <TrendChart
                  data={trendData}
                  title={analyticsCopy.trends?.visits}
                  description={analyticsCopy.trends?.visitsDescription}
                  dataKeys={[
                    { key: 'visits', name: analyticsCopy.advanced?.timeSeries?.visits ?? 'Visits', color: '#3b82f6', format: 'number' },
                  ]}
                  type="area"
                  height={300}
                />
              </div>

              {/* Conversion Funnel */}
              <div className="mt-6">
                <ConversionFunnel
                  title={analyticsCopy.funnel?.title}
                  description={analyticsCopy.funnel?.description}
                  stages={{
                    visits: metrics.basic.total_visits,
                    productViews: metrics.basic.page_views,
                    addToCart: metrics.basic.top_products.reduce((sum, p) => sum + p.add_to_cart, 0),
                    purchases: metrics.basic.total_orders,
                  }}
                  dict={{
                    visits: analyticsCopy.funnel?.visits ?? 'Visits',
                    productViews: analyticsCopy.funnel?.productViews ?? 'Product Views',
                    addToCart: analyticsCopy.funnel?.addToCart ?? 'Added to Cart',
                    purchases: analyticsCopy.funnel?.purchases ?? 'Completed Purchases',
                    conversionRate: analyticsCopy.funnel?.conversionRate ?? 'Conversion rate',
                    dropOff: analyticsCopy.funnel?.dropOff ?? 'drop-off',
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
