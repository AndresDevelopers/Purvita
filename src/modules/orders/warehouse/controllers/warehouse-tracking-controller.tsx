'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import {
  type WarehouseTrackingCreateInput,
  type WarehouseTrackingDictionary,
  type WarehouseTrackingEvent,
  type WarehouseTrackingUpdateInput,
} from '../domain/models/warehouse-tracking';
import { WarehouseTrackingAdminRepositoryFactory } from '../repositories/warehouse-tracking-repository';
import { useWarehouseTrackingHaptics } from '../hooks/use-warehouse-tracking-haptics';
import { WarehouseTrackingView } from '../views/warehouse-tracking-view';

interface WarehouseTrackingControllerProps {
  dictionary: WarehouseTrackingDictionary;
  lang: Locale;
}

const SEARCH_DEBOUNCE_MS = 350;

export const WarehouseTrackingController = ({ dictionary, lang }: WarehouseTrackingControllerProps) => {
  const repository = useMemo(() => WarehouseTrackingAdminRepositoryFactory.create(), []);
  const haptics = useWarehouseTrackingHaptics();

  const [entries, setEntries] = useState<WarehouseTrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadEntries = useCallback(
    async (options: { reset?: boolean; cursor?: string | null } = {}) => {
      const { reset = false, cursor = null } = options;

      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await repository.list({
          cursor: cursor ?? null,
          status: statusFilter ?? null,
          search: debouncedSearch.length > 0 ? debouncedSearch : null,
        });

        if (reset) {
          setEntries(response.entries);
        } else {
          setEntries((previous) => [...previous, ...response.entries]);
        }

        setNextCursor(response.nextCursor);
        haptics('load');
      } catch (loadError) {
        console.error('[warehouse-tracking] load failed', loadError);
        const message =
          loadError instanceof Error
            ? loadError.message
            : dictionary.error.description;
        setError(message);
        haptics('error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
  }, [repository, statusFilter, debouncedSearch, dictionary.error.description, haptics],
  );

  useEffect(() => {
    loadEntries({ reset: true });
  }, [statusFilter, debouncedSearch, loadEntries]);

  const handleRetry = useCallback(() => {
    loadEntries({ reset: true });
  }, [loadEntries]);

  const handleStatusChange = useCallback((status: string | null) => {
    setStatusFilter(status);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !nextCursor) {
      return;
    }

    loadEntries({ cursor: nextCursor });
  }, [loadingMore, nextCursor, loadEntries]);

  const handleCreate = useCallback(
    async (input: WarehouseTrackingCreateInput) => {
      setCreating(true);
      setError(null);
      try {
        const event = await repository.create(input);
        setEntries((previous) => [event, ...previous]);
        haptics('create');
        return event;
      } catch (createError) {
        console.error('[warehouse-tracking] create failed', createError);
        haptics('error');
        const message =
          createError instanceof Error
            ? createError.message
            : dictionary.error.description;
        setError(message);
        throw createError;
      } finally {
        setCreating(false);
      }
    },
    [repository, dictionary.error.description, haptics],
  );

  const handleUpdate = useCallback(
    async (entryId: string, input: WarehouseTrackingUpdateInput) => {
      setUpdatingId(entryId);
      setError(null);
      try {
        const event = await repository.update(entryId, input);
        setEntries((previous) => previous.map((item) => (item.id === entryId ? event : item)));
        haptics('create');
        return event;
      } catch (updateError) {
        console.error('[warehouse-tracking] update failed', updateError);
        haptics('error');
        const message =
          updateError instanceof Error
            ? updateError.message
            : dictionary.error.description;
        setError(message);
        throw updateError;
      } finally {
        setUpdatingId(null);
      }
    },
    [repository, dictionary.error.description, haptics],
  );

  const handleClearFilters = useCallback(() => {
    setStatusFilter(null);
    setSearchTerm('');
  }, []);

  return (
    <WarehouseTrackingView
      dictionary={dictionary}
      lang={lang}
      entries={entries}
      loading={loading}
      loadingMore={loadingMore}
      creating={creating}
      updatingId={updatingId}
      error={error}
      statusFilter={statusFilter}
      searchTerm={searchTerm}
      hasMore={Boolean(nextCursor)}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onRetry={handleRetry}
      onStatusChange={handleStatusChange}
      onSearchChange={handleSearchChange}
      onClearFilters={handleClearFilters}
      onLoadMore={handleLoadMore}
    />
  );
};
