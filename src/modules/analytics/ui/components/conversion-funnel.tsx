'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, ShoppingCart, CheckCircle, TrendingDown } from 'lucide-react';

interface FunnelStage {
  name: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface ConversionFunnelProps {
  title: string;
  description?: string;
  stages: {
    visits: number;
    productViews: number;
    addToCart: number;
    purchases: number;
  };
  dict: {
    visits: string;
    productViews: string;
    addToCart: string;
    purchases: string;
    conversionRate: string;
    dropOff: string;
  };
}

/**
 * Conversion Funnel Component
 * Visualizes the customer journey from visit to purchase
 */
export function ConversionFunnel({ title, description, stages, dict }: ConversionFunnelProps) {
  const funnelStages: FunnelStage[] = [
    {
      name: dict.visits,
      value: stages.visits,
      icon: Eye,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      name: dict.productViews,
      value: stages.productViews,
      icon: Eye,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      name: dict.addToCart,
      value: stages.addToCart,
      icon: ShoppingCart,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
    {
      name: dict.purchases,
      value: stages.purchases,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
  ];

  const calculateConversionRate = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return (current / previous) * 100;
  };

  const calculateDropOff = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((previous - current) / previous) * 100;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {funnelStages.map((stage, index) => {
            const Icon = stage.icon;
            const previousStage = index > 0 ? funnelStages[index - 1] : null;
            const conversionRate = previousStage
              ? calculateConversionRate(stage.value, previousStage.value)
              : 100;
            const dropOff = previousStage
              ? calculateDropOff(stage.value, previousStage.value)
              : 0;

            // Calculate width percentage for funnel visualization
            const maxValue = funnelStages[0].value;
            const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;

            return (
              <div key={stage.name} className="space-y-2">
                {/* Stage Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`${stage.bgColor} p-2 rounded-lg`}>
                      <Icon className={`h-4 w-4 ${stage.color}`} />
                    </div>
                    <span className="font-medium text-sm">{stage.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatNumber(stage.value)}</div>
                    {index > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {conversionRate.toFixed(1)}% {dict.conversionRate}
                      </div>
                    )}
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="relative h-12 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${stage.bgColor} transition-all duration-500 flex items-center justify-between px-4`}
                    style={{ width: `${widthPercentage}%` }}
                  >
                    <span className={`font-semibold text-sm ${stage.color}`}>
                      {widthPercentage.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Drop-off indicator */}
                {index > 0 && dropOff > 0 && (
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 ml-12">
                    <TrendingDown className="h-3 w-3" />
                    <span>
                      {dropOff.toFixed(1)}% {dict.dropOff}
                    </span>
                  </div>
                )}

                {/* Separator */}
                {index < funnelStages.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Overall Conversion Rate */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {dict.conversionRate} Total
            </span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {calculateConversionRate(stages.purchases, stages.visits).toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

