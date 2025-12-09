'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface RateLimitConfig {
  // API Rate Limiting
  api_rate_limit_requests: number;
  api_rate_limit_window_ms: number;

  // Login Rate Limiting
  login_rate_limit_attempts: number;
  login_rate_limit_window_seconds: number;

  // Auto-Block Configuration
  auto_block_enabled: boolean;
  auto_block_duration_hours: number;
  auto_block_min_confidence: number;
}

interface RateLimitSettingsProps {
  copy: any;
  toastCopy: any;
}

export const RateLimitSettings = ({ copy, toastCopy }: RateLimitSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RateLimitConfig>({
    api_rate_limit_requests: 60,
    api_rate_limit_window_ms: 60000,
    login_rate_limit_attempts: 5,
    login_rate_limit_window_seconds: 60,
    auto_block_enabled: true,
    auto_block_duration_hours: 24,
    auto_block_min_confidence: 70,
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/security/rate-limit');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching rate limit config:', error);
      toast({
        title: toastCopy?.errorTitle ?? 'Error',
        description: toastCopy?.error ?? 'Failed to load configuration',
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
      const response = await adminApi.put('/api/admin/security/rate-limit', config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(error.error || error.message || 'Failed to save');
      }

      toast({
        title: toastCopy?.successTitle ?? 'Success',
        description: toastCopy?.success ?? 'Configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving rate limit config:', error);
      toast({
        title: toastCopy?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (toastCopy?.error ?? 'Failed to save configuration'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy?.title ?? 'Rate Limiting Configuration'}</CardTitle>
        <CardDescription>
          {copy?.description ?? 'Configure rate limiting and auto-blocking settings for your application'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* API Rate Limiting Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">API Rate Limiting</h3>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Controls the maximum number of API requests allowed per time window
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="api-requests">
                Max Requests per Window
              </Label>
              <Input
                id="api-requests"
                type="number"
                min="1"
                max="1000"
                value={config.api_rate_limit_requests}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    api_rate_limit_requests: parseInt(e.target.value) || 60,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Default: 60 requests. Range: 1-1000
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-window">
                Time Window (milliseconds)
              </Label>
              <Input
                id="api-window"
                type="number"
                min="1000"
                step="1000"
                value={config.api_rate_limit_window_ms}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    api_rate_limit_window_ms: parseInt(e.target.value) || 60000,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Default: 60000ms (1 minute). Minimum: 1000ms
              </p>
            </div>
          </div>
        </div>

        {/* Login Rate Limiting Section */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Login Rate Limiting</h3>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Protects against brute force attacks by limiting login attempts
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="login-attempts">
                Max Login Attempts
              </Label>
              <Input
                id="login-attempts"
                type="number"
                min="1"
                max="100"
                value={config.login_rate_limit_attempts}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    login_rate_limit_attempts: parseInt(e.target.value) || 5,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Default: 5 attempts. Range: 1-100
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-window">
                Time Window (seconds)
              </Label>
              <Input
                id="login-window"
                type="number"
                min="1"
                value={config.login_rate_limit_window_seconds}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    login_rate_limit_window_seconds: parseInt(e.target.value) || 60,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Default: 60 seconds. Minimum: 1 second
              </p>
            </div>
          </div>
        </div>

        {/* Auto-Block Section */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Auto-Block Configuration</h3>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically block malicious IPs detected by threat intelligence
          </p>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-block-enabled">
                {config.auto_block_enabled ? 'Enabled' : 'Disabled'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {config.auto_block_enabled
                  ? 'Malicious IPs will be automatically blocked'
                  : 'Auto-blocking is currently disabled'}
              </p>
            </div>
            <Switch
              id="auto-block-enabled"
              checked={config.auto_block_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, auto_block_enabled: checked })
              }
            />
          </div>

          {config.auto_block_enabled && (
            <div className="grid gap-4 md:grid-cols-2 pl-4 border-l-2">
              <div className="space-y-2">
                <Label htmlFor="block-duration">
                  Block Duration (hours)
                </Label>
                <Input
                  id="block-duration"
                  type="number"
                  min="1"
                  max="8760"
                  value={config.auto_block_duration_hours}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      auto_block_duration_hours: parseInt(e.target.value) || 24,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Default: 24 hours. Range: 1-8760 (1 year)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-confidence">
                  Minimum Confidence (%)
                </Label>
                <Input
                  id="min-confidence"
                  type="number"
                  min="0"
                  max="100"
                  value={config.auto_block_min_confidence}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      auto_block_min_confidence: parseInt(e.target.value) || 70,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Default: 70%. Only block IPs with confidence ≥ this value
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="border-t pt-6">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
