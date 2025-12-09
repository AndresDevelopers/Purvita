'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { SecurityStats } from '../hooks/use-security-stats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, Ban, Lock, FileText, Activity, Settings, Gauge, Users, Eye, BarChart3 } from 'lucide-react';
import { CaptchaSettings } from '../components/captcha-settings';
import { BlockedIPsManagement } from '../components/blocked-ips-management';
import { BlockedWordsManagement } from '../components/blocked-words-management';
import { BlockedAccountsManagement } from '../components/blocked-accounts-management';
import { RateLimitSettings } from '../components/rate-limit-settings';
import { FraudAlertsManagement } from '../components/fraud-alerts-management';
import { ThreatIntelligenceSettings } from '../components/threat-intelligence-settings';
import { TrustedAgentsManagement } from '../components/trusted-agents-management';
import { AdminActivityMonitor } from '../components/admin-activity-monitor';
import { SecurityReportsManager } from '../components/security-reports-manager';
import { useAdminSecurityDashboard } from '../hooks/use-admin-security-dashboard';

interface SecurityDashboardViewProps {
  lang: Locale;
  securityDict: any; // Full security dictionary
  stats: SecurityStats;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const SecurityDashboardView = ({
  securityDict,
  stats,
  isLoading,
}: SecurityDashboardViewProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: adminSecurityData, isLoading: isLoadingAdminData, refresh: refreshAdminData } = useAdminSecurityDashboard();

  // Extract copy from dictionary with fallbacks
  const copy = {
    title: securityDict?.title ?? 'Security Center',
    description: securityDict?.description ?? 'Comprehensive security management',
    dashboard: securityDict?.dashboard ?? {},
    captcha: securityDict?.captcha ?? {},
    blockedIps: securityDict?.blockedIps ?? {},
    blockedWords: securityDict?.blockedWords ?? {},
    blockedAccounts: securityDict?.blockedAccounts ?? {},
    fraudAlerts: securityDict?.fraudAlerts ?? {},
    auditLog: securityDict?.auditLog ?? {},
    threatIntelligence: securityDict?.threatIntelligence ?? {},
    rateLimit: securityDict?.rateLimit ?? {},
    trustedAgents: securityDict?.trustedAgents ?? {},
    toast: securityDict?.toast ?? {},
  };

  const statCards = [
    {
      title: copy.dashboard?.stats?.blockedIps || 'Blocked IPs',
      value: stats.blockedIps,
      icon: Ban,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
    },
    {
      title: copy.dashboard?.stats?.blockedAccounts || 'Blocked Accounts',
      value: stats.blockedAccounts,
      icon: Lock,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
    {
      title: copy.dashboard?.stats?.fraudAlerts || 'Fraud Alerts',
      value: stats.fraudAlerts,
      icon: AlertTriangle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    },
    {
      title: copy.dashboard?.stats?.securityEvents || 'Security Events (24h)',
      value: stats.securityEvents24h,
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-background-dark dark:text-background-light">
          {copy.title}
        </h1>
        <p className="mt-2 text-background-dark/60 dark:text-background-light/60">
          {copy.description}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-full p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? '...' : stat.value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs for Security Management */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex h-auto w-full min-w-max md:w-auto p-1 gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Activity className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="captcha" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Shield className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">CAPTCHA</span>
            </TabsTrigger>
            <TabsTrigger value="blocked-ips" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Ban className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">IPs</span>
            </TabsTrigger>
            <TabsTrigger value="blocked-words" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Words</span>
            </TabsTrigger>
            <TabsTrigger value="blocked-accounts" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Lock className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="fraud-alerts" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Fraud</span>
            </TabsTrigger>
            <TabsTrigger value="threat-intel" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Intel</span>
            </TabsTrigger>
            <TabsTrigger value="rate-limit" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Gauge className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Rate Limit</span>
            </TabsTrigger>
            <TabsTrigger value="trusted-agents" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Agents</span>
            </TabsTrigger>
            <TabsTrigger value="admin-activity" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <Eye className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Admin Activity</span>
            </TabsTrigger>
            <TabsTrigger value="security-reports" className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
              <BarChart3 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Reports</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Overview</CardTitle>
              <CardDescription>
                Quick overview of your platform&apos;s security status and available protection features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This Security Center provides comprehensive protection for your platform through multiple layers of security:
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-semibold">CAPTCHA Protection</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Prevent bots and automated attacks with reCAPTCHA, hCaptcha, or Cloudflare Turnstile integration.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <h3 className="font-semibold">IP Blocking</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Block malicious IP addresses manually or automatically through threat intelligence services.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="font-semibold">Content Filtering</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Filter prohibited words and phrases to maintain platform quality and safety.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <h3 className="font-semibold">Account Protection</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Block suspicious accounts and prevent fraud with automated detection systems.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      <h3 className="font-semibold">Fraud Detection</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Monitor and manage fraud alerts with risk scoring and automated notifications.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h3 className="font-semibold">Threat Intelligence</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Integrate with Abuse.ch and VirusTotal for real-time threat detection and prevention.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="font-semibold">Rate Limiting</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure API and login rate limits, plus auto-blocking for malicious IPs - all from the database.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="font-semibold">Trusted Agents</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Manage automation agents (Manus, etc.) that can bypass security protections with full audit logging.
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Getting Started</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Use the tabs above to configure each security feature</li>
                    <li>All settings are applied in real-time without server restart</li>
                    <li>Monitor the statistics cards at the top for security metrics</li>
                    <li>Check the documentation for detailed setup instructions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="captcha">
          <CaptchaSettings copy={copy.captcha} toastCopy={copy.toast} />
        </TabsContent>

        <TabsContent value="blocked-ips">
          <BlockedIPsManagement copy={copy.blockedIps} />
        </TabsContent>

        <TabsContent value="blocked-words">
          <BlockedWordsManagement copy={copy.blockedWords} />
        </TabsContent>

        <TabsContent value="blocked-accounts">
          <BlockedAccountsManagement copy={copy.blockedAccounts} />
        </TabsContent>

        <TabsContent value="fraud-alerts">
          <FraudAlertsManagement copy={copy.fraudAlerts} />
        </TabsContent>

        <TabsContent value="threat-intel">
          <ThreatIntelligenceSettings copy={copy.threatIntelligence} toastCopy={copy.toast} />
        </TabsContent>

        <TabsContent value="rate-limit">
          <RateLimitSettings copy={copy.rateLimit} toastCopy={copy.toast} />
        </TabsContent>

        <TabsContent value="trusted-agents">
          <TrustedAgentsManagement copy={copy.trustedAgents} />
        </TabsContent>

        <TabsContent value="admin-activity">
          <AdminActivityMonitor
            data={adminSecurityData}
            isLoading={isLoadingAdminData}
            onRefresh={refreshAdminData}
          />
        </TabsContent>

        <TabsContent value="security-reports">
          <SecurityReportsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

