import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import type { TestResult } from '../hooks/use-payment-test';

interface TestResultItemProps {
  result: TestResult;
}

const getStatusIcon = (status: TestResult['status']) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-gray-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    default:
      return null;
  }
};

const getStatusBadge = (status: TestResult['status']) => {
  const variants = {
    success: 'default' as const,
    failed: 'destructive' as const,
    cancelled: 'secondary' as const,
    pending: 'outline' as const
  };
  
  return (
    <Badge variant={variants[status]} className="text-xs">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

export const TestResultItem = ({ result }: TestResultItemProps) => {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        {getStatusIcon(result.status)}
        <div>
          <div className="font-medium text-sm">{result.scenario}</div>
          <div className="text-xs text-muted-foreground">
            ${result.amount} • {result.timestamp.toLocaleString()}
          </div>
          {result.error && (
            <div className="text-xs text-red-500 mt-1">{result.error}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(result.status)}
        {result.paymentUrl && result.status === 'pending' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(result.paymentUrl, '_blank')}
          >
            Open Payment
          </Button>
        )}
      </div>
    </div>
  );
};