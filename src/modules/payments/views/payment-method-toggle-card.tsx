'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

export interface AvailabilitySettings {
  availableOnAffiliateCheckout: boolean;
  availableOnMlmCheckout: boolean;
  availableOnMainStore: boolean;
}

export interface PaymentMethodToggleCardProps {
  provider: 'paypal' | 'stripe' | 'wallet' | 'manual' | 'authorize_net' | 'payoneer';
  title: string;
  description: string;
  icon?: React.ReactNode;
  initialActive: boolean;
  initialFunctionality: 'payment' | 'payout' | 'both';
  initialAvailability?: AvailabilitySettings;
  loading?: boolean;
  isSaving?: boolean;
  onSave: (data: {
    active: boolean;
    functionality: 'payment' | 'payout' | 'both';
    mode: 'production' | 'test';
    availableOnAffiliateCheckout: boolean;
    availableOnMlmCheckout: boolean;
    availableOnMainStore: boolean;
  }) => Promise<void>;
  // Labels
  statusLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  functionalityLabel: string;
  saveLabel: string;
  // Functionality options
  paymentLabel: string;
  payoutLabel: string;
  bothLabel: string;
  // Availability labels
  availabilityLabel?: string;
  affiliateStoreLabel?: string;
  mlmStoreLabel?: string;
  mainStoreLabel?: string;
  // Optional config link
  configureLabel?: string;
  configureHref?: string;
  // Show/hide selectors
  showFunctionalitySelector?: boolean;
}

export function PaymentMethodToggleCard({
  provider,
  title,
  description,
  icon,
  initialActive,
  initialFunctionality,
  initialAvailability,
  loading = false,
  isSaving = false,
  onSave,
  statusLabel,
  activeLabel,
  inactiveLabel,
  functionalityLabel,
  saveLabel,
  paymentLabel,
  payoutLabel,
  bothLabel,
  availabilityLabel = 'Disponible en',
  affiliateStoreLabel = 'Tienda Afiliado',
  mlmStoreLabel = 'Tienda MLM',
  mainStoreLabel = 'Tienda Principal',
  configureLabel,
  configureHref,
  showFunctionalitySelector = true,
}: PaymentMethodToggleCardProps) {
  const [active, setActive] = useState(initialActive);
  const [functionality, setFunctionality] = useState<'payment' | 'payout' | 'both'>(initialFunctionality);
  const [availableOnAffiliate, setAvailableOnAffiliate] = useState(initialAvailability?.availableOnAffiliateCheckout ?? true);
  const [availableOnMlm, setAvailableOnMlm] = useState(initialAvailability?.availableOnMlmCheckout ?? true);
  const [availableOnMain, setAvailableOnMain] = useState(initialAvailability?.availableOnMainStore ?? true);
  const [hasChanges, setHasChanges] = useState(false);

  const handleActiveChange = (checked: boolean) => {
    setActive(checked);
    setHasChanges(true);
  };

  const handleFunctionalityChange = (value: 'payment' | 'payout' | 'both') => {
    setFunctionality(value);
    setHasChanges(true);
  };

  const handleAvailabilityChange = (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    checked: boolean
  ) => {
    setter(checked);
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Mode is deprecated in UI, defaulting to production. 
    // Backend handles auto-detection based on env vars.
    await onSave({
      active,
      functionality,
      mode: 'production',
      availableOnAffiliateCheckout: availableOnAffiliate,
      availableOnMlmCheckout: availableOnMlm,
      availableOnMainStore: availableOnMain,
    });
    setHasChanges(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{title}</CardTitle>
                <Badge variant={active ? 'default' : 'secondary'}>
                  {active ? activeLabel : inactiveLabel}
                </Badge>
              </div>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor={`${provider}-active`} className="text-base font-medium">
            {statusLabel}
          </Label>
          <Switch
            id={`${provider}-active`}
            checked={active}
            onCheckedChange={handleActiveChange}
            disabled={isSaving}
          />
        </div>

        {/* Functionality Selector */}
        {showFunctionalitySelector && (
          <div className="space-y-2">
            <Label htmlFor={`${provider}-functionality`} className="text-sm font-medium">
              {functionalityLabel}
            </Label>
            <Select
              value={functionality}
              onValueChange={handleFunctionalityChange}
              disabled={isSaving}
            >
              <SelectTrigger id={`${provider}-functionality`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment">{paymentLabel}</SelectItem>
                <SelectItem value="payout">{payoutLabel}</SelectItem>
                <SelectItem value="both">{bothLabel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Availability Settings */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{availabilityLabel}</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${provider}-affiliate`}
                checked={availableOnAffiliate}
                onCheckedChange={(checked) => handleAvailabilityChange(setAvailableOnAffiliate, checked === true)}
                disabled={isSaving}
              />
              <Label
                htmlFor={`${provider}-affiliate`}
                className="text-sm font-normal cursor-pointer"
              >
                {affiliateStoreLabel}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${provider}-mlm`}
                checked={availableOnMlm}
                onCheckedChange={(checked) => handleAvailabilityChange(setAvailableOnMlm, checked === true)}
                disabled={isSaving}
              />
              <Label
                htmlFor={`${provider}-mlm`}
                className="text-sm font-normal cursor-pointer"
              >
                {mlmStoreLabel}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${provider}-main`}
                checked={availableOnMain}
                onCheckedChange={(checked) => handleAvailabilityChange(setAvailableOnMain, checked === true)}
                disabled={isSaving}
              />
              <Label
                htmlFor={`${provider}-main`}
                className="text-sm font-normal cursor-pointer"
              >
                {mainStoreLabel}
              </Label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex-1"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saveLabel}
          </Button>
          {configureLabel && configureHref && (
            <Button
              variant="outline"
              onClick={() => window.location.href = configureHref}
              disabled={isSaving}
            >
              {configureLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

