'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface ThreatIntelConfig {
  abuse_ch_enabled: boolean;
  abuse_ch_urlhaus_enabled: boolean;
  abuse_ch_threatfox_enabled: boolean;
  abuse_ch_cache_ttl: number;
  abuse_ch_log_threats: boolean;
  virustotal_enabled: boolean;
  virustotal_api_key_configured: boolean;
  virustotal_cache_ttl: number;
  virustotal_threshold: number;
  google_safe_browsing_enabled: boolean;
  google_safe_browsing_api_key_configured: boolean;
  google_safe_browsing_cache_ttl: number;
  threat_detection_strategy: string;
}

interface ThreatIntelligenceSettingsProps {
  copy: any;
  toastCopy?: any;
}

export const ThreatIntelligenceSettings = ({ copy, toastCopy }: ThreatIntelligenceSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ThreatIntelConfig>({
    abuse_ch_enabled: false,
    abuse_ch_urlhaus_enabled: false,
    abuse_ch_threatfox_enabled: false,
    abuse_ch_cache_ttl: 3600,
    abuse_ch_log_threats: true,
    virustotal_enabled: false,
    virustotal_api_key_configured: false,
    virustotal_cache_ttl: 7200,
    virustotal_threshold: 2,
    google_safe_browsing_enabled: false,
    google_safe_browsing_api_key_configured: false,
    google_safe_browsing_cache_ttl: 1800,
    threat_detection_strategy: 'any',
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/security/threat-intelligence');
      if (!response.ok) throw new Error('Failed to fetch config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching threat intelligence config:', error);
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

      // Excluir campos de solo lectura (API key status) antes de enviar al backend
      const { virustotal_api_key_configured: _virustotal_api_key_configured, google_safe_browsing_api_key_configured: _google_safe_browsing_api_key_configured, ...configToSave } = config;

      const response = await adminApi.put('/api/admin/security/threat-intelligence', configToSave);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save config' }));
        throw new Error(error.error || error.message || 'Failed to save config');
      }

      toast({
        title: toastCopy?.successTitle ?? 'Success',
        description: toastCopy?.configSaved ?? 'Configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving threat intelligence config:', error);
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
        <CardTitle>{copy.title ?? 'Threat Intelligence'}</CardTitle>
        <CardDescription>{copy.description ?? 'Configure external threat detection services'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Abuse.ch Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{copy.abuseChSection?.title ?? 'Abuse.ch Integration'}</h3>
            <p className="text-sm text-muted-foreground">
              {copy.abuseChSection?.description ?? 'URLhaus and ThreatFox for malicious URL and IP detection'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="abuse-ch-enabled">{copy.abuseChSection?.enabled ?? 'Enabled'}</Label>
            <Switch
              id="abuse-ch-enabled"
              checked={config.abuse_ch_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, abuse_ch_enabled: checked })
              }
            />
          </div>

          {config.abuse_ch_enabled && (
            <div className="space-y-4 pl-4 border-l-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="urlhaus">{copy.abuseChSection?.urlhausEnabled ?? 'URLhaus Enabled'}</Label>
                <Switch
                  id="urlhaus"
                  checked={config.abuse_ch_urlhaus_enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, abuse_ch_urlhaus_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="threatfox">{copy.abuseChSection?.threatfoxEnabled ?? 'ThreatFox Enabled'}</Label>
                <Switch
                  id="threatfox"
                  checked={config.abuse_ch_threatfox_enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, abuse_ch_threatfox_enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abuse-cache">{copy.abuseChSection?.cacheTtl ?? 'Cache TTL (seconds)'}</Label>
                <Input
                  id="abuse-cache"
                  type="number"
                  min="60"
                  value={config.abuse_ch_cache_ttl}
                  onChange={(e) =>
                    setConfig({ ...config, abuse_ch_cache_ttl: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="log-threats">{copy.abuseChSection?.logThreats ?? 'Log Detected Threats'}</Label>
                <Switch
                  id="log-threats"
                  checked={config.abuse_ch_log_threats}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, abuse_ch_log_threats: checked })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* VirusTotal Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{copy.virusTotalSection?.title ?? 'VirusTotal Integration'}</h3>
            <p className="text-sm text-muted-foreground">
              {copy.virusTotalSection?.description ?? 'Advanced threat detection using VirusTotal API'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="vt-enabled">{copy.virusTotalSection?.enabled ?? 'Enabled'}</Label>
            <Switch
              id="vt-enabled"
              checked={config.virustotal_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, virustotal_enabled: checked })
              }
            />
          </div>

          {config.virustotal_enabled && (
            <div className="space-y-4 pl-4 border-l-2">
              <div className="space-y-2">
                <Label>{copy.virusTotalSection?.apiKeyStatus ?? 'API Key Status'}</Label>
                <div className={`p-3 rounded-md border ${config.virustotal_api_key_configured ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'}`}>
                  <p className={`text-sm ${config.virustotal_api_key_configured ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                    {config.virustotal_api_key_configured
                      ? (copy.virusTotalSection?.apiKeyConfigured ?? '✓ API Key configured in environment variables')
                      : (copy.virusTotalSection?.apiKeyNotConfigured ?? '⚠ API Key not configured. Set VIRUSTOTAL_API_KEY in your environment variables.')
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vt-cache">{copy.virusTotalSection?.cacheTtl ?? 'Cache TTL (seconds)'}</Label>
                <Input
                  id="vt-cache"
                  type="number"
                  min="60"
                  value={config.virustotal_cache_ttl}
                  onChange={(e) =>
                    setConfig({ ...config, virustotal_cache_ttl: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {copy.virusTotalSection?.cacheTtlHint ?? 'Recommended: 3600-14400 (1-4 hours)'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vt-threshold">{copy.virusTotalSection?.threshold ?? 'Detection Threshold'}</Label>
                <Input
                  id="vt-threshold"
                  type="number"
                  min="1"
                  max="10"
                  value={config.virustotal_threshold}
                  onChange={(e) =>
                    setConfig({ ...config, virustotal_threshold: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {copy.virusTotalSection?.thresholdHint ?? 'Minimum antivirus engines to detect threat (1-10). Lower = stricter'}
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Google Safe Browsing Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{copy.googleSafeBrowsingSection?.title ?? 'Google Safe Browsing'}</h3>
            <p className="text-sm text-muted-foreground">
              {copy.googleSafeBrowsingSection?.description ?? 'Google Safe Browsing API for malware and phishing detection'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="gsb-enabled">{copy.googleSafeBrowsingSection?.enabled ?? 'Enabled'}</Label>
            <Switch
              id="gsb-enabled"
              checked={config.google_safe_browsing_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, google_safe_browsing_enabled: checked })
              }
            />
          </div>

          {config.google_safe_browsing_enabled && (
            <div className="space-y-4 pl-4 border-l-2">
              <div className="space-y-2">
                <Label>{copy.googleSafeBrowsingSection?.apiKeyStatus ?? 'API Key Status'}</Label>
                <div className={`p-3 rounded-md border ${config.google_safe_browsing_api_key_configured ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'}`}>
                  <p className={`text-sm ${config.google_safe_browsing_api_key_configured ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                    {config.google_safe_browsing_api_key_configured
                      ? (copy.googleSafeBrowsingSection?.apiKeyConfigured ?? '✓ API Key configured in environment variables')
                      : (copy.googleSafeBrowsingSection?.apiKeyNotConfigured ?? '⚠ API Key not configured. Set GOOGLE_SAFE_BROWSING_API_KEY in your environment variables.')
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gsb-cache">{copy.googleSafeBrowsingSection?.cacheTtl ?? 'Cache TTL (seconds)'}</Label>
                <Input
                  id="gsb-cache"
                  type="number"
                  min="60"
                  value={config.google_safe_browsing_cache_ttl}
                  onChange={(e) =>
                    setConfig({ ...config, google_safe_browsing_cache_ttl: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {copy.googleSafeBrowsingSection?.cacheTtlHint ?? 'Recommended: 900-3600 (15 min - 1 hour)'}
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Detection Strategy */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{copy.strategySection?.title ?? 'Detection Strategy'}</h3>
            <p className="text-sm text-muted-foreground">
              {copy.strategySection?.description ?? 'How to combine results from multiple threat intelligence services'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategy">{copy.strategySection?.strategy ?? 'Strategy'}</Label>
            <Select
              value={config.threat_detection_strategy}
              onValueChange={(value) =>
                setConfig({ ...config, threat_detection_strategy: value })
              }
            >
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">
                  {copy.strategySection?.strategies?.any ?? 'Any (Flag if any service detects threat)'}
                </SelectItem>
                <SelectItem value="majority">
                  {copy.strategySection?.strategies?.majority ?? 'Majority (Flag if majority detects threat)'}
                </SelectItem>
                <SelectItem value="all">
                  {copy.strategySection?.strategies?.all ?? 'All (Flag only if all services detect threat)'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? (copy.saving ?? 'Saving...') : (copy.save ?? 'Save Configuration')}
        </Button>
      </CardContent>
    </Card>
  );
};
