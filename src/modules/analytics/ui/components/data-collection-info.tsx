'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Activity,
  CheckCircle2,
  Info
} from 'lucide-react';

interface DataPoint {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  status: 'active' | 'collecting';
}

interface DataCollectionInfoProps {
  title: string;
  description: string;
  dict: {
    active: string;
    collecting: string;
    visits: {
      title: string;
      description: string;
    };
    products: {
      title: string;
      description: string;
    };
    cart: {
      title: string;
      description: string;
    };
    purchases: {
      title: string;
      description: string;
    };
    conversion: {
      title: string;
      description: string;
    };
  };
}

/**
 * Data Collection Info Component
 * Shows what data is being collected and how it's used
 */
export function DataCollectionInfo({ title, description, dict }: DataCollectionInfoProps) {
  const dataPoints: DataPoint[] = [
    {
      icon: Eye,
      title: dict.visits.title,
      description: dict.visits.description,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      status: 'active',
    },
    {
      icon: Activity,
      title: dict.products.title,
      description: dict.products.description,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      status: 'active',
    },
    {
      icon: ShoppingCart,
      title: dict.cart.title,
      description: dict.cart.description,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      status: 'active',
    },
    {
      icon: CreditCard,
      title: dict.purchases.title,
      description: dict.purchases.description,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      status: 'active',
    },
    {
      icon: TrendingUp,
      title: dict.conversion.title,
      description: dict.conversion.description,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100 dark:bg-pink-900/20',
      status: 'collecting',
    },
  ];

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dataPoints.map((point) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className="relative p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
              >
                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  <Badge
                    variant={point.status === 'active' ? 'default' : 'secondary'}
                    className={`text-xs ${
                      point.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                        : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    {point.status === 'active' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {dict.active}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3 animate-pulse" />
                        {dict.collecting}
                      </span>
                    )}
                  </Badge>
                </div>

                {/* Icon */}
                <div className={`${point.bgColor} p-3 rounded-lg w-fit mb-3`}>
                  <Icon className={`h-5 w-5 ${point.color}`} />
                </div>

                {/* Content */}
                <h3 className="font-semibold text-sm mb-1">{point.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Privacy Note */}
        <div className="mt-6 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {dict.visits.title === 'Visitas y Tráfico' 
                ? 'Todos los datos se recolectan de forma anónima y segura. No almacenamos información personal identificable sin consentimiento.'
                : 'All data is collected anonymously and securely. We do not store personally identifiable information without consent.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

