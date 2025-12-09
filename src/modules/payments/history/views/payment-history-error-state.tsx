'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

interface PaymentHistoryErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}

export const PaymentHistoryErrorState = ({ title, description, retryLabel, onRetry }: PaymentHistoryErrorStateProps) => (
  <Alert variant="destructive" className="rounded-3xl border border-destructive/40 bg-destructive/10 text-destructive">
    <TriangleAlert className="h-5 w-5" />
    <AlertTitle className="font-semibold">{title}</AlertTitle>
    <AlertDescription className="flex flex-col gap-3 text-sm">
      <span>{description}</span>
      <Button variant="outline" size="sm" onClick={onRetry} className="w-fit rounded-full border-destructive/60 text-destructi
ve">
        {retryLabel}
      </Button>
    </AlertDescription>
  </Alert>
);
