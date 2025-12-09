'use client';

import { Skeleton } from '@/components/ui/skeleton';

export const OrderFulfillmentLoadingState = () => (
  <div className="space-y-6" data-testid="order-fulfillment-loading">
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/60 bg-background-light/80 p-4 shadow-sm dark:border-border/40 dark:bg-background-dark/80"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
          <Skeleton className="mt-3 h-4 w-20" />
        </div>
      ))}
    </div>
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-3xl border border-border/70 bg-background-light/90 p-5 shadow-sm dark:border-border/40 dark:bg-background-dark/80"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((__, idx) => (
              <Skeleton key={idx} className="h-4 w-full" />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((__, idx) => (
              <Skeleton key={idx} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);
