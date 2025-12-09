'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface OrderFulfillmentErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}

export const OrderFulfillmentErrorState = ({
  title,
  description,
  retryLabel,
  onRetry,
}: OrderFulfillmentErrorStateProps) => (
  <Alert
    variant="destructive"
    className="flex flex-col gap-4 rounded-3xl border border-destructive/40 bg-destructive/10 text-destructive"
    data-testid="order-fulfillment-error"
  >
    <div>
      <AlertTitle className="text-lg font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-1 text-sm text-destructive/80">{description}</AlertDescription>
    </div>
    <div>
      <Button
        onClick={onRetry}
        variant="outline"
        className="rounded-full border-destructive/60 px-6 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        {retryLabel}
      </Button>
    </div>
  </Alert>
);
