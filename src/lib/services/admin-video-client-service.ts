/**
 * Client-side service for admin video operations
 * Encapsulates API calls and error handling
 */

import type { ClassVideo } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

export class AdminVideoClientService {
  /**
   * Load videos with fallback to non-localized endpoint
   */
  static async loadVideos(locale: Locale, filters?: { visibility?: string[]; levels?: number[] }): Promise<ClassVideo[]> {
    try {
      // Build query string
      const params = new URLSearchParams();
      params.set('locale', locale);

      if (filters?.visibility && filters.visibility.length > 0) {
        params.set('visibility', filters.visibility.join(','));
      }

      if (filters?.levels && filters.levels.length > 0) {
        params.set('levels', filters.levels.join(','));
      }

      const queryString = params.toString();

      // Try localized endpoint first (only if it exists)
      let response: Response;

      try {
        response = await fetch(`/api/admin/videos/localized?${queryString}`, {
          cache: 'no-store'
        });

        // If we get a 404 or 500, fallback to regular endpoint
        if (!response.ok) {
          throw new Error('Localized endpoint not available');
        }
      } catch (_localizedError) {
        // Fallback to regular endpoint
        console.log('Using regular endpoint (translations not available yet)');
        // Re-build params for regular endpoint (without locale if not supported, but let's keep it consistent)
        response = await fetch(`/api/admin/videos?${queryString}`, { cache: 'no-store' });
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to load videos');
      }

      return await response.json();
    } catch (error) {
      console.error('Error loading videos:', error);
      throw error;
    }
  }

  /**
   * Delete a video by ID
   * Uses adminApi.delete() to automatically include CSRF token
   */
  static async deleteVideo(videoId: string): Promise<void> {
    const response = await adminApi.delete(`/api/admin/videos/${videoId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete video');
    }
  }

  /**
   * Toggle video publish status
   * Uses adminApi.put() to automatically include CSRF token
   */
  static async togglePublish(videoId: string, currentStatus: boolean): Promise<ClassVideo> {
    const response = await adminApi.put(`/api/admin/videos/${videoId}`, {
      is_published: !currentStatus,
    });

    if (!response.ok) {
      throw new Error('Failed to update video publish status');
    }

    return await response.json();
  }

  /**
   * Toggle video featured status
   * Uses adminApi.put() to automatically include CSRF token
   */
  static async toggleFeatured(videoId: string, currentStatus: boolean): Promise<ClassVideo> {
    const response = await adminApi.put(`/api/admin/videos/${videoId}`, {
      is_featured: !currentStatus,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update video featured status');
    }

    return await response.json();
  }
}
