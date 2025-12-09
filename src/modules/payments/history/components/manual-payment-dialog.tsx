'use client';

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import type { ManualPaymentInput, PaymentMethod } from '../domain/models/payment-history-entry';
import type { PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';

const ManualPaymentFormSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  userEmail: z.string().email(),
  amount: z
    .string()
    .min(1)
    .refine((value) => Number.parseFloat(value) > 0, {
      message: 'Enter an amount greater than zero',
    }),
  method: z.string().min(1), // Changed to string to support dynamic providers
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

type ManualPaymentFormValues = z.infer<typeof ManualPaymentFormSchema>;

interface _UserProfile {
  id: string;
  name: string;
  email: string;
}

interface ActiveProvider {
  provider: PaymentProvider;
  label: string;
}

export interface ManualPaymentDialogCopy {
  triggerLabel: string;
  title: string;
  description: string;
  userIdLabel: string;
  userIdPlaceholder: string;
  userNameLabel: string;
  userEmailLabel: string;
  amountLabel: string;
  methodLabel: string;
  notesLabel: string;
  paidAtLabel: string;
  cancelLabel: string;
  submitLabel: string;
  amountHint: string;
  notesPlaceholder: string;
  successMessage?: string;
  searchingUser: string;
  userNotFound: string;
  loadingProviders: string;
  noProvidersConfigured: string;
}

interface ManualPaymentDialogProps {
  copy: ManualPaymentDialogCopy;
  currency: string;
  onSubmit: (input: ManualPaymentInput) => Promise<void>;
  isSubmitting?: boolean;
}

export const ManualPaymentDialog = ({ copy, currency, onSubmit, isSubmitting = false }: ManualPaymentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [searchingUser, setSearchingUser] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [activeProviders, setActiveProviders] = useState<ActiveProvider[]>([]);

  const form = useForm<ManualPaymentFormValues>({
    resolver: zodResolver(ManualPaymentFormSchema),
    defaultValues: {
      userId: '',
      userName: '',
      userEmail: '',
      amount: '',
      method: '',
      notes: '',
      paidAt: '',
    },
  });

  // Load active payment providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoadingProviders(true);
        const response = await fetch('/api/admin/payments/active-providers');
        if (response.ok) {
          const data = await response.json();
          const providers: ActiveProvider[] = data.providers.map((p: { provider: PaymentProvider }) => ({
            provider: p.provider,
            label: p.provider === 'paypal' ? 'PayPal' : p.provider === 'stripe' ? 'Stripe' : 'Wallet',
          }));
          setActiveProviders(providers);

          // Set default method to first active provider
          if (providers.length > 0 && !form.getValues('method')) {
            form.setValue('method', providers[0].provider);
          }
        }
      } catch (error) {
        console.error('Failed to load payment providers:', error);
      } finally {
        setLoadingProviders(false);
      }
    };

    if (open) {
      loadProviders();
    }
  }, [open, form]);

  // Search user by ID
  const searchUser = useCallback(async (userId: string) => {
    if (!userId || userId.length < 3) return;

    try {
      setSearchingUser(true);
      const response = await fetch(`/api/admin/users/${userId}`);

      if (response.ok) {
        const data = await response.json();
        const profile = data.profile;

        form.setValue('userName', profile?.name || '');
        form.setValue('userEmail', profile?.email || '');
      } else {
        // Clear fields if user not found
        form.setValue('userName', '');
        form.setValue('userEmail', '');
        form.setError('userId', { message: copy.userNotFound });
      }
    } catch (error) {
      console.error('Failed to search user:', error);
      form.setValue('userName', '');
      form.setValue('userEmail', '');
    } finally {
      setSearchingUser(false);
    }
  }, [form, copy.userNotFound]);

  // Watch userId changes to auto-search
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'userId' && value.userId) {
        const userId = value.userId as string;
        const timeoutId = setTimeout(() => {
          searchUser(userId);
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, searchUser]);

  // Handle paste event for immediate user lookup
  const handleUserIdPaste = async (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData.getData('text').trim();
    if (pastedText && pastedText.length >= 3) {
      // Wait a brief moment for the form value to update
      setTimeout(() => {
        searchUser(pastedText);
      }, 100);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const amountNumber = Number.parseFloat(values.amount);
      const amountCents = Number.isNaN(amountNumber) ? 0 : Math.round(amountNumber * 100);

      // Map provider to payment method
      const method = values.method as PaymentMethod;

      await onSubmit({
        userId: values.userId,
        userName: values.userName,
        userEmail: values.userEmail,
        amountCents,
        currency,
        method,
        notes: values.notes,
        paidAt: values.paidAt ? new Date(values.paidAt).toISOString() : undefined,
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Failed to register manual payment', error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-11 rounded-full px-4 font-medium shadow-sm">
          {copy.triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border border-primary/10 bg-background-light p-6 shadow-2xl dark:border-primary/20 dark:bg-background-dark sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{copy.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.userIdLabel}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder={copy.userIdPlaceholder}
                        {...field}
                        onPaste={handleUserIdPaste}
                      />
                      {searchingUser && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">
                    {searchingUser ? copy.searchingUser : ''}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.userNameLabel}</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.userEmailLabel}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@example.com" {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.amountLabel}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-background-light px-3 py-2 text-sm shadow-inner dark:border-primary/30 dark:bg-background-dark">
                      <span className="text-xs font-semibold text-muted-foreground">{currency}</span>
                      <Input type="number" step="0.01" min="0" className="border-0 bg-transparent p-0 focus-visible:ring-0" {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>{copy.amountHint}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.methodLabel}</FormLabel>
                  <FormControl>
                    {loadingProviders ? (
                      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{copy.loadingProviders}</span>
                      </div>
                    ) : activeProviders.length === 0 ? (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
                        <span className="text-sm text-destructive">{copy.noProvidersConfigured}</span>
                      </div>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeProviders.map((provider) => (
                            <SelectItem key={provider.provider} value={provider.provider}>
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormControl>
                  <FormDescription className="text-xs">
                    {activeProviders.length > 0
                      ? 'Payment will be processed using the configured admin account'
                      : ''}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paidAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.paidAtLabel}</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{copy.notesLabel}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder={copy.notesPlaceholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
                {copy.cancelLabel}
              </Button>
              <Button type="submit" className="rounded-full" disabled={isSubmitting}>
                {isSubmitting ? `${copy.submitLabel}…` : copy.submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
