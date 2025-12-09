'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BasicMetrics } from '../../domain/models/analytics-metrics';
import { TrendingUp, Users, Eye, ShoppingCart, DollarSign, Target, Package, BarChart3 } from 'lucide-react';

interface BasicMetricsProps {
  metrics: BasicMetrics;
  dict: {
    totalVisits: string;
    uniqueVisitors: string;
    pageViews: string;
    totalOrders: string;
    totalRevenue: string;
    avgOrderValue: string;
    conversionRate: string;
    topProducts: string;
    views: string;
    addToCart: string;
    purchases: string;
    revenue: string;
  };
  currency?: string;
  showTrends?: boolean;
}

/**
 * Basic Metrics Display Component
 * Shows core analytics metrics with enhanced visualizations
 */
export function BasicMetrics({ metrics, dict, currency = 'USD', showTrends = true }: BasicMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatCompactNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const metricCards = [
    {
      title: dict.totalVisits,
      value: formatNumber(metrics.total_visits),
      icon: Eye,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      title: dict.uniqueVisitors,
      value: formatNumber(metrics.unique_visitors),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      title: dict.pageViews,
      value: formatNumber(metrics.page_views),
      icon: Eye,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: dict.totalOrders,
      value: formatNumber(metrics.total_orders),
      icon: ShoppingCart,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
    {
      title: dict.totalRevenue,
      value: formatCurrency(metrics.total_revenue),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/20',
    },
    {
      title: dict.avgOrderValue,
      value: formatCurrency(metrics.avg_order_value),
      icon: TrendingUp,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/20',
    },
    {
      title: dict.conversionRate,
      value: `${metrics.conversion_rate.toFixed(2)}%`,
      icon: Target,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100 dark:bg-pink-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <div className={`${metric.bgColor} p-2 rounded-lg`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{metric.value}</div>
                  {showTrends && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>Datos en tiempo real</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Products */}
      {metrics.top_products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {dict.topProducts}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.top_products.map((product, index) => {
                const conversionRate = product.views > 0
                  ? (product.purchases / product.views) * 100
                  : 0;
                const maxRevenue = Math.max(...metrics.top_products.map(p => p.revenue));
                const revenuePercentage = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;

                return (
                  <div
                    key={product.product_id}
                    className="space-y-2 border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' :
                          index === 1 ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400' :
                          index === 2 ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.product_name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {formatCompactNumber(product.views)}
                            </span>
                            <span className="flex items-center gap-1">
                              <ShoppingCart className="h-3 w-3" />
                              {formatCompactNumber(product.add_to_cart)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {formatCompactNumber(product.purchases)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-lg">{formatCurrency(product.revenue)}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          {conversionRate.toFixed(1)}% conv.
                        </p>
                      </div>
                    </div>

                    {/* Revenue Bar */}
                    <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${revenuePercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
