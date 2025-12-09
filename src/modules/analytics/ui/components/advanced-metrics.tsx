'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, TrendingUp, Laptop, Smartphone, Tablet } from 'lucide-react';
import type { AdvancedMetrics } from '../../domain/models/analytics-metrics';

interface AdvancedMetricsProps {
  metrics?: AdvancedMetrics;
  isEnabled: boolean;
  dict: {
    title: string;
    description: string;
    comingSoon: string;
    unlockMessage: string;
    unlockButton: string;
    funnel: {
      title: string;
      productViews: string;
      addToCart: string;
      beginCheckout: string;
      addPaymentInfo: string;
      purchase: string;
      cartConversion: string;
      checkoutConversion: string;
      paymentConversion: string;
      overallConversion: string;
    };
    devices: {
      title: string;
      desktop: string;
      mobile: string;
      tablet: string;
    };
    timeSeries: {
      title: string;
      date: string;
      visits: string;
      orders: string;
      revenue: string;
    };
  };
  onUnlock?: () => void;
}

/**
 * Advanced Analytics Component
 * Shows advanced metrics or upsell if not enabled
 */
export function AdvancedMetrics({ metrics, isEnabled, dict, onUnlock }: AdvancedMetricsProps) {
  if (!isEnabled || !metrics) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{dict.title}</CardTitle>
          </div>
          <CardDescription>{dict.description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{dict.comingSoon}</h3>
            <p className="text-sm text-muted-foreground mb-6">{dict.unlockMessage}</p>
            {onUnlock && (
              <Button onClick={onUnlock} size="lg">
                {dict.unlockButton}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversion Funnel */}
      {metrics.funnel && (
        <Card>
          <CardHeader>
            <CardTitle>{dict.funnel.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <FunnelStep
                label={dict.funnel.productViews}
                value={metrics.funnel.product_views}
                percentage={100}
              />
              <FunnelStep
                label={dict.funnel.addToCart}
                value={metrics.funnel.add_to_cart}
                percentage={metrics.funnel.cart_conversion}
              />
              <FunnelStep
                label={dict.funnel.beginCheckout}
                value={metrics.funnel.begin_checkout}
                percentage={metrics.funnel.checkout_conversion}
              />
              <FunnelStep
                label={dict.funnel.addPaymentInfo}
                value={metrics.funnel.add_payment_info}
                percentage={metrics.funnel.payment_conversion}
              />
              <FunnelStep
                label={dict.funnel.purchase}
                value={metrics.funnel.purchase}
                percentage={metrics.funnel.overall_conversion}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device Breakdown */}
      {metrics.devices && (
        <Card>
          <CardHeader>
            <CardTitle>{dict.devices.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <DeviceCard
                icon={Laptop}
                label={dict.devices.desktop}
                value={metrics.devices.desktop}
                total={metrics.devices.desktop + metrics.devices.mobile + metrics.devices.tablet}
              />
              <DeviceCard
                icon={Smartphone}
                label={dict.devices.mobile}
                value={metrics.devices.mobile}
                total={metrics.devices.desktop + metrics.devices.mobile + metrics.devices.tablet}
              />
              <DeviceCard
                icon={Tablet}
                label={dict.devices.tablet}
                value={metrics.devices.tablet}
                total={metrics.devices.desktop + metrics.devices.mobile + metrics.devices.tablet}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Series */}
      {metrics.time_series && metrics.time_series.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{dict.timeSeries.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">{dict.timeSeries.date}</th>
                    <th className="text-right py-2 px-4">{dict.timeSeries.visits}</th>
                    <th className="text-right py-2 px-4">{dict.timeSeries.orders}</th>
                    <th className="text-right py-2 px-4">{dict.timeSeries.revenue}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.time_series.slice(-7).map((row) => (
                    <tr key={row.date} className="border-b last:border-0">
                      <td className="py-2 px-4">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="text-right py-2 px-4">{row.visits.toLocaleString()}</td>
                      <td className="text-right py-2 px-4">{row.orders.toLocaleString()}</td>
                      <td className="text-right py-2 px-4">
                        ${row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FunnelStep({ label, value, percentage }: { label: string; value: number; percentage: number }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {value.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function DeviceCard({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: typeof Laptop;
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex flex-col items-center p-4 border rounded-lg">
      <Icon className="h-8 w-8 mb-2 text-primary" />
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
    </div>
  );
}
