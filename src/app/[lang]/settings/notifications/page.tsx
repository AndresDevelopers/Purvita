'use client';

import { useState, use, useEffect } from 'react';
import type { Locale } from '@/i18n/config';
import { Switch } from '@/components/ui/switch';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useToast } from '@/hooks/use-toast';
import type { NotificationPreferences } from '@/modules/notifications/domain/models/notification-preferences';

interface NotificationsPageProps {
  params: Promise<{
    lang: Locale;
  }>;
}

export default function NotificationsPage({ params }: NotificationsPageProps) {
  const { lang } = use(params);
  const _dict = useAppDictionary();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promotionalOffers, setPromotionalOffers] = useState(true);
  const [teamUpdates, setTeamUpdates] = useState(true);
  const [newVideoContent, setNewVideoContent] = useState(false);
  const [orderNotifications, setOrderNotifications] = useState(true);
  const [subscriptionNotifications, setSubscriptionNotifications] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/notifications/preferences');
        if (response.ok) {
          const data: NotificationPreferences = await response.json();
          setPromotionalOffers(data.promotionalOffers);
          setTeamUpdates(data.teamUpdates);
          setNewVideoContent(data.newVideoContent);
          setOrderNotifications(data.orderNotifications);
          setSubscriptionNotifications(data.subscriptionNotifications);
        }
      } catch (_error) {
        console.error('Error loading preferences:', _error);
        toast({
          title: 'Error',
          description: 'Failed to load notification preferences',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [toast]);

  // Save preferences when they change
  const savePreferences = async (updates: Partial<NotificationPreferences>) => {
    setSaving(true);
    try {
      // ✅ SECURITY: Fetch CSRF token before PUT request
      const csrfResponse = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });

      if (!csrfResponse.ok) {
        throw new Error('Failed to obtain CSRF token. Please refresh the page and try again.');
      }

      const { token: csrfToken } = await csrfResponse.json();

      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Success',
        description: 'Notification preferences updated',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePromotionalOffersChange = (checked: boolean) => {
    setPromotionalOffers(checked);
    savePreferences({ promotionalOffers: checked });
  };

  const handleTeamUpdatesChange = (checked: boolean) => {
    setTeamUpdates(checked);
    savePreferences({ teamUpdates: checked });
  };

  const handleNewVideoContentChange = (checked: boolean) => {
    setNewVideoContent(checked);
    savePreferences({ newVideoContent: checked });
  };

  const handleOrderNotificationsChange = (checked: boolean) => {
    setOrderNotifications(checked);
    savePreferences({ orderNotifications: checked });
  };

  const handleSubscriptionNotificationsChange = (checked: boolean) => {
    setSubscriptionNotifications(checked);
    savePreferences({ subscriptionNotifications: checked });
  };

  if (loading) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your notification settings to stay updated on promotions, team activities, and new content.</p>
          </div>
          <div className="space-y-10">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">Promotional</h3>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Promotional Offers</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Receive notifications about special offers, discounts, and new product launches via email.</p>
                </div>
                <Switch
                  checked={promotionalOffers}
                  onCheckedChange={handlePromotionalOffersChange}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">Community</h3>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Team Updates</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Get notified when someone joins your team or when there are important team announcements.</p>
                </div>
                <Switch
                  checked={teamUpdates}
                  onCheckedChange={handleTeamUpdatesChange}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">Content</h3>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">New Video Content</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Be the first to know when new training videos, product demonstrations, or motivational content is available.</p>
                </div>
                <Switch
                  checked={newVideoContent}
                  onCheckedChange={handleNewVideoContentChange}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">Orders & Shipping</h3>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Order Notifications</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Receive email notifications for payment confirmations, order tracking updates, delivery confirmations, and shipment cancellations.</p>
                </div>
                <Switch
                  checked={orderNotifications}
                  onCheckedChange={handleOrderNotificationsChange}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">Subscriptions</h3>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Subscription Notifications</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Receive email notifications for subscription renewals, payment method updates, and renewal failures.</p>
                </div>
                <Switch
                  checked={subscriptionNotifications}
                  onCheckedChange={handleSubscriptionNotificationsChange}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}