'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PaymentHistoryEmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export const PaymentHistoryEmptyState = ({ title, description, actionLabel, onAction }: PaymentHistoryEmptyStateProps) => (
  <Card className="border border-dashed border-primary/20 bg-background-light/80 text-center shadow-none dark:border-primary/30 dar
k:bg-background-dark/80">
    <CardHeader>
      <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <Button onClick={onAction} className="rounded-full">
        {actionLabel}
      </Button>
    </CardContent>
  </Card>
);
