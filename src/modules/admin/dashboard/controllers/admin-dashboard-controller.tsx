'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { AdminDashboardProvider } from '../context/admin-dashboard-context';
import { useAdminDashboardData } from '../hooks/use-admin-dashboard-data';
import { useAdminDashboardHaptics } from '../hooks/use-admin-dashboard-haptics';
import { usePullToRefresh } from '../hooks/use-pull-to-refresh';
import { useInfiniteScroll } from '../hooks/use-infinite-scroll';
import { AdminDashboardView, type DatePeriod } from '../views/admin-dashboard-view';
import { AdminDashboardSkeleton } from '../views/admin-dashboard-skeleton';
import { AdminDashboardErrorState as _AdminDashboardErrorState } from '../views/admin-dashboard-error-state';
import { buildAdminDashboardViewModel, type AdminDashboardViewModel } from '../view-models/admin-dashboard-view-model';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface Attachment {
  type: 'image' | 'video' | 'audio';
  url: string;
  name: string;
  size: number;
}

interface AdminNote {
  id: string;
  content: string;
  attachments: Attachment[];
  created_at: string;
  profiles: { name: string; email: string } | null;
}

interface AdminDashboardControllerProps {
  lang: Locale;
}

const PAGE_SIZE = 5;

const AdminDashboardControllerContent = ({ lang }: AdminDashboardControllerProps) => {
  const dict = useMemo(() => getDictionary(lang), [lang]);
  const [activityLimit, setActivityLimit] = useState(PAGE_SIZE);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [productsPeriod, setProductsPeriod] = useState<DatePeriod>('all');
  const [activityPeriod, setActivityPeriod] = useState<DatePeriod>('all');

  const { data, loading, error: _error, isRefreshing, refresh } = useAdminDashboardData({
    recentItemsLimit: activityLimit,
    productsPeriod,
    activityPeriod,
  });

  useAdminDashboardHaptics();

  const viewModel: AdminDashboardViewModel = useMemo(() => {
    if (!data) {
      // Return empty viewModel to show the design even if data fails
      return buildAdminDashboardViewModel({
        lang,
        dict,
        data: {
          totalUsers: 0,
          totalProducts: 0,
          activeSubscriptions: 0,
          waitlistedSubscriptions: 0,
          totalRevenue: 0,
          totalSubscriptionRevenueCents: 0,
          totalOrderRevenueCents: 0,
          totalWalletBalanceCents: 0,
          totalStock: 0,
          comingSoonSubscribers: 0,
          productStock: [],
          recentProducts: [],
          topProductSales: [],
          recentActivities: [],
          recentUsers: [],
        },
      });
    }
    return buildAdminDashboardViewModel({ lang, dict, data });
  }, [data, dict, lang]);

  const isInitialLoading = loading && !data;
  const isLoadingMoreActivities = loading && Boolean(viewModel);
  const canLoadMoreActivities = Boolean(data && data.recentActivities.length >= activityLimit);

  const handleLoadMoreActivities = useCallback(() => {
    if (!canLoadMoreActivities || loading || isRefreshing || !data) {
      return;
    }
    setActivityLimit((current) => current + PAGE_SIZE);
  }, [canLoadMoreActivities, data, isRefreshing, loading]);

  const activitySentinelRef = useInfiniteScroll(handleLoadMoreActivities, {
    enabled: canLoadMoreActivities && !loading && !isRefreshing,
  });

  const pullState = usePullToRefresh(refresh, {
    enabled: !isInitialLoading && !isRefreshing && !loading,
  });

  // Fetch notes on mount
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/admin/notes');
        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes || []);
        }
      } catch (_error) {
        console.error('Failed to fetch notes:', _error);
      }
    };
    fetchNotes();
  }, []);

  const handleAddNote = useCallback(async (content: string, attachments: Attachment[]) => {
    setIsAddingNote(true);
    try {
      const response = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes((prev) => [data.note, ...prev]);
      } else {
        console.error('Failed to add note');
      }
    } catch (_error) {
      console.error('Error adding note:', _error);
    } finally {
      setIsAddingNote(false);
    }
  }, []);

  const handleUpdateNote = useCallback(async (id: string, content: string, attachments: Attachment[]) => {
    try {
      // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
      const response = await adminApi.put('/api/admin/notes', { id, content, attachments });

      if (response.ok) {
        const data = await response.json();
        setNotes((prev) => prev.map((note) => (note.id === id ? data.note : note)));
      } else {
        console.error('Failed to update note');
      }
    } catch (_error) {
      console.error('Error updating note:', _error);
    }
  }, []);

  const handleDeleteNote = useCallback(async (id: string) => {
    try {
      // ✅ SECURITY: Use adminApi.delete() to automatically include CSRF token
      const response = await adminApi.delete(`/api/admin/notes?id=${id}`);

      if (response.ok) {
        setNotes((prev) => prev.filter((note) => note.id !== id));
      } else {
        console.error('Failed to delete note');
      }
    } catch (_error) {
      console.error('Error deleting note:', _error);
    }
  }, []);

  const handleUploadFile = useCallback(async (file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);

    // ✅ SECURITY: Use fetch with CSRF token for FormData uploads
    // Note: adminApi doesn't support FormData, so we need to add CSRF token manually
    const { addCsrfTokenToHeaders } = await import('@/lib/utils/admin-csrf-helpers');
    const headers = await addCsrfTokenToHeaders();

    const response = await fetch('/api/admin/notes/upload', {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    const data = await response.json();
    return data.attachment;
  }, []);

  const handleDeleteFile = useCallback(async (url: string) => {
    try {
      // ✅ SECURITY: Use adminApi.delete() to automatically include CSRF token
      const response = await adminApi.delete(`/api/admin/notes/upload?url=${encodeURIComponent(url)}`);

      if (!response.ok) {
        console.error('Failed to delete file');
      }
    } catch (_error) {
      console.error('Error deleting file:', _error);
    }
  }, []);

  if (isInitialLoading) {
    return <AdminDashboardSkeleton lang={lang} />;
  }

  return (
    <AdminDashboardView
      lang={lang}
      viewModel={viewModel}
      pullState={pullState}
      isRefreshing={isRefreshing}
      activityLoadMoreRef={activitySentinelRef}
      canLoadMoreActivities={canLoadMoreActivities}
      isLoadingMoreActivities={isLoadingMoreActivities}
      onManualRefresh={refresh}
      onLoadMoreActivities={handleLoadMoreActivities}
      notes={notes}
      onAddNote={handleAddNote}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      onUploadFile={handleUploadFile}
      onDeleteFile={handleDeleteFile}
      isAddingNote={isAddingNote}
      productsPeriod={productsPeriod}
      onProductsPeriodChange={setProductsPeriod}
      activityPeriod={activityPeriod}
      onActivityPeriodChange={setActivityPeriod}
    />
  );
};

export const AdminDashboardController = ({ lang }: AdminDashboardControllerProps) => {
  return (
    <AdminDashboardProvider>
      <AdminDashboardControllerContent lang={lang} />
    </AdminDashboardProvider>
  );
};
