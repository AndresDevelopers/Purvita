'use client';

import { Button } from '@/components/ui/button';

interface OrderFulfillmentEmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export const OrderFulfillmentEmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
}: OrderFulfillmentEmptyStateProps) => (
  <div
    className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-primary/30 bg-background-light/70 p-10 text-center shadow-none dark:border-primary/40 dark:bg-background-dark/70"
    data-testid="order-fulfillment-empty"
  >
    <h3 className="text-xl font-semibold text-primary-dark dark:text-primary-light">{title}</h3>
    <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
    <Button
      onClick={onAction}
      variant="outline"
      className="mt-6 rounded-full border-primary/40 px-6 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
    >
      {actionLabel}
    </Button>
  </div>
);
