'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface CaptchaSettingsProps {
  copy: {
    title: string;
    description: string;
    enabled: string;
    disabled: string;
    settings: {
      title: string;
      provider: string;
      siteKey: string;
      secretKey: string;
      threshold: string;
    };
  };
  toastCopy?: {
    successTitle: string;
    configSaved: string;
    errorTitle: string;
    error: string;
  };
}

interface CaptchaConfig {
  captcha_enabled: boolean;
  captcha_provider: string | null;
  captcha_threshold: number;
}

export const CaptchaSettings = ({ copy, toastCopy }: CaptchaSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CaptchaConfig>({
    captcha_enabled: false,
    captcha_provider: null,
    captcha_threshold: 0.5,
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/security/captcha');
      if (!response.ok) throw new Error('Failed to fetch config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching CAPTCHA config:', error);
      toast({
        title: toastCopy?.errorTitle ?? 'Error',
        description: toastCopy?.error ?? 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, toastCopy]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await adminApi.put('/api/admin/security/captcha', config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save config' }));
        throw new Error(error.error || error.message || 'Failed to save config');
      }

      toast({
        title: toastCopy?.successTitle ?? 'Success',
        description: toastCopy?.configSaved ?? 'Configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving CAPTCHA config:', error);
      toast({
        title: toastCopy?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (toastCopy?.error ?? 'An error occurred'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable CAPTCHA */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="captcha-enabled">
              {config.captcha_enabled ? copy.enabled : copy.disabled}
            </Label>
            <p className="text-sm text-muted-foreground">
              {config.captcha_enabled
                ? 'CAPTCHA verification is currently active'
                : 'CAPTCHA verification is currently disabled'}
            </p>
          </div>
          <Switch
            id="captcha-enabled"
            checked={config.captcha_enabled}
            onCheckedChange={(checked) =>
              setConfig({ ...config, captcha_enabled: checked })
            }
          />
        </div>

        {/* CAPTCHA Settings */}
        {config.captcha_enabled && (
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">{copy.settings.title}</h3>

            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="provider">{copy.settings.provider}</Label>
              <Select
                value={config.captcha_provider || ''}
                onValueChange={(value) =>
                  setConfig({ ...config, captcha_provider: value })
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recaptcha_v2">reCAPTCHA v2</SelectItem>
                  <SelectItem value="recaptcha_v3">reCAPTCHA v3</SelectItem>
                  <SelectItem value="hcaptcha">hCaptcha</SelectItem>
                  <SelectItem value="turnstile">Cloudflare Turnstile</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Configure API keys in environment variables (.env file)
              </p>
            </div>

            {/* Threshold (for v3) */}
            {config.captcha_provider === 'recaptcha_v3' && (
              <div className="space-y-2">
                <Label htmlFor="threshold">
                  {copy.settings.threshold} ({config.captcha_threshold})
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.captcha_threshold}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      captcha_threshold: parseFloat(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Score threshold (0.0 - 1.0). Higher values are more strict.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
};
