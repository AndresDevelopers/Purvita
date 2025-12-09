'use client';

import { useEffect, useMemo, useState, useId, useCallback } from 'react';
import type { Stripe } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Plus, Trash2, Check } from 'lucide-react';
import type { PaymentMethod } from '@/modules/payment-methods/domain/types';
import { usePaymentProviders } from '@/modules/payments/hooks/use-payment-gateways';
import { useMediaQuery } from '@/hooks/use-media-query';

const stripePromiseCache: Record<string, Promise<Stripe | null>> = {};

const getStripePromise = (publishableKey: string): Promise<Stripe | null> | null => {
  const normalizedKey = publishableKey.trim();
  if (!normalizedKey) {
    return null;
  }

  if (!stripePromiseCache[normalizedKey]) {
    stripePromiseCache[normalizedKey] = loadStripe(normalizedKey);
  }

  return stripePromiseCache[normalizedKey];
};

function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const { toast } = useToast();
  const defaultSwitchId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      const setupResponse = await fetch('/api/payment-methods/setup-intent', {
        method: 'POST',
      });

      if (!setupResponse.ok) {
        throw new Error('Failed to create setup intent');
      }

      const { clientSecret } = await setupResponse.json();
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const saveResponse = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: setupIntent.payment_method,
          setAsDefault,
        }),
      });

      if (!saveResponse.ok) {
        const data = await saveResponse.json();
        throw new Error(data.error || 'Failed to save payment method');
      }

      toast({
        title: 'Success',
        description: 'Card added successfully',
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to add card:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add card',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      {!stripe && (
        <p className="text-xs text-muted-foreground">
          Loading secure card fields…
        </p>
      )}

      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor={defaultSwitchId} className="text-sm font-medium">
              Set as default payment method
            </Label>
            <p className="text-xs text-muted-foreground">
              Use this card automatically for future subscription payments.
            </p>
          </div>
          <Switch
            id={defaultSwitchId}
            checked={setAsDefault}
            onCheckedChange={(checked) => setSetAsDefault(checked)}
            aria-label="Toggle default payment method"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!stripe || loading} className="min-w-[140px]">
          {loading ? 'Saving…' : 'Save Card'}
        </Button>
      </div>
    </form>
  );
}

export function SavedPaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const { providers, isLoading: providersLoading, error: providersError } = usePaymentProviders();
  const stripeProvider = useMemo(() => providers.find((provider) => provider.provider === 'stripe'), [providers]);
  const stripePromise = useMemo(() => {
    const key = stripeProvider?.publishableKey ?? null;
    return key ? getStripePromise(key) : null;
  }, [stripeProvider]);
  const _stripeMode = stripeProvider?.mode ?? null;
  const stripeConfigured = Boolean(stripePromise);

  const loadPaymentMethods = useCallback(async (options: { showLoader?: boolean } = {}) => {
    if (options.showLoader) {
      setLoading(true);
    }

    try {
      const response = await fetch('/api/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to load payment methods',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payment methods',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPaymentMethods({ showLoader: true });
  }, [loadPaymentMethods]);

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update default');
      }

      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });

      loadPaymentMethods();
    } catch (error) {
      console.error('Failed to set default:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update default',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // ✅ SECURITY: Fetch CSRF token before DELETE request
      const csrfResponse = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });

      if (!csrfResponse.ok) {
        throw new Error('Failed to obtain CSRF token. Please refresh the page and try again.');
      }

      const { token: csrfToken } = await csrfResponse.json();

      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove card');
      }

      toast({
        title: 'Success',
        description: 'Card removed successfully',
      });

      loadPaymentMethods();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove card',
        variant: 'destructive',
      });
    }
  };

  const getCardIcon = (_brand: string) => {
    return <CreditCard className="h-5 w-5" />;
  };

  const hasProvidersError = Boolean(providersError);
  const showStripeWarning = !providersLoading && !stripeConfigured && !hasProvidersError;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Saved Cards</CardTitle>
            <CardDescription>Manage your payment methods</CardDescription>
            {showStripeWarning && (
              <p className="text-xs text-muted-foreground">
                Stripe configuration is incomplete. Contact your administrator to enable card payments.
              </p>
            )}
            {hasProvidersError && (
              <p className="text-xs text-destructive">{providersError}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {providersLoading ? (
              <Button size="sm" disabled>Loading...</Button>
            ) : stripeConfigured && stripePromise ? (
              isMobile ? (
                <Sheet open={formOpen} onOpenChange={setFormOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Card
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto sm:max-w-lg pb-6">
                    <SheetHeader>
                      <SheetTitle>Add New Card</SheetTitle>
                      <SheetDescription>
                        Enter your card details to save it for future payments
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-4">
                      <Elements stripe={stripePromise}>
                        <AddCardForm
                          onSuccess={() => {
                            setFormOpen(false);
                            loadPaymentMethods();
                          }}
                        />
                      </Elements>
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                <Dialog open={formOpen} onOpenChange={setFormOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Card
                    </Button>
                  </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add New Card</DialogTitle>
                      <DialogDescription>
                        Enter your card details to save it for future payments
                      </DialogDescription>
                    </DialogHeader>
                    <Elements stripe={stripePromise}>
                      <AddCardForm
                        onSuccess={() => {
                          setFormOpen(false);
                          loadPaymentMethods();
                        }}
                      />
                    </Elements>
                  </DialogContent>
                </Dialog>
              )
            ) : (
              <Button size="sm" disabled>Add Card</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentMethods.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CreditCard className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No saved cards</p>
            <p className="mt-1 text-sm">Add a card to make payments easier</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const brandLabel = (method.card_brand ?? 'card').replace(/_/g, ' ');
              const lastFour = method.card_last4 ? `**** ${method.card_last4}` : '****';

              return (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getCardIcon(method.card_brand || 'card')}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">
                          {brandLabel} {lastFour}
                        </p>
                        {method.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.card_exp_month}/{method.card_exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_default && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
