'use client';

import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { PaymentScheduleConfig, PaymentScheduleUpdateInput } from '../domain/models/payment-schedule';

const PaymentScheduleFormSchema = z.object({
  paymentMode: z.enum(['manual', 'automatic']),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  dayOfMonth: z.string().optional(),
  weekday: z.string().optional(),
  defaultAmount: z
    .string()
    .min(1)
    .refine((value) => Number.parseFloat(value) >= 0, {
      message: 'Enter a valid amount',
    }),
  reminders: z.string().optional(),
});

type PaymentScheduleFormValues = z.infer<typeof PaymentScheduleFormSchema>;

const weekdayOptions = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

export interface PaymentScheduleFormCopy {
  title: string;
  description: string;
  paymentModeLabel: string;
  paymentModeOptions: {
    manual: string;
    automatic: string;
  };
  paymentModeHint: {
    manual: string;
    automatic: string;
  };
  frequencyLabel: string;
  frequencyOptions: {
    weekly: string;
    biweekly: string;
    monthly: string;
  };
  dayOfMonthLabel: string;
  weekdayLabel: string;
  defaultAmountLabel: string;
  defaultAmountHint: string;
  remindersLabel: string;
  remindersHint: string;
  submitLabel: string;
  savingLabel: string;
  lastUpdatedLabel: string;
}

interface PaymentScheduleFormProps {
  copy: PaymentScheduleFormCopy;
  schedule: PaymentScheduleConfig | null;
  currency: string;
  onSubmit: (input: PaymentScheduleUpdateInput) => Promise<void>;
  isSubmitting?: boolean;
}

export const PaymentScheduleForm = ({ copy, schedule, currency, onSubmit, isSubmitting = false }: PaymentScheduleFormProps) => {
  const form = useForm<PaymentScheduleFormValues>({
    resolver: zodResolver(PaymentScheduleFormSchema),
    defaultValues: {
      paymentMode: schedule?.paymentMode ?? 'automatic',
      frequency: schedule?.frequency ?? 'monthly',
      dayOfMonth: schedule?.dayOfMonth ? String(schedule.dayOfMonth) : '',
      weekday: schedule?.weekday !== null && schedule?.weekday !== undefined ? String(schedule.weekday) : '1',
      defaultAmount: schedule ? String(schedule.defaultAmountCents / 100) : '0',
      reminders: schedule?.reminderDaysBefore.join(', ') ?? '3, 1',
    },
  });

  useEffect(() => {
    form.reset({
      paymentMode: schedule?.paymentMode ?? 'automatic',
      frequency: schedule?.frequency ?? 'monthly',
      dayOfMonth: schedule?.dayOfMonth ? String(schedule.dayOfMonth) : '',
      weekday: schedule?.weekday !== null && schedule?.weekday !== undefined ? String(schedule.weekday) : '1',
      defaultAmount: schedule ? String(schedule.defaultAmountCents / 100) : '0',
      reminders: schedule?.reminderDaysBefore.join(', ') ?? '3, 1',
    });
  }, [form, schedule]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const defaultAmountCents = Math.round(Number.parseFloat(values.defaultAmount) * 100);
    const reminderDaysBefore = values.reminders
      ? values.reminders
          .split(',')
          .map((entry) => Number.parseInt(entry.trim(), 10))
          .filter((entry) => !Number.isNaN(entry) && entry >= 0)
      : [];

    const parsedDay = Number.parseInt(values.dayOfMonth ?? '', 10);
    const normalizedDay = Number.isNaN(parsedDay) ? 1 : parsedDay;
    const parsedWeekday = Number.parseInt(values.weekday ?? '', 10);
    const normalizedWeekday = Number.isNaN(parsedWeekday) ? 1 : parsedWeekday;

    const payload: PaymentScheduleUpdateInput = {
      paymentMode: values.paymentMode,
      frequency: values.frequency,
      defaultAmountCents,
      reminderDaysBefore,
      dayOfMonth: values.frequency === 'monthly' ? normalizedDay : null,
      weekday: values.frequency !== 'monthly' ? normalizedWeekday : null,
      currency,
    };

    await onSubmit(payload);
  });

  const formatDate = (value: string | null | undefined) => {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <Card className="border border-primary/10 bg-background-light/80 shadow-sm backdrop-blur dark:border-primary/20 dark:bg-backgro
und-dark/80">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="paymentMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.paymentModeLabel}</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automatic">{copy.paymentModeOptions.automatic}</SelectItem>
                        <SelectItem value="manual">{copy.paymentModeOptions.manual}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    {field.value === 'manual' ? copy.paymentModeHint.manual : copy.paymentModeHint.automatic}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.frequencyLabel}</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">{copy.frequencyOptions.weekly}</SelectItem>
                        <SelectItem value="biweekly">{copy.frequencyOptions.biweekly}</SelectItem>
                        <SelectItem value="monthly">{copy.frequencyOptions.monthly}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('frequency') === 'monthly' ? (
              <FormField
                control={form.control}
                name="dayOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{copy.dayOfMonthLabel}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={28} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="weekday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{copy.weekdayLabel}</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value ?? '1'}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {weekdayOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="defaultAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.defaultAmountLabel}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-background-light px-3 py-2 text-s
m shadow-inner dark:border-primary/30 dark:bg-background-dark">
                      <span className="text-xs font-semibold text-muted-foreground">{currency}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="border-0 bg-transparent p-0 focus-visible:ring-0"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>{copy.defaultAmountHint}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminders"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.remindersLabel}</FormLabel>
                  <FormControl>
                    <Input placeholder="3,1" {...field} />
                  </FormControl>
                  <FormDescription>{copy.remindersHint}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <Separator className="mx-6" />
          <CardFooter className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {copy.lastUpdatedLabel}: {formatDate(schedule?.updatedAt)}
            </div>
            <Button type="submit" className="rounded-full" disabled={isSubmitting}>
              {isSubmitting ? copy.savingLabel : copy.submitLabel}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};
