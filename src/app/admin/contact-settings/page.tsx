'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { useSiteBranding } from '@/contexts/site-branding-context';
import AdminGuard from '@/components/admin-guard';
import {
  DEFAULT_CONTACT_SETTINGS,
  type ContactSettings,
  type ContactSettingsResponse,
} from '@/modules/contact/domain/models/contact-settings';

interface AdminContactSettingsPageProps {
  searchParams?: Promise<{ lang?: Locale }>;
}

const formatListInput = (value: string[]) => value.join(', ');

const parseListInput = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

function AdminContactSettingsContent() {
  const searchParams = useSearchParams();
  const lang = (searchParams?.get('lang') as Locale) || 'en';
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const copy = dictionary?.admin?.contactSettings;
  const { toast } = useToast();

  const environmentFile = useMemo(() => {
    const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.toLowerCase();
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();

    if (appEnv === 'production' || nodeEnv === 'production') {
      return '.env';
    }

    return '.env.local';
  }, []);

  const applyEnvFileHint = useCallback(
    (template: string | undefined, fallback: string) => {
      const resolved = template ?? fallback;
      return resolved.replace(/\{\{\s*envFile\s*\}\}/gi, environmentFile);
    },
    [environmentFile],
  );

  const [settings, setSettings] = useState<ContactSettings>(DEFAULT_CONTACT_SETTINGS);
  const [environment, setEnvironment] = useState<ContactSettingsResponse['environment']>({
    hasEmailProvider: false,
    fromAddressConfigured: false,
    fromNameConfigured: false,
  });
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/contact-settings', { cache: 'no-store' });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || copy?.errors?.loadFailed || 'Unable to load the current configuration.';
        throw new Error(message);
      }

      const data = (await response.json()) as ContactSettingsResponse;
      setSettings(data.settings);
      setEnvironment(data.environment);
      setCcInput(formatListInput(data.settings.ccEmails));
      setBccInput(formatListInput(data.settings.bccEmails));
    } catch (error) {
      console.error('[AdminContactSettings] Failed to load settings', error);
      const message = error instanceof Error ? error.message : copy?.errors?.loadFailed ?? 'Unable to load the current configuration.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [copy?.errors?.loadFailed]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
      const { adminApi } = await import('@/lib/utils/admin-csrf-helpers');
      const response = await adminApi.put('/api/admin/contact-settings', {
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        replyToEmail: settings.replyToEmail || null,
        recipientEmailOverride: settings.recipientEmailOverride || null,
        ccEmails: parseListInput(ccInput),
        bccEmails: parseListInput(bccInput),
        subjectPrefix: settings.subjectPrefix || null,
        autoResponseEnabled: settings.autoResponseEnabled,
        autoResponseSubject: settings.autoResponseSubject || null,
        autoResponseBody: settings.autoResponseBody || null,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || copy?.errors?.saveFailed || 'We could not save the contact settings.';
        throw new Error(message);
      }

      const data = (await response.json()) as ContactSettingsResponse;
      setSettings(data.settings);
      setEnvironment(data.environment);
      setCcInput(formatListInput(data.settings.ccEmails));
      setBccInput(formatListInput(data.settings.bccEmails));

      toast({
        title: copy?.toast?.successTitle ?? 'Contact settings updated',
        description: copy?.toast?.successDescription ?? 'The configuration was saved successfully.',
      });
    } catch (error) {
      console.error('[AdminContactSettings] Failed to save settings', error);
      const message = error instanceof Error ? error.message : copy?.errors?.saveFailed ?? 'We could not save the contact settings.';
      setErrorMessage(message);
      toast({
        title: copy?.toast?.errorTitle ?? 'Update failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const providerStatusItems = useMemo(
    () => [
      {
        id: 'provider',
        label: copy?.status?.provider ?? 'Email provider',
        isReady: environment.hasEmailProvider,
        hint: applyEnvFileHint(
          copy?.status?.providerHint,
          'Add RESEND_API_KEY to your {{envFile}} file.',
        ),
      },
      {
        id: 'fromName',
        label: copy?.status?.fromName ?? 'From name',
        isReady: environment.fromNameConfigured,
        hint: applyEnvFileHint(
          copy?.status?.fromNameHint,
          'Set CONTACT_FROM_NAME in your {{envFile}} file.',
        ),
      },
      {
        id: 'fromEmail',
        label: copy?.status?.fromEmail ?? 'From email',
        isReady: environment.fromAddressConfigured,
        hint: applyEnvFileHint(
          copy?.status?.fromEmailHint,
          'Set CONTACT_FROM_EMAIL in your {{envFile}} file.',
        ),
      },
    ],
    [applyEnvFileHint, copy?.status, environment],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {copy?.title ?? 'Contact form configuration'}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {copy?.description ?? 'Control how contact requests are routed, and configure the sender identity shown in outgoing emails.'}
        </p>
      </div>

      {errorMessage && !loading ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{copy?.errors?.title ?? 'We detected an issue'}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle>{copy?.form?.title ?? 'Routing & sender details'}</CardTitle>
            <CardDescription>
              {copy?.form?.description ?? 'Define the email addresses that receive contact requests and the identity used to send them.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/20 bg-primary/5 px-4 py-6 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {copy?.loading ?? 'Loading current configuration...'}
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="from-name">{copy?.form?.fromName ?? 'From name'}</Label>
                    <Input
                      id="from-name"
                      value={settings.fromName}
                      maxLength={120}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          fromName: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from-email">{copy?.form?.fromEmail ?? 'From email'}</Label>
                    <Input
                      id="from-email"
                      type="email"
                      value={settings.fromEmail}
                      maxLength={180}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          fromEmail: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reply-to-email">{copy?.form?.replyTo ?? 'Reply-to email'}</Label>
                    <Input
                      id="reply-to-email"
                      type="email"
                      value={settings.replyToEmail ?? ''}
                      maxLength={180}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          replyToEmail: event.target.value.trim().length === 0 ? null : event.target.value,
                        }))
                      }
                      placeholder={copy?.form?.replyToPlaceholder ?? 'Leave empty to reply directly to the visitor'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient-email">{copy?.form?.recipientOverride ?? 'Recipient override'}</Label>
                    <Input
                      id="recipient-email"
                      type="email"
                      value={settings.recipientEmailOverride ?? ''}
                      maxLength={180}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          recipientEmailOverride: event.target.value.trim().length === 0 ? null : event.target.value,
                        }))
                      }
                      placeholder={copy?.form?.recipientOverridePlaceholder ?? 'Optional email address to receive all messages'}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cc-emails">{copy?.form?.cc ?? 'CC emails'}</Label>
                    <Textarea
                      id="cc-emails"
                      value={ccInput}
                      onChange={(event) => setCcInput(event.target.value)}
                      placeholder={copy?.form?.ccPlaceholder ?? 'e.g. manager@example.com, team@example.com'}
                      className="min-h-[96px]"
                    />
                    <p className="text-xs text-muted-foreground">{copy?.form?.ccHelper ?? 'Comma-separated list. Leave blank to disable.'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bcc-emails">{copy?.form?.bcc ?? 'BCC emails'}</Label>
                    <Textarea
                      id="bcc-emails"
                      value={bccInput}
                      onChange={(event) => setBccInput(event.target.value)}
                      placeholder={copy?.form?.bccPlaceholder ?? 'e.g. audit@example.com'}
                      className="min-h-[96px]"
                    />
                    <p className="text-xs text-muted-foreground">{copy?.form?.bccHelper ?? 'Comma-separated list. Recipients will not see these addresses.'}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="subject-prefix">{copy?.form?.subjectPrefix ?? 'Subject prefix'}</Label>
                    <Input
                      id="subject-prefix"
                      value={settings.subjectPrefix ?? ''}
                      maxLength={120}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          subjectPrefix: event.target.value.trim().length === 0 ? null : event.target.value,
                        }))
                      }
                      placeholder={copy?.form?.subjectPrefixPlaceholder ?? 'e.g. [PurVita Contact]'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auto-response-toggle">{copy?.autoResponse?.title ?? 'Auto-response'}</Label>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{copy?.autoResponse?.enableLabel ?? 'Send confirmation to visitor'}</p>
                        <p className="text-xs text-muted-foreground">
                          {copy?.autoResponse?.enableDescription ?? 'Automatically reply to visitors after receiving their message.'}
                        </p>
                      </div>
                      <Switch
                        id="auto-response-toggle"
                        checked={settings.autoResponseEnabled}
                        onCheckedChange={(checked) =>
                          setSettings((prev) => ({
                            ...prev,
                            autoResponseEnabled: checked,
                          }))
                        }
                        aria-label={copy?.autoResponse?.enableLabel ?? 'Send confirmation to visitor'}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-response-subject">{copy?.autoResponse?.subject ?? 'Confirmation subject'}</Label>
                  <Input
                    id="auto-response-subject"
                    value={settings.autoResponseSubject ?? ''}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        autoResponseSubject: event.target.value.trim().length === 0 ? null : event.target.value,
                      }))
                    }
                    maxLength={180}
                    placeholder={copy?.autoResponse?.subjectPlaceholder ?? 'Thank you for contacting PurVita'}
                    disabled={!settings.autoResponseEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto-response-body">{copy?.autoResponse?.body ?? 'Confirmation message'}</Label>
                  <Textarea
                    id="auto-response-body"
                    value={settings.autoResponseBody ?? ''}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        autoResponseBody: event.target.value.trim().length === 0 ? null : event.target.value,
                      }))
                    }
                    minLength={0}
                    maxLength={4000}
                    placeholder={copy?.autoResponse?.bodyPlaceholder ?? 'Thanks {{name}}! We received your message and will respond soon.'}
                    className="min-h-[140px]"
                    disabled={!settings.autoResponseEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    {copy?.autoResponse?.helper ?? 'Use {{name}} to reference the visitor name and {{email}} for their email address.'}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => void loadSettings()} disabled={saving}>
                    {copy?.form?.reset ?? 'Reset changes'}
                  </Button>
                  <Button type="submit" disabled={saving} className="flex items-center gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {saving ? copy?.form?.saving ?? 'Saving...' : copy?.form?.submit ?? 'Save changes'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>{copy?.status?.title ?? 'Email provider status'}</CardTitle>
              <CardDescription>
                {copy?.status?.description ?? 'Review the environment configuration required to send contact emails successfully.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {providerStatusItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                  <Badge variant={item.isReady ? 'default' : 'secondary'} className="shrink-0">
                    {item.isReady ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy?.status?.ready ?? 'Ready'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy?.status?.missing ?? 'Missing'}
                      </span>
                    )}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>{copy?.verification?.title ?? 'Verification checklist'}</CardTitle>
              <CardDescription>
                {copy?.verification?.description ?? 'Run the SQL helper to ensure the contact tables are present and populated.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{copy?.verification?.sql ?? 'Execute docs/database/verification-suite.sql and confirm contact_settings and contact_messages appear with the expected columns.'}</p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground/80">
                <MailCheck className="h-4 w-4" aria-hidden="true" />
                {applyEnvFileHint(
                  copy?.verification?.note,
                  'Remember to set CONTACT_FROM_EMAIL, CONTACT_FROM_NAME, and RESEND_API_KEY in both Supabase and your {{envFile}} file.',
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminContactSettingsPage(_props: AdminContactSettingsPageProps) {
  return (
    <AdminGuard lang="en" requiredPermission="manage_settings">
      <Suspense fallback={<div className="flex items-center justify-center h-32"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
        <AdminContactSettingsContent />
      </Suspense>
    </AdminGuard>
  );
}
