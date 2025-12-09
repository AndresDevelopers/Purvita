'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, Building2 } from 'lucide-react';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface SimplePaymentMethodCardProps {
  provider: PaymentProvider;
  title: string;
  description: string;
  statusLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  saveLabel: string;
  configureLabel?: string;
  configureHref?: string;
  loading?: boolean;
  isSaving?: boolean;
  initialActive?: boolean;
  onToggle: (active: boolean) => Promise<void>;
}

export const SimplePaymentMethodCard = ({
  provider,
  title,
  description,
  statusLabel,
  activeLabel,
  inactiveLabel,
  saveLabel,
  configureLabel,
  configureHref,
  loading = false,
  isSaving = false,
  initialActive = false,
  onToggle,
}: SimplePaymentMethodCardProps) => {
  const [isActive, setIsActive] = useState(initialActive);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setIsActive(initialActive);
    setHasChanges(false);
  }, [initialActive]);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    setHasChanges(checked !== initialActive);
  };

  const handleSave = async () => {
    await onToggle(isActive);
    setHasChanges(false);
  };

  const getIcon = () => {
    switch (provider) {
      case 'wallet':
        return <Wallet className="w-6 h-6 text-primary" />;
      default:
        return <Building2 className="w-6 h-6 text-primary" />;
    }
  };

  return (
    <Card className="border-border-light dark:border-border-dark">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? activeLabel : inactiveLabel}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:inline">{statusLabel}</span>
            <Switch
              aria-label={statusLabel}
              checked={isActive}
              onCheckedChange={handleToggle}
              disabled={loading || isSaving}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {provider === 'wallet' && (
          <div className="text-sm text-muted-foreground">
            <p>
              La billetera interna permite a los usuarios mantener un saldo en su cuenta y usarlo para
              realizar pagos sin necesidad de métodos de pago externos.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={loading || isSaving || !hasChanges}
          >
            {isSaving ? `${saveLabel}…` : saveLabel}
          </Button>
          {configureLabel && configureHref && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.location.href = configureHref}
            >
              {configureLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

