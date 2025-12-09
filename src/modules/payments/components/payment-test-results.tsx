'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentTestResult {
  id: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  externalId?: string;
}

interface PaymentTestResultsProps {
  provider?: PaymentProvider;
  maxResults?: number;
}

export const PaymentTestResults = ({ 
  provider, 
  maxResults = 10 
}: PaymentTestResultsProps) => {
  const [results, setResults] = useState<PaymentTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from an API
    const mockResults: PaymentTestResult[] = [
      {
        id: '1',
        provider: 'stripe',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        completedAt: new Date(Date.now() - 1000 * 60 * 29),
        externalId: 'cs_test_123',
      },
      {
        id: '2',
        provider: 'paypal',
        amount: 25.00,
        currency: 'USD',
        status: 'failed',
        createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        error: 'Invalid credentials',
      },
    ];

    // Filter by provider if specified
    const filteredResults = provider 
      ? mockResults.filter(r => r.provider === provider)
      : mockResults;

    setTimeout(() => {
      setResults(filteredResults.slice(0, maxResults));
      setIsLoading(false);
    }, 500);
  }, [provider, maxResults]);

  const getStatusIcon = (status: PaymentTestResult['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusVariant = (status: PaymentTestResult['status']) => {
    switch (status) {
      case 'completed':
        return 'default' as const;
      case 'failed':
      case 'cancelled':
        return 'destructive' as const;
      case 'pending':
        return 'secondary' as const;
    }
  };

  const formatDuration = (start: Date, end?: Date) => {
    if (!end) return 'N/A';
    const diff = end.getTime() - start.getTime();
    return `${Math.round(diff / 1000)}s`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Test Results</CardTitle>
        <CardDescription>
          {provider 
            ? `Latest ${provider.toUpperCase()} test payments`
            : 'Latest payment tests across all providers'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <p className="text-muted-foreground text-sm">No test results yet.</p>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {result.provider.toUpperCase()}
                      </span>
                      <Badge variant={getStatusVariant(result.status)}>
                        {result.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${result.amount.toFixed(2)} {result.currency}
                      {result.completedAt && (
                        <span className="ml-2">
                          • {formatDuration(result.createdAt, result.completedAt)}
                        </span>
                      )}
                    </div>
                    {result.error && (
                      <div className="text-xs text-destructive mt-1">
                        {result.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {result.createdAt.toLocaleTimeString()}
                  </span>
                  {result.externalId && (
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};