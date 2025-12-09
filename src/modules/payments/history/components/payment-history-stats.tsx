'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PaymentStatus } from '../domain/models/payment-history-entry';

interface PaymentHistoryStatsProps {
  stats: Record<PaymentStatus, number> & { total: number };
  copy: {
    total: string;
    paid: string;
    pending: string;
    overdue: string;
    upcoming: string;
  };
}

const statusOrder: PaymentStatus[] = ['paid', 'pending', 'overdue', 'upcoming'];

const statusBadgeVariant: Record<PaymentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  pending: 'secondary',
  overdue: 'destructive',
  upcoming: 'outline',
};

export const PaymentHistoryStats = ({ stats, copy }: PaymentHistoryStatsProps) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <Card className="bg-background-light/90 dark:bg-background-dark/90">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{copy.total}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold">{stats.total}</span>
      </CardContent>
    </Card>
    {statusOrder.map((status) => (
      <Card key={status} className="bg-background-light/90 dark:bg-background-dark/90">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{copy[status]}</CardTitle>
          <Badge variant={statusBadgeVariant[status]}>{stats[status]}</Badge>
        </CardHeader>
        <CardContent>
          <span className="text-2xl font-semibold">{stats[status]}</span>
        </CardContent>
      </Card>
    ))}
  </div>
);
