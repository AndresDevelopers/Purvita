'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';
import type { PaymentProvider } from '../domain/models/payment-gateway';
import type {
  SubscriptionTestCard,
  SubscriptionTestInfo,
} from '../domain/models/subscription-test-info';

interface PaymentTestModalProps {
  provider: PaymentProvider;
  isOpen: boolean;
  onClose: () => void;
  subscriptionTestInfo?: SubscriptionTestInfo;
}

export const PaymentTestModal = ({
  provider,
  isOpen,
  onClose,
  subscriptionTestInfo,
}: PaymentTestModalProps) => {
  const normalizedInfo = subscriptionTestInfo ?? {};
  const providerName = provider === 'paypal' ? 'PayPal' : 'Stripe';
  const cards: SubscriptionTestCard[] = provider === 'stripe' ? normalizedInfo.cards ?? [] : [];
  const paypalInstructions: string[] =
    provider === 'paypal' ? normalizedInfo.paypalInstructions ?? [] : [];
  const note = normalizedInfo.note ?? null;
  const heading = normalizedInfo.heading ?? 'Test payment information';
  const description =
    normalizedInfo.description ?? 'Review these details before processing test charges.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg w-[min(100vw-2rem,36rem)] max-h-[85vh] p-0 flex flex-col">
        <DialogHeader className="space-y-2 px-6 pt-6 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Probar Pago con {providerName}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="space-y-4 px-6 pb-4 pr-8">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {heading}
                </h3>
              </div>

              {provider === 'stripe' && cards.length > 0 && (
                <div className="space-y-3">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border border-border-light/70 dark:border-border-dark/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{card.title}</p>
                          {card.description && (
                            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="uppercase text-[10px]">
                          {providerName}
                        </Badge>
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted-foreground">{card.numberLabel}</dt>
                          <dd className="font-mono font-medium tracking-tight text-right">
                            {card.number}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted-foreground">{card.expiryLabel}</dt>
                          <dd className="font-medium text-right">{card.expiry}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted-foreground">{card.cvcLabel}</dt>
                          <dd className="font-medium text-right">{card.cvc}</dd>
                        </div>
                        {card.extra?.map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-4">
                            <dt className="text-muted-foreground">{item.label}</dt>
                            <dd className="font-medium text-right">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              )}

              {provider === 'paypal' && paypalInstructions.length > 0 && (
                <div className="rounded-lg border border-border-light/70 dark:border-border-dark/70 p-4">
                  <p className="font-semibold mb-2">Sandbox tips</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {paypalInstructions.map((instruction: string, index: number) => (
                      <li key={index} className="flex gap-2">
                        <span>•</span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {note && <p className="text-xs text-muted-foreground">{note}</p>}
            </div>
          </ScrollArea>

          <div className="flex gap-2 px-6 pb-6 pt-4 flex-shrink-0 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cerrar
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
};
