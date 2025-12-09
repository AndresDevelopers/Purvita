'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { PaymentHistoryEventBus, PaymentHistoryObserver } from '../domain/events/payment-history-event-bus';
import { usePaymentHistoryEvents } from './use-payment-history-events';

export interface PaymentHistoryToastsCopy {
  paymentAdded: string;
  paymentUpdated: string;
  scheduleUpdated: string;
  errorTitle: string;
}

const defaultCopy: PaymentHistoryToastsCopy = {
  paymentAdded: 'Payment registered successfully',
  paymentUpdated: 'Payment status updated',
  scheduleUpdated: 'Schedule settings saved',
  errorTitle: 'Something went wrong',
};

export const usePaymentHistoryToasts = (
  eventBus: PaymentHistoryEventBus,
  copy: PaymentHistoryToastsCopy = defaultCopy,
) => {
  const { toast } = useToast();

  const observer = useCallback<PaymentHistoryObserver>(
    (event) => {
      if (event.type === 'entry_added') {
        toast({
          title: copy.paymentAdded,
          variant: 'default',
        });
      }
      if (event.type === 'entry_updated') {
        toast({
          title: copy.paymentUpdated,
          variant: 'default',
        });
      }
      if (event.type === 'schedule_updated') {
        toast({
          title: copy.scheduleUpdated,
          variant: 'default',
        });
      }
      if (event.type === 'history_error') {
        toast({
          title: copy.errorTitle,
          description: event.error.message,
          variant: 'destructive',
        });
      }
    },
    [toast, copy],
  );

  usePaymentHistoryEvents(eventBus, observer);
};
