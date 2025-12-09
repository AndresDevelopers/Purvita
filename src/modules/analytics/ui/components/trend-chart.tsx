'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface TrendDataPoint {
  date: string;
  visits?: number;
  revenue?: number;
  orders?: number;
  conversion?: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  title: string;
  description?: string;
  dataKeys: {
    key: string;
    name: string;
    color: string;
    format?: 'number' | 'currency' | 'percentage';
  }[];
  type?: 'line' | 'area';
  showLegend?: boolean;
  height?: number;
}

/**
 * Trend Chart Component
 * Displays time series data with customizable metrics
 */
export function TrendChart({
  data,
  title,
  description,
  dataKeys,
  type = 'area',
  showLegend = true,
  height = 300,
}: TrendChartProps) {
  const formatValue = (value: number, format?: 'number' | 'currency' | 'percentage') => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (format === 'percentage') {
      return `${value.toFixed(1)}%`;
    }
    return new Intl.NumberFormat('en-US').format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            const dataKey = dataKeys.find(dk => dk.key === entry.dataKey);
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
                <span className="font-semibold">
                  {formatValue(entry.value, dataKey?.format)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Calculate trend (comparing first and last values)
  const calculateTrend = () => {
    if (data.length < 2 || dataKeys.length === 0) return null;
    
    const firstValue = data[0][dataKeys[0].key as keyof TrendDataPoint] as number || 0;
    const lastValue = data[data.length - 1][dataKeys[0].key as keyof TrendDataPoint] as number || 0;
    
    if (firstValue === 0) return null;
    
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;
    return {
      value: percentChange,
      isPositive: percentChange >= 0,
    };
  };

  const trend = calculateTrend();

  const ChartComponent = type === 'area' ? AreaChart : LineChart;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
              trend.isPositive 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => formatValue(value, dataKeys[0]?.format)}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            {dataKeys.map((dataKey) => {
              if (type === 'area') {
                return (
                  <Area
                    key={dataKey.key}
                    type="monotone"
                    dataKey={dataKey.key}
                    name={dataKey.name}
                    stroke={dataKey.color}
                    fill={dataKey.color}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                );
              } else {
                return (
                  <Line
                    key={dataKey.key}
                    type="monotone"
                    dataKey={dataKey.key}
                    name={dataKey.name}
                    stroke={dataKey.color}
                    strokeWidth={2}
                    dot={{ fill: dataKey.color, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                );
              }
            })}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

