'use client';

import { use, useEffect, useState, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import type { AdvertisingScripts, AdvertisingScriptsUpdateInput } from '@/modules/advertising/domain/models/advertising-scripts';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface AdminAdvertisingScriptsPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

export const dynamic = 'force-dynamic';

export default function AdminAdvertisingScriptsPage({ searchParams }: AdminAdvertisingScriptsPageProps) {
  const params = use(searchParams);
  const lang = params.lang || 'en';
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const copy = dictionary?.admin?.advertisingScripts ?? {} as any;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_config, setConfig] = useState<AdvertisingScripts | null>(null);

  // Form state
  const [facebookPixelEnabled, setFacebookPixelEnabled] = useState(false);
  const [facebookPixelId, setFacebookPixelId] = useState('');
  const [facebookPixelScript, setFacebookPixelScript] = useState('');

  const [tiktokPixelEnabled, setTiktokPixelEnabled] = useState(false);
  const [tiktokPixelId, setTiktokPixelId] = useState('');
  const [tiktokPixelScript, setTiktokPixelScript] = useState('');

  const [gtmEnabled, setGtmEnabled] = useState(false);
  const [gtmContainerId, setGtmContainerId] = useState('');
  const [gtmScript, setGtmScript] = useState('');

  

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const response = await adminApi.get('/api/admin/advertising-scripts');
      if (!response.ok) throw new Error('Failed to load configuration');

      const data: AdvertisingScripts = await response.json();
      setConfig(data);

      // Populate form
      setFacebookPixelEnabled(data.facebookPixelEnabled);
      setFacebookPixelId(data.facebookPixelId || '');
      setFacebookPixelScript(data.facebookPixelScript || '');

      setTiktokPixelEnabled(data.tiktokPixelEnabled);
      setTiktokPixelId(data.tiktokPixelId || '');
      setTiktokPixelScript(data.tiktokPixelScript || '');

      setGtmEnabled(data.gtmEnabled);
      setGtmContainerId(data.gtmContainerId || '');
      setGtmScript(data.gtmScript || '');
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast({
        title: copy?.errorLoading ?? 'Error',
        description: copy?.errorLoadingDescription ?? 'Failed to load advertising scripts configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [copy?.errorLoading, copy?.errorLoadingDescription, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);

      const updateData: AdvertisingScriptsUpdateInput = {
        facebookPixelEnabled,
        facebookPixelId: facebookPixelId.trim() || null,
        facebookPixelScript: facebookPixelScript.trim() || null,
        tiktokPixelEnabled,
        tiktokPixelId: tiktokPixelId.trim() || null,
        tiktokPixelScript: tiktokPixelScript.trim() || null,
        gtmEnabled,
        gtmContainerId: gtmContainerId.trim() || null,
        gtmScript: gtmScript.trim() || null,
      };

      // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
      const response = await adminApi.put('/api/admin/advertising-scripts', updateData);

      if (!response.ok) throw new Error('Failed to save configuration');

      const updated: AdvertisingScripts = await response.json();
      setConfig(updated);

      toast({
        title: copy?.successTitle ?? 'Success',
        description: copy?.successDescription ?? 'Advertising scripts configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: copy?.errorSaving ?? 'Error',
        description: copy?.errorSavingDescription ?? 'Failed to save advertising scripts configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-headline text-3xl sm:text-4xl">
          {copy?.pageTitle ?? 'Advertising Scripts'}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          {copy?.pageDescription ?? 'Configure Facebook Pixel, TikTok Pixel, and Google Tag Manager scripts. These scripts will only be injected in the main public pages, NOT in affiliate personalized pages.'}
        </p>
      </div>

      {/* Facebook Pixel */}
      <Card>
        <CardHeader>
          <CardTitle>{copy?.facebookPixel?.title ?? 'Facebook Pixel'}</CardTitle>
          <CardDescription>
            {copy?.facebookPixel?.description ?? 'Configure Facebook Pixel for tracking conversions and events on your main website.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="facebook-enabled">
              {copy?.facebookPixel?.enableLabel ?? 'Enable Facebook Pixel'}
            </Label>
            <Switch
              id="facebook-enabled"
              checked={facebookPixelEnabled}
              onCheckedChange={setFacebookPixelEnabled}
            />
          </div>

          {facebookPixelEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="facebook-id">
                  {copy?.facebookPixel?.idLabel ?? 'Pixel ID'}
                </Label>
                <Input
                  id="facebook-id"
                  placeholder="1234567890"
                  value={facebookPixelId}
                  onChange={(e) => setFacebookPixelId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebook-script">
                  {copy?.facebookPixel?.scriptLabel ?? 'Complete Script Code'}
                </Label>
                <Textarea
                  id="facebook-script"
                  placeholder="<!-- Facebook Pixel Code -->&#10;<script>...</script>"
                  value={facebookPixelScript}
                  onChange={(e) => setFacebookPixelScript(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {copy?.facebookPixel?.scriptHelper ?? 'Paste the complete Facebook Pixel code provided by Facebook.'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* TikTok Pixel */}
      <Card>
        <CardHeader>
          <CardTitle>{copy?.tiktokPixel?.title ?? 'TikTok Pixel'}</CardTitle>
          <CardDescription>
            {copy?.tiktokPixel?.description ?? 'Configure TikTok Pixel for tracking conversions and events on your main website.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="tiktok-enabled">
              {copy?.tiktokPixel?.enableLabel ?? 'Enable TikTok Pixel'}
            </Label>
            <Switch
              id="tiktok-enabled"
              checked={tiktokPixelEnabled}
              onCheckedChange={setTiktokPixelEnabled}
            />
          </div>

          {tiktokPixelEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tiktok-id">
                  {copy?.tiktokPixel?.idLabel ?? 'Pixel ID'}
                </Label>
                <Input
                  id="tiktok-id"
                  placeholder="ABCDEFGHIJK"
                  value={tiktokPixelId}
                  onChange={(e) => setTiktokPixelId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tiktok-script">
                  {copy?.tiktokPixel?.scriptLabel ?? 'Complete Script Code'}
                </Label>
                <Textarea
                  id="tiktok-script"
                  placeholder="<!-- TikTok Pixel Code -->&#10;<script>...</script>"
                  value={tiktokPixelScript}
                  onChange={(e) => setTiktokPixelScript(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {copy?.tiktokPixel?.scriptHelper ?? 'Paste the complete TikTok Pixel code provided by TikTok.'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Tag Manager */}
      <Card>
        <CardHeader>
          <CardTitle>{copy?.gtm?.title ?? 'Google Tag Manager'}</CardTitle>
          <CardDescription>
            {copy?.gtm?.description ?? 'Configure Google Tag Manager for managing all your tracking tags in one place.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="gtm-enabled">
              {copy?.gtm?.enableLabel ?? 'Enable Google Tag Manager'}
            </Label>
            <Switch
              id="gtm-enabled"
              checked={gtmEnabled}
              onCheckedChange={setGtmEnabled}
            />
          </div>

          {gtmEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="gtm-id">
                  {copy?.gtm?.containerIdLabel ?? 'Container ID'}
                </Label>
                <Input
                  id="gtm-id"
                  placeholder="GTM-XXXXXX"
                  value={gtmContainerId}
                  onChange={(e) => setGtmContainerId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gtm-script">
                  {copy?.gtm?.scriptLabel ?? 'Complete Script Code'}
                </Label>
                <Textarea
                  id="gtm-script"
                  placeholder="<!-- Google Tag Manager -->&#10;<script>...</script>"
                  value={gtmScript}
                  onChange={(e) => setGtmScript(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {copy?.gtm?.scriptHelper ?? 'Paste the complete Google Tag Manager code provided by Google.'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {copy?.saveButton ?? 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
