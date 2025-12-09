/**
 * Custom hook for admin video management
 * Encapsulates video CRUD operations and state management
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ClassVideo } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import { AdminVideoClientService } from '@/lib/services/admin-video-client-service';
import { ClassVideoSchema } from '@/lib/models/definitions';

interface UseAdminVideosOptions {
  locale: Locale;
  filters?: { visibility?: string[]; levels?: number[] };
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export function useAdminVideos({ locale, filters, onError, onSuccess }: UseAdminVideosOptions) {
  const [videos, setVideos] = useState<ClassVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  // Use refs for callbacks to avoid dependency cycles
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
  }, [onError, onSuccess]);

  // Memoize filters to avoid infinite loops due to object reference changes
  const stableFilters = useMemo(() => filters, [filters]);

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AdminVideoClientService.loadVideos(locale, stableFilters);
      const validatedData = ClassVideoSchema.array().parse(data);
      setVideos(validatedData);
    } catch (error) {
      console.error('Error loading videos:', error);
      onErrorRef.current?.('Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [locale, stableFilters]);

  const deleteVideo = useCallback(async (videoId: string) => {
    try {
      await AdminVideoClientService.deleteVideo(videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      onSuccessRef.current?.('Video deleted successfully');
    } catch (error) {
      console.error('Error deleting video:', error);
      onErrorRef.current?.(error instanceof Error ? error.message : 'Failed to delete video');
      throw error;
    }
  }, []);

  const togglePublish = useCallback(async (video: ClassVideo) => {
    try {
      const updatedVideo = await AdminVideoClientService.togglePublish(
        video.id,
        video.is_published
      );
      setVideos(prev => prev.map(v => v.id === video.id ? updatedVideo : v));
      onSuccessRef.current?.(
        `Video ${updatedVideo.is_published ? 'published' : 'unpublished'} successfully`
      );
    } catch (error) {
      console.error('Error toggling publish status:', error);
      onErrorRef.current?.('Failed to update video status');
      throw error;
    }
  }, []);

  const toggleFeatured = useCallback(async (video: ClassVideo) => {
    try {
      const updatedVideo = await AdminVideoClientService.toggleFeatured(
        video.id,
        video.is_featured ?? false
      );
      setVideos(prev => prev.map(v => v.id === video.id ? updatedVideo : v));
      onSuccessRef.current?.(
        `Video ${updatedVideo.is_featured ? 'featured' : 'unfeatured'} successfully`
      );
    } catch (error) {
      console.error('Error toggling featured status:', error);
      onErrorRef.current?.(error instanceof Error ? error.message : 'Failed to update video status');
      throw error;
    }
  }, []);

  const toggleSelection = useCallback((videoId: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(v => v.id)));
    }
  }, [selectedVideos.size, videos]);

  const clearSelection = useCallback(() => {
    setSelectedVideos(new Set());
  }, []);

  const deleteSelectedVideos = useCallback(async () => {
    try {
      const deletePromises = Array.from(selectedVideos).map(id =>
        AdminVideoClientService.deleteVideo(id)
      );
      await Promise.all(deletePromises);
      setVideos(prev => prev.filter(v => !selectedVideos.has(v.id)));
      setSelectedVideos(new Set());
      onSuccessRef.current?.(`${selectedVideos.size} video(s) deleted successfully`);
    } catch (error) {
      console.error('Error deleting videos:', error);
      onErrorRef.current?.('Failed to delete some videos');
      throw error;
    }
  }, [selectedVideos]);

  const toggleFeaturedForSelected = useCallback(async (featured: boolean) => {
    try {
      const updatePromises = Array.from(selectedVideos).map(id => {
        const video = videos.find(v => v.id === id);
        if (!video) return Promise.resolve(null);
        return AdminVideoClientService.toggleFeatured(id, !featured);
      });
      const updatedVideos = await Promise.all(updatePromises);

      setVideos(prev => prev.map(v => {
        const updated = updatedVideos.find(uv => uv?.id === v.id);
        return updated || v;
      }));

      setSelectedVideos(new Set());
      onSuccessRef.current?.(`${selectedVideos.size} video(s) ${featured ? 'featured' : 'unfeatured'} successfully`);
    } catch (error) {
      console.error('Error updating featured status:', error);
      onErrorRef.current?.('Failed to update some videos');
      throw error;
    }
  }, [selectedVideos, videos]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  return {
    videos,
    loading,
    loadVideos,
    deleteVideo,
    togglePublish,
    toggleFeatured,
    selectedVideos,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    deleteSelectedVideos,
    toggleFeaturedForSelected,
  };
}
