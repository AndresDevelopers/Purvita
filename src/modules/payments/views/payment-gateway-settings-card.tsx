'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard } from 'lucide-react';
import { PaymentTestModal } from '../components/payment-test-modal';
import type {
  PaymentGatewaySettings,
  PaymentGatewayUpdateInput,
  PaymentProvider,
} from '../domain/models/payment-gateway';
import type { SubscriptionTestInfo } from '../domain/models/subscription-test-info';

interface PaymentGatewaySettingsCardProps {
  provider: PaymentProvider;
  copy: {
    title: string;
    description: string;
    statusLabel: string;
    activeLabel: string;
    inactiveLabel: string;
    clientIdLabel?: string;
    publishableKeyLabel?: string;
    secretLabel?: string;
    webhookSecretLabel?: string;
    connectClientIdLabel?: string;
    clientIdPlaceholder?: string;
    publishableKeyPlaceholder?: string;
    secretPlaceholder?: string;
    webhookSecretPlaceholder?: string;
    connectClientIdPlaceholder?: string;
    secretStatusSet?: string;
    secretStatusUnset?: string;
    webhookStatusSet?: string;
    webhookStatusUnset?: string;
    secretHint?: string;
    webhookHint?: string;
    connectClientIdHint?: string;
    secretPreviewLabel?: string;
    webhookSecretPreviewLabel?: string;
    modeBadgeProduction: string;
    modeBadgeTest: string;
    modeHelper: string;
    saveLabel: string;
    fieldRequiredMessage: string;
    secretRequiredMessage?: string;
    publishableKeyRequiredMessage?: string;
  };
  loading?: boolean;
  isSaving?: boolean;
  initialSettings?: PaymentGatewaySettings;
  onSubmitProd: (input: PaymentGatewayUpdateInput) => Promise<void>;
  onSubmitTest: (input: PaymentGatewayUpdateInput) => Promise<void>;
  subscriptionTestInfo?: SubscriptionTestInfo;
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const PaymentGatewaySettingsCard = ({
  provider,
  copy,
  loading = false,
  isSaving = false,
  initialSettings,
  onSubmitProd,
  onSubmitTest,
  subscriptionTestInfo,
}: PaymentGatewaySettingsCardProps) => {
  const MASKED_VALUE = '********';
  const [status, setStatus] = useState<PaymentGatewaySettings['status']>('inactive');
  const [clientId, setClientId] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [secret, setSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [connectClientId, setConnectClientId] = useState('');
  const [testClientId, setTestClientId] = useState('');
  const [testPublishableKey, setTestPublishableKey] = useState('');
  const [testSecret, setTestSecret] = useState('');
  const [testWebhookSecret, setTestWebhookSecret] = useState('');
  const [testConnectClientId, setTestConnectClientId] = useState('');
  const [secretTouched, setSecretTouched] = useState(false);
  const [webhookSecretTouched, setWebhookSecretTouched] = useState(false);
  const [testSecretTouched, setTestSecretTouched] = useState(false);
  const [testWebhookSecretTouched, setTestWebhookSecretTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  useEffect(() => {
    setStatus(initialSettings?.status ?? 'inactive');
    setClientId(initialSettings?.clientId ?? '');
    setPublishableKey(initialSettings?.publishableKey ?? '');
    setSecret(initialSettings?.hasSecret ? MASKED_VALUE : '');
    setWebhookSecret(initialSettings?.hasWebhookSecret ? MASKED_VALUE : '');
    setConnectClientId(initialSettings?.connectClientId ?? '');
    setTestClientId(initialSettings?.testClientId ?? '');
    setTestPublishableKey(initialSettings?.testPublishableKey ?? '');
    setTestSecret(initialSettings?.hasTestSecret ? MASKED_VALUE : '');
    setTestWebhookSecret(initialSettings?.hasTestWebhookSecret ? MASKED_VALUE : '');
    setTestConnectClientId(initialSettings?.testConnectClientId ?? '');
    setSecretTouched(false);
    setWebhookSecretTouched(false);
    setTestSecretTouched(false);
    setTestWebhookSecretTouched(false);
    setFormError(null);
  }, [MASKED_VALUE, initialSettings]);

  const secretStatus = useMemo(() => {
    if (!copy.secretStatusSet || !copy.secretStatusUnset) {
      return null;
    }
    return initialSettings?.hasSecret ? copy.secretStatusSet : copy.secretStatusUnset;
  }, [copy.secretStatusSet, copy.secretStatusUnset, initialSettings?.hasSecret]);

  const webhookSecretStatus = useMemo(() => {
    if (!copy.webhookStatusSet || !copy.webhookStatusUnset) {
      return null;
    }
    return initialSettings?.hasWebhookSecret ? copy.webhookStatusSet : copy.webhookStatusUnset;
  }, [copy.webhookStatusSet, copy.webhookStatusUnset, initialSettings?.hasWebhookSecret]);

  const hasStoredSecret = Boolean(initialSettings?.hasSecret);
  const hasStoredWebhook = Boolean(initialSettings?.hasWebhookSecret);

  const testSecretStatus = useMemo(() => {
    if (!copy.secretStatusSet || !copy.secretStatusUnset) {
      return null;
    }
    return initialSettings?.hasTestSecret ? copy.secretStatusSet : copy.secretStatusUnset;
  }, [copy.secretStatusSet, copy.secretStatusUnset, initialSettings?.hasTestSecret]);

  const testWebhookSecretStatus = useMemo(() => {
    if (!copy.webhookStatusSet || !copy.webhookStatusUnset) {
      return null;
    }
    return initialSettings?.hasTestWebhookSecret ? copy.webhookStatusSet : copy.webhookStatusUnset;
  }, [copy.webhookStatusSet, copy.webhookStatusUnset, initialSettings?.hasTestWebhookSecret]);

  const hasStoredTestSecret = Boolean(initialSettings?.hasTestSecret);
  const hasStoredTestWebhook = Boolean(initialSettings?.hasTestWebhookSecret);

  const isStripe = provider === 'stripe';
  const currentMode = initialSettings?.mode ?? 'production';
  const modeBadge = currentMode === 'test' ? copy.modeBadgeTest : copy.modeBadgeProduction;
  const normalizeSecretInput = (value: string) => (value === MASKED_VALUE ? '' : value);

  const handleSubmitProd = async () => {
    setFormError(null);

    const trimmedClientId = clientId.trim();
    const trimmedPublishableKey = publishableKey.trim();
    const trimmedSecret = normalizeSecretInput(secret).trim();
    const trimmedWebhook = normalizeSecretInput(webhookSecret).trim();
    const trimmedConnectClientId = connectClientId.trim();
    const shouldClearSecret = secretTouched && !trimmedSecret;
    const shouldClearWebhook = webhookSecretTouched && !trimmedWebhook;

    if (status === 'active') {
      if (provider === 'paypal' && !trimmedClientId) {
        setFormError(copy.fieldRequiredMessage);
        return;
      }
      if (isStripe && !trimmedPublishableKey) {
        setFormError(copy.publishableKeyRequiredMessage ?? copy.fieldRequiredMessage);
        return;
      }
      if (!initialSettings?.hasSecret && !trimmedSecret) {
        setFormError(copy.secretRequiredMessage ?? copy.fieldRequiredMessage);
        return;
      }
    }

    const payload: PaymentGatewayUpdateInput = {
      provider,
      status,
      mode: 'production',
      clientId: trimmedClientId || null,
      publishableKey: trimmedPublishableKey || null,
      secret: trimmedSecret ? trimmedSecret : shouldClearSecret ? null : undefined,
      webhookSecret: trimmedWebhook ? trimmedWebhook : shouldClearWebhook ? null : undefined,
      connectClientId: trimmedConnectClientId || null,
    };

    try {
      await onSubmitProd(payload);
      if (trimmedSecret) {
        setSecret(MASKED_VALUE);
        setSecretTouched(false);
      } else if (shouldClearSecret) {
        setSecret('');
        setSecretTouched(false);
      }
      if (trimmedWebhook) {
        setWebhookSecret(MASKED_VALUE);
        setWebhookSecretTouched(false);
      } else if (shouldClearWebhook) {
        setWebhookSecret('');
        setWebhookSecretTouched(false);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : copy.fieldRequiredMessage);
    }
  };

  const handleSubmitTest = async () => {
    setFormError(null);

    const trimmedTestClientId = testClientId.trim();
    const trimmedTestPublishableKey = testPublishableKey.trim();
    const trimmedTestSecret = normalizeSecretInput(testSecret).trim();
    const trimmedTestWebhook = normalizeSecretInput(testWebhookSecret).trim();
    const trimmedTestConnectClientId = testConnectClientId.trim();
    const shouldClearTestSecret = testSecretTouched && !trimmedTestSecret;
    const shouldClearTestWebhook = testWebhookSecretTouched && !trimmedTestWebhook;

    // Para test, no requerir que este activo, pero si hay campos, guardarlos.

    const payload: PaymentGatewayUpdateInput = {
      provider,
      status,
      mode: 'test',
      testClientId: trimmedTestClientId || null,
      testPublishableKey: trimmedTestPublishableKey || null,
      testSecret: trimmedTestSecret ? trimmedTestSecret : shouldClearTestSecret ? null : undefined,
      testWebhookSecret: trimmedTestWebhook
        ? trimmedTestWebhook
        : shouldClearTestWebhook
          ? null
          : undefined,
      testConnectClientId: trimmedTestConnectClientId || null,
    };

    try {
      await onSubmitTest(payload);
      if (trimmedTestSecret) {
        setTestSecret(MASKED_VALUE);
        setTestSecretTouched(false);
      } else if (shouldClearTestSecret) {
        setTestSecret('');
        setTestSecretTouched(false);
      }
      if (trimmedTestWebhook) {
        setTestWebhookSecret(MASKED_VALUE);
        setTestWebhookSecretTouched(false);
      } else if (shouldClearTestWebhook) {
        setTestWebhookSecret('');
        setTestWebhookSecretTouched(false);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : copy.fieldRequiredMessage);
    }
  };

  const statusLabel = status === 'active' ? copy.activeLabel : copy.inactiveLabel;
  const lastUpdatedLabel = formatDate(initialSettings?.updatedAt);

  return (
    <Card className="border-border-light dark:border-border-dark">
      <div className="flex flex-col h-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="hidden sm:inline-flex">
                {modeBadge}
              </Badge>
              <span className="text-sm text-muted-foreground hidden sm:inline">{copy.statusLabel}</span>
              <Switch
                aria-label={copy.statusLabel}
                checked={status === 'active'}
                onCheckedChange={(checked) => setStatus(checked ? 'active' : 'inactive')}
                disabled={loading || isSaving}
              />
            </div>
          </div>
          <Badge variant={status === 'active' ? 'default' : 'secondary'}>{statusLabel}</Badge>
          <p className="text-xs text-muted-foreground sm:hidden">{modeBadge}</p>
          <p className="text-xs text-muted-foreground">{copy.modeHelper}</p>
          {lastUpdatedLabel && (
            <span className="text-xs text-muted-foreground">{lastUpdatedLabel}</span>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          <Tabs defaultValue="prod" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prod">Producción</TabsTrigger>
              <TabsTrigger value="test">Test</TabsTrigger>
            </TabsList>
            <TabsContent value="prod" className="space-y-4 mt-4">
              {copy.clientIdLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-client-id`}>{copy.clientIdLabel}</Label>
                  <Input
                    id={`${provider}-client-id`}
                    placeholder={copy.clientIdPlaceholder}
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    disabled={loading || isSaving}
                    inputMode="text"
                    autoComplete="off"
                  />
                </div>
              )}
              {copy.publishableKeyLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-publishable-key`}>{copy.publishableKeyLabel}</Label>
                  <Input
                    id={`${provider}-publishable-key`}
                    placeholder={copy.publishableKeyPlaceholder}
                    value={publishableKey}
                    onChange={(event) => setPublishableKey(event.target.value)}
                    disabled={loading || isSaving}
                    inputMode="text"
                    autoComplete="off"
                  />
                </div>
              )}
              {copy.secretLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-secret`}>{copy.secretLabel}</Label>
                  <Input
                    id={`${provider}-secret`}
                    type={secret === MASKED_VALUE ? 'text' : 'password'}
                    placeholder={copy.secretPlaceholder}
                    value={secret}
                    onChange={(event) => {
                      setSecretTouched(true);
                      setSecret(event.target.value);
                    }}
                    onFocus={(event) => {
                      if (secret === MASKED_VALUE) {
                        event.currentTarget.select();
                      }
                    }}
                    disabled={loading || isSaving}
                    autoComplete="off"
                  />
                  {hasStoredSecret && copy.secretPreviewLabel && (
                    <p className="text-xs text-muted-foreground">{copy.secretPreviewLabel}</p>
                  )}
                  {secretStatus && (
                    <p className="text-xs text-muted-foreground">{secretStatus}</p>
                  )}
                  {copy.secretHint && (
                    <p className="text-xs text-muted-foreground">{copy.secretHint}</p>
                  )}
                </div>
              )}
              {copy.webhookSecretLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-webhook-secret`}>{copy.webhookSecretLabel}</Label>
                  <Input
                    id={`${provider}-webhook-secret`}
                    type={webhookSecret === MASKED_VALUE ? 'text' : 'password'}
                    placeholder={copy.webhookSecretPlaceholder}
                    value={webhookSecret}
                    onChange={(event) => {
                      setWebhookSecretTouched(true);
                      setWebhookSecret(event.target.value);
                    }}
                    onFocus={(event) => {
                      if (webhookSecret === MASKED_VALUE) {
                        event.currentTarget.select();
                      }
                    }}
                    disabled={loading || isSaving}
                    autoComplete="off"
                  />
                  {hasStoredWebhook && copy.webhookSecretPreviewLabel && (
                    <p className="text-xs text-muted-foreground">{copy.webhookSecretPreviewLabel}</p>
                  )}
                  {webhookSecretStatus && (
                    <p className="text-xs text-muted-foreground">{webhookSecretStatus}</p>
                  )}
                  {copy.webhookHint && (
                    <p className="text-xs text-muted-foreground">{copy.webhookHint}</p>
                  )}
                </div>
              )}
              {copy.connectClientIdLabel && isStripe && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-connect-client-id`}>{copy.connectClientIdLabel}</Label>
                  <Input
                    id={`${provider}-connect-client-id`}
                    placeholder={copy.connectClientIdPlaceholder}
                    value={connectClientId}
                    onChange={(event) => setConnectClientId(event.target.value)}
                    disabled={loading || isSaving}
                    inputMode="text"
                    autoComplete="off"
                  />
                  {copy.connectClientIdHint && (
                    <p className="text-xs text-muted-foreground">{copy.connectClientIdHint}</p>
                  )}
                </div>
              )}
              <Button onClick={handleSubmitProd} className="w-full" disabled={loading || isSaving}>
                {isSaving ? `${copy.saveLabel}…` : copy.saveLabel}
              </Button>
            </TabsContent>
            <TabsContent value="test" className="space-y-4 mt-4">
              {copy.clientIdLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-test-client-id`}>{copy.clientIdLabel} (Test)</Label>
                  <Input
                    id={`${provider}-test-client-id`}
                    placeholder={copy.clientIdPlaceholder}
                    value={testClientId}
                    onChange={(event) => setTestClientId(event.target.value)}
                    disabled={loading || isSaving}
                    inputMode="text"
                    autoComplete="off"
                  />
                </div>
              )}
              {copy.publishableKeyLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-test-publishable-key`}>{copy.publishableKeyLabel} (Test)</Label>
                  <Input
                    id={`${provider}-test-publishable-key`}
                    placeholder={copy.publishableKeyPlaceholder}
                    value={testPublishableKey}
                    onChange={(event) => setTestPublishableKey(event.target.value)}
                    disabled={loading || isSaving}
                    inputMode="text"
                    autoComplete="off"
                  />
                </div>
              )}
              {copy.secretLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-test-secret`}>{copy.secretLabel} (Test)</Label>
                  <Input
                    id={`${provider}-test-secret`}
                    type={testSecret === MASKED_VALUE ? 'text' : 'password'}
                    placeholder={copy.secretPlaceholder}
                    value={testSecret}
                    onChange={(event) => {
                      setTestSecretTouched(true);
                      setTestSecret(event.target.value);
                    }}
                    onFocus={(event) => {
                      if (testSecret === MASKED_VALUE) {
                        event.currentTarget.select();
                      }
                    }}
                    disabled={loading || isSaving}
                    autoComplete="off"
                  />
                  {hasStoredTestSecret && copy.secretPreviewLabel && (
                    <p className="text-xs text-muted-foreground">{copy.secretPreviewLabel} (Test)</p>
                  )}
                  {testSecretStatus && (
                    <p className="text-xs text-muted-foreground">{testSecretStatus}</p>
                  )}
                  {copy.secretHint && (
                    <p className="text-xs text-muted-foreground">{copy.secretHint}</p>
                  )}
                </div>
              )}
              {copy.webhookSecretLabel && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-test-webhook-secret`}>{copy.webhookSecretLabel} (Test)</Label>
                  <Input
                    id={`${provider}-test-webhook-secret`}
                    type={testWebhookSecret === MASKED_VALUE ? 'text' : 'password'}
                    placeholder={copy.webhookSecretPlaceholder}
                    value={testWebhookSecret}
                    onChange={(event) => {
                      setTestWebhookSecretTouched(true);
                      setTestWebhookSecret(event.target.value);
                    }}
                    onFocus={(event) => {
                      if (testWebhookSecret === MASKED_VALUE) {
                        event.currentTarget.select();
                      }
                    }}
                    disabled={loading || isSaving}
                    autoComplete="off"
                  />
                  {hasStoredTestWebhook && copy.webhookSecretPreviewLabel && (
                    <p className="text-xs text-muted-foreground">{copy.webhookSecretPreviewLabel} (Test)</p>
                  )}
                  {testWebhookSecretStatus && (
                    <p className="text-xs text-muted-foreground">{testWebhookSecretStatus}</p>
                  )}
                  {copy.webhookHint && (
                    <p className="text-xs text-muted-foreground">{copy.webhookHint}</p>
                  )}
                </div>
              )}
              {copy.connectClientIdLabel && isStripe && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-test-connect-client-id`}>{copy.connectClientIdLabel} (Test)</Label>
                  <Input
                    id={`${provider}-test-connect-client-id`}
                    placeholder={copy.connectClientIdPlaceholder}
                    value={testConnectClientId}
                    onChange={(event) => setTestConnectClientId(event.target.value)}
                    disabled={loading || isSaving}
                    inputMode="text"
                    autoComplete="off"
                  />
                  {copy.connectClientIdHint && (
                    <p className="text-xs text-muted-foreground">{copy.connectClientIdHint}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSubmitTest} className="flex-1" disabled={loading || isSaving}>
                  {isSaving ? `${copy.saveLabel}…` : copy.saveLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsTestModalOpen(true)}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Ver Tarjetas de Prueba
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        {isTestModalOpen && (
          <PaymentTestModal
            provider={provider}
            isOpen={isTestModalOpen}
            onClose={() => setIsTestModalOpen(false)}
            subscriptionTestInfo={subscriptionTestInfo}
          />
        )}
        {formError && (
          <div className="px-6 pb-6">
            <p className="text-sm text-destructive">{formError}</p>
          </div>
        )}
      </div>
    </Card>
  );
};
