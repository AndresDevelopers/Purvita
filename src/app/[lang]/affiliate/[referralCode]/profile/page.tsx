'use client';

import { use, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
// import Image from 'next/image'; // Unused
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';

interface AffiliateProfilePageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  fulfillment_company: string;
}

const emptyFormState: FormState = {
  name: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  fulfillment_company: '',
};



export default function AffiliateProfilePage({ params }: AffiliateProfilePageProps) {
  const { lang, referralCode } = use(params);
  const dict = useAppDictionary();
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderQuery, setOrderQuery] = useState('');
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [invoiceViewer, setInvoiceViewer] = useState<{ orderId: string; html: string } | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [archivingOrders, setArchivingOrders] = useState(false);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [unarchivingOrders, setUnarchivingOrders] = useState(false);

  // Load profile data and check subscription
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;

        setProfile(data);
        setAvatarUrl(data.avatar_url || '');
        setFormState({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          postal_code: data.postal_code || '',
          fulfillment_company: data.fulfillment_company || '',
        });

        // Check if user's referral code matches the URL and if they have active affiliate subscription
        if (data.referral_code?.toLowerCase() === referralCode.toLowerCase()) {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status, subscription_type')
            .eq('user_id', session.user.id)
            .eq('subscription_type', 'affiliate')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // If no active affiliate subscription, redirect to store home
          if (!subscription) {
            console.log('[Affiliate Profile] Owner has no active affiliate subscription, redirecting to store home');
            router.replace(`/${lang}/affiliate/${referralCode}`);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [toast, referralCode, lang, router]);

  // Load orders data
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          console.log('[Affiliate Profile] No user session found');
          return;
        }

        console.log('[Affiliate Profile] Loading orders for user:', session.user.id);

        // Get the affiliate profile to find their ID
        const { data: affiliateProfile } = await supabase
          .from('profiles')
          .select('id')
          .ilike('referral_code', referralCode)
          .single();

        if (!affiliateProfile) {
          console.log('[Affiliate Profile] Affiliate profile not found');
          setOrders([]);
          return;
        }

        console.log('[Affiliate Profile] Loading orders for affiliate store:', affiliateProfile.id);

        // Query orders that were made in this affiliate's store
        // Filter by purchase_source = 'affiliate_store' and metadata contains this affiliate's ID
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              quantity,
              price_cents,
              product:products (
                name
              )
            )
          `)
          .eq('user_id', session.user.id)
          .eq('purchase_source', 'affiliate_store')
          .contains('metadata', { affiliateId: affiliateProfile.id })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Affiliate Profile] Supabase error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          throw error;
        }

        console.log('[Affiliate Profile] Orders loaded:', data?.length || 0);

        // Transform and load tracking data
        const transformedOrders = await loadOrdersWithTracking(data || []);
        setOrders(transformedOrders);
      } catch (error) {
        console.error('[Affiliate Profile] Error loading orders:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load orders';
        console.error('[Affiliate Profile] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Only show toast if there's a meaningful error (not just empty results)
        if (error instanceof Error && error.message) {
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }
    };

    loadOrders();
  }, [toast, referralCode]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    setUploadingAvatar(true);

    // ✅ SECURITY: Validate file against server-configured upload limits
    try {
      const validationResponse = await fetch('/api/upload/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: file.size,
          type: file.type,
          category: 'avatar',
        }),
      });

      const validationResult = await validationResponse.json();

      if (!validationResult.valid) {
        toast({
          title: 'Error',
          description: validationResult.error || 'File validation failed.',
          variant: 'destructive',
        });
        setUploadingAvatar(false);
        return;
      }
    } catch (validationError) {
      console.error('Error validating file:', validationError);
      toast({
        title: 'Error',
        description: 'Failed to validate file. Please try again.',
        variant: 'destructive',
      });
      setUploadingAvatar(false);
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-avatar-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      toast({
        title: 'Success',
        description: 'Avatar uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          name: formState.name,
          phone: formState.phone,
          address: formState.address,
          city: formState.city,
          state: formState.state,
          postal_code: formState.postal_code,
          fulfillment_company: formState.fulfillment_company,
          avatar_url: avatarUrl || null,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      setProfile({ ...profile, ...formState, avatar_url: avatarUrl });
      setIsEditDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper functions for orders
  const formatCurrency = (value: number, locale: Locale) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
    }).format(value / 100);
  };

  const formatDate = (value: string | null, locale: Locale) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(value));
    } catch (_error) {
      return value;
    }
  };

  const formatDateTime = (value: string | null, locale: Locale) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(new Date(value));
    } catch (_error) {
      return value;
    }
  };

  const orderMatchesQuery = (query: string, order: any) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    const haystack = [
      order.id,
      order.status,
      order.items.map((item: any) => item.name ?? '').join(' '),
      order.tracking?.latestStatus ?? '',
      order.tracking?.responsible_company ?? '',
      order.tracking?.tracking_code ?? '',
      order.tracking?.location ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  };

  const handleViewInvoice = async (orderId: string) => {
    try {
      setLoadingInvoiceId(orderId);

      const response = await fetch(`/api/orders/${orderId}/invoice`, { cache: 'no-store' });

      if (!response.ok) {
        let errorMessage = dict.profile?.orderHistory?.invoiceErrorDescription ?? 'Unable to load invoice';
        try {
          const payload = await response.json();
          const details = typeof payload?.details === 'string' ? payload.details : undefined;
          const error = typeof payload?.error === 'string' ? payload.error : undefined;
          errorMessage = details ?? error ?? errorMessage;
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(errorMessage);
      }

      const htmlContent = await response.text();
      setInvoiceViewer({ orderId, html: htmlContent });
    } catch (err) {
      console.error('Error loading invoice:', err);
      const message =
        err instanceof Error
          ? err.message
          : dict.profile?.orderHistory?.invoiceErrorDescription ?? 'Unable to load invoice';
      toast({
        title: dict.profile?.orderHistory?.invoiceErrorTitle ?? 'Unable to load invoice',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleInvoiceViewerChange = useCallback((open: boolean) => {
    if (!open) {
      setInvoiceViewer(null);
    }
  }, []);

  // Helper function to load tracking data for orders
  const loadOrdersWithTracking = async (ordersData: any[]) => {
    const orderIds = ordersData.map((order: any) => order.id);
    let trackingByOrder: Map<string, any> = new Map();

    if (orderIds.length > 0) {
      const { data: trackingData, error: trackingError } = await supabase
        .from('warehouse_tracking_entries')
        .select('*')
        .in('order_id', orderIds)
        .order('event_time', { ascending: false });

      if (trackingError) {
        console.error('[Affiliate Profile] Error loading tracking:', trackingError);
      } else if (trackingData && trackingData.length > 0) {
        trackingData.forEach((entry: any) => {
          if (!trackingByOrder.has(entry.order_id)) {
            trackingByOrder.set(entry.order_id, []);
          }
          trackingByOrder.get(entry.order_id).push(entry);
        });
      }
    }

    return ordersData.map((order: any) => {
      const trackingEvents = trackingByOrder.get(order.id) || [];
      const latestTracking = trackingEvents[0];

      return {
        id: order.id,
        created_at: order.created_at,
        total_cents: order.total_cents,
        status: order.status,
        archived: order.archived || false,
        items: (order.order_items || []).map((item: any) => ({
          name: item.product?.name || 'Unknown Product',
          qty: item.quantity,
        })),
        tracking: latestTracking ? {
          latestStatus: latestTracking.status,
          statusLabel: latestTracking.status,
          responsible_company: latestTracking.responsible_company,
          tracking_code: latestTracking.tracking_code,
          location: latestTracking.location,
          estimated_delivery: latestTracking.estimated_delivery,
          updated_at: latestTracking.event_time,
        } : null,
      };
    });
  };

  const handleArchiveOrders = async () => {
    if (selectedOrders.length === 0) return;

    try {
      setArchivingOrders(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const response = await fetch('/api/orders/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
        },
        body: JSON.stringify({ orderIds: selectedOrders }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive orders');
      }

      toast({
        title: 'Orders archived',
        description: `Successfully archived ${selectedOrders.length} order${selectedOrders.length > 1 ? 's' : ''}.`,
      });

      setSelectedOrders([]);

      // Reload orders - Get affiliate profile first
      const { data: affiliateProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('referral_code', referralCode)
        .single();

      if (!affiliateProfile) {
        console.log('[Affiliate Profile] Affiliate profile not found during reload');
        setOrders([]);
        return;
      }

      // Reload orders filtered by affiliate store
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price_cents,
            product:products (
              name
            )
          )
        `)
        .eq('user_id', session.user.id)
        .eq('purchase_source', 'affiliate_store')
        .contains('metadata', { affiliateId: affiliateProfile.id })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Affiliate Profile] Error reloading orders:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      } else if (data) {
        const transformedOrders = await loadOrdersWithTracking(data);
        setOrders(transformedOrders);
      }
    } catch (err) {
      console.error('Error archiving orders:', err);
      const message = err instanceof Error ? err.message : 'Failed to archive orders';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setArchivingOrders(false);
    }
  };

  const handleUnarchiveOrders = async () => {
    if (selectedOrders.length === 0) return;

    try {
      setUnarchivingOrders(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const response = await fetch('/api/orders/unarchive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': session.user.id,
        },
        body: JSON.stringify({ orderIds: selectedOrders }),
      });

      if (!response.ok) {
        throw new Error('Failed to unarchive orders');
      }

      toast({
        title: 'Orders unarchived',
        description: `Successfully unarchived ${selectedOrders.length} order${selectedOrders.length > 1 ? 's' : ''}.`,
      });

      setSelectedOrders([]);

      // Reload orders - Get affiliate profile first
      const { data: affiliateProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('referral_code', referralCode)
        .single();

      if (!affiliateProfile) {
        console.log('[Affiliate Profile] Affiliate profile not found during reload');
        setOrders([]);
        return;
      }

      // Reload orders filtered by affiliate store
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price_cents,
            product:products (
              name
            )
          )
        `)
        .eq('user_id', session.user.id)
        .eq('purchase_source', 'affiliate_store')
        .contains('metadata', { affiliateId: affiliateProfile.id })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Affiliate Profile] Error reloading orders:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      } else if (data) {
        const transformedOrders = await loadOrdersWithTracking(data);
        setOrders(transformedOrders);
      }
    } catch (err) {
      console.error('Error unarchiving orders:', err);
      const message = err instanceof Error ? err.message : 'Failed to unarchive orders';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUnarchivingOrders(false);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders(prev =>
      checked
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => showArchivedOrders ? order.archived : !order.archived)
      .filter((order) => orderMatchesQuery(orderQuery, order));
  }, [orders, orderQuery, showArchivedOrders]);

  const archivedOrdersCount = useMemo(() => {
    return orders.filter((order) => order.archived).length;
  }, [orders]);

  const isAllSelected = filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length;
  const _isIndeterminate = selectedOrders.length > 0 && selectedOrders.length < filteredOrders.length;

  const orderStatusDict = dict.profile?.orderHistory?.statuses ?? {};

  if (loading) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">Loading...</div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}`)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Store
          </Button>

          {/* Profile Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url} alt={profile?.name || 'User'} />
                <AvatarFallback className="bg-primary text-2xl font-bold text-white">
                  {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {profile?.name || 'User Profile'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{profile?.email}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Your account details and contact information</CardDescription>
                  </div>
                  <Button onClick={() => setIsEditDialogOpen(true)}>Edit Profile</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</Label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.name || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.email || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</Label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.phone || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</Label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {profile?.address ? `${profile.address}, ${profile.city}, ${profile.state} ${profile.postal_code}` : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders" className="mt-6">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                  {dict.profile?.orderHistory?.title ?? 'Order History'}
                </h2>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {dict.profile?.orderHistory?.description ?? 'View and manage your orders'}
                </p>
              </div>

              <div className="mb-6 flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400">
                      search
                    </span>
                    <Input
                      value={orderQuery}
                      onChange={(event) => setOrderQuery(event.target.value)}
                      className="h-12 w-full rounded-lg bg-white pl-10 pr-4 text-zinc-900 placeholder:text-zinc-500 focus:ring-2 focus:ring-primary dark:bg-zinc-900/50 dark:text-white dark:placeholder:text-zinc-400"
                      placeholder={dict.profile?.orderHistory?.searchPlaceholder ?? 'Search orders...'}
                      type="text"
                    />
                  </div>
                  <div className="flex gap-2">
                    {archivedOrdersCount > 0 && (
                      <Button
                        onClick={() => {
                          setShowArchivedOrders(!showArchivedOrders);
                          setSelectedOrders([]);
                        }}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <span className="material-symbols-outlined mr-2">
                          {showArchivedOrders ? 'inventory_2' : 'archive'}
                        </span>
                        {showArchivedOrders ? 'Show Active Orders' : `View Archived (${archivedOrdersCount})`}
                      </Button>
                    )}
                    {selectedOrders.length > 0 && (
                      <Button
                        onClick={showArchivedOrders ? handleUnarchiveOrders : handleArchiveOrders}
                        disabled={archivingOrders || unarchivingOrders}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <span className="material-symbols-outlined mr-2">
                          {archivingOrders || unarchivingOrders ? 'hourglass_empty' : showArchivedOrders ? 'unarchive' : 'archive'}
                        </span>
                        {archivingOrders
                          ? 'Archiving...'
                          : unarchivingOrders
                          ? 'Unarchiving...'
                          : showArchivedOrders
                          ? `Unarchive ${selectedOrders.length} Selected`
                          : `Archive ${selectedOrders.length} Selected`}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900/50">
                <div className="overflow-x-auto">
                  <Table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-300">
                    <TableHeader className="bg-zinc-50 text-xs uppercase text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                      <TableRow>
                        <TableHead className="px-6 py-3">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all orders"
                          />
                        </TableHead>
                        <TableHead className="px-6 py-3">{dict.profile?.orderHistory?.table?.date ?? 'Date'}</TableHead>
                        <TableHead className="px-6 py-3">{dict.profile?.orderHistory?.table?.amount ?? 'Amount'}</TableHead>
                        <TableHead className="px-6 py-3">{dict.profile?.orderHistory?.table?.productSubscription ?? 'Products'}</TableHead>
                        <TableHead className="px-6 py-3 text-center">{dict.profile?.orderHistory?.table?.status ?? 'Status'}</TableHead>
                        <TableHead className="px-6 py-3 text-left">{dict.profile?.orderHistory?.table?.tracking ?? 'Tracking'}</TableHead>
                        <TableHead className="px-6 py-3 text-center">{dict.profile?.orderHistory?.table?.invoice ?? 'Invoice'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="px-6 py-6 text-center text-zinc-500 dark:text-zinc-400">
                            {dict.profile?.orderHistory?.empty ?? 'No orders found'}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredOrders.map((order) => {
                        const products = order.items.length
                          ? order.items
                            .map((item: any) => `${item.name ?? '—'} ×${item.qty}`)
                            .join(', ')
                          : dict.profile?.orderHistory?.subscriptionFallback ?? 'Subscription';
                        const statusKey = order.tracking?.latestStatus ?? order.status;
                        const statusLabel = orderStatusDict?.[statusKey as keyof typeof orderStatusDict] ?? statusKey;
                        const isLoadingInvoice = loadingInvoiceId === order.id;
                        return (
                          <TableRow key={order.id} className="border-b border-black/10 dark:border-white/10">
                            <TableCell className="px-6 py-4">
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                                aria-label={`Select order ${order.id}`}
                              />
                            </TableCell>
                            <TableCell className="px-6 py-4">{formatDate(order.created_at, lang)}</TableCell>
                            <TableCell className="px-6 py-4">{formatCurrency(order.total_cents, lang)}</TableCell>
                            <TableCell className="px-6 py-4 font-medium text-zinc-900 dark:text-white">{products}</TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <Badge className="bg-primary/20 text-green-800 dark:text-green-300">{statusLabel}</Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              {order.tracking ? (
                                <div className="space-y-1 text-left text-xs text-zinc-600 dark:text-zinc-300">
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                                    {orderStatusDict?.[order.tracking.latestStatus as keyof typeof orderStatusDict] ??
                                      order.tracking.latestStatus}
                                  </Badge>
                                  {order.tracking.updated_at && (
                                    <p>{dict.profile?.orderHistory?.tracking?.updated?.replace('{{value}}', formatDateTime(order.tracking.updated_at, lang)) ?? `Updated: ${formatDateTime(order.tracking.updated_at, lang)}`}</p>
                                  )}
                                  {order.tracking.responsible_company && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile?.orderHistory?.tracking?.company ?? 'Company'}:
                                      </span>{' '}
                                      {order.tracking.responsible_company}
                                    </p>
                                  )}
                                  {order.tracking.tracking_code && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile?.orderHistory?.tracking?.code ?? 'Tracking'}:
                                      </span>{' '}
                                      {order.tracking.tracking_code}
                                    </p>
                                  )}
                                  {order.tracking.location && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile?.orderHistory?.tracking?.location ?? 'Location'}:
                                      </span>{' '}
                                      {order.tracking.location}
                                    </p>
                                  )}
                                  {order.tracking.estimated_delivery && (
                                    <p>
                                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                        {dict.profile?.orderHistory?.tracking?.eta ?? 'ETA'}:
                                      </span>{' '}
                                      {formatDate(order.tracking.estimated_delivery, lang)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                                  {dict.profile?.orderHistory?.tracking?.empty ?? 'No tracking info'}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoadingInvoice}
                                onClick={() => handleViewInvoice(order.id)}
                                className="text-xs"
                              >
                                {isLoadingInvoice
                                  ? dict.profile?.orderHistory?.loadingInvoice ?? 'Loading...'
                                  : dict.profile?.orderHistory?.viewInvoice ?? 'View Invoice'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Edit Profile Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[85vh]">
              {/* Sticky Header */}
              <DialogHeader className="shrink-0 border-b bg-background px-4 py-4 sm:px-6">
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>Update your personal information</DialogDescription>
              </DialogHeader>
              
              {/* Scrollable Content */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                <div className="space-y-4">
                  {/* Avatar Upload Section */}
                  <div className="flex flex-col items-center gap-4 border-b pb-4">
                    <Label className="text-sm font-medium">Profile Picture</Label>
                    <div className="flex flex-col items-center gap-4 sm:flex-row">
                      <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                        <AvatarImage src={avatarUrl} alt={formState.name || 'User'} />
                        <AvatarFallback className="bg-primary text-xl font-bold text-white sm:text-2xl">
                          {formState.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-center gap-2 sm:items-start">
                        <input
                          ref={avatarFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => avatarFileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="min-h-[44px] min-w-[140px]"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                        </Button>
                        {avatarUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveAvatar}
                            disabled={uploadingAvatar}
                            className="min-h-[44px]"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Remove Photo
                          </Button>
                        )}
                        <p className="text-center text-xs text-gray-500 sm:text-left">
                          Recommended: Square image, max 2MB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formState.name}
                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                        className="mt-1 min-h-[44px]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formState.phone}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        className="mt-1 min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formState.address}
                      onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                      className="mt-1 min-h-[44px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formState.city}
                        onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                        className="mt-1 min-h-[44px]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formState.state}
                        onChange={(e) => setFormState({ ...formState, state: e.target.value })}
                        className="mt-1 min-h-[44px]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postal_code">Postal Code</Label>
                      <Input
                        id="postal_code"
                        value={formState.postal_code}
                        onChange={(e) => setFormState({ ...formState, postal_code: e.target.value })}
                        className="mt-1 min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sticky Footer */}
              <div className="shrink-0 flex justify-end gap-2 border-t bg-background px-4 py-4 sm:px-6">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={isSaving}
                  className="min-h-[44px]"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Invoice Viewer Dialog */}
          <Dialog open={Boolean(invoiceViewer)} onOpenChange={handleInvoiceViewerChange}>
            <DialogContent className="flex h-[80vh] w-[min(100vw-2rem,960px)] flex-col gap-4">
              <DialogHeader className="space-y-2">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  <span>{dict.profile?.orderHistory?.table?.invoice ?? 'Invoice'}</span>
                  {invoiceViewer?.orderId ? (
                    <span className="text-sm font-medium text-muted-foreground">
                      #{invoiceViewer.orderId.slice(0, 8).toUpperCase()}
                    </span>
                  ) : null}
                </DialogTitle>
                <DialogDescription>{dict.profile?.orderHistory?.invoiceViewerHint ?? 'View your order invoice'}</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-hidden rounded-xl border border-border/60 bg-background">
                {invoiceViewer ? (
                  <iframe
                    title={`invoice-${invoiceViewer.orderId}`}
                    srcDoc={invoiceViewer.html}
                    className="h-full w-full bg-white"
                  />
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AuthGuard>
  );
}
