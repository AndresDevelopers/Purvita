/**
 * Tests for AdminVideoClientService
 * 
 * Run with: npm test admin-video-client-service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminVideoClientService } from '../admin-video-client-service';
import { createMockVideoList, mockFetchResponse, mockFetchError } from '@/lib/test-utils/video-test-helpers';

// Mock global fetch
global.fetch = vi.fn();

describe('AdminVideoClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadVideos', () => {
    it('should load videos from localized endpoint', async () => {
      const mockVideos = createMockVideoList(3);
      (global.fetch as any).mockResolvedValueOnce(mockFetchResponse(mockVideos));

      const result = await AdminVideoClientService.loadVideos('es');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/videos/localized?locale=es',
        { cache: 'no-store' }
      );
      expect(result).toEqual(mockVideos);
    });

    it('should fallback to regular endpoint if localized fails', async () => {
      const mockVideos = createMockVideoList(3);
      
      // First call fails (localized endpoint)
      (global.fetch as any)
        .mockResolvedValueOnce(mockFetchError('Not found', 404))
        .mockResolvedValueOnce(mockFetchResponse(mockVideos));

      const result = await AdminVideoClientService.loadVideos('es');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        '/api/admin/videos/localized?locale=es',
        { cache: 'no-store' }
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/admin/videos',
        { cache: 'no-store' }
      );
      expect(result).toEqual(mockVideos);
    });

    it('should throw error if both endpoints fail', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce(mockFetchError('Not found', 404))
        .mockResolvedValueOnce(mockFetchError('Server error', 500));

      await expect(AdminVideoClientService.loadVideos('es')).rejects.toThrow();
    });
  });

  describe('deleteVideo', () => {
    it('should delete video successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce(mockFetchResponse(null, true, 204));

      await expect(AdminVideoClientService.deleteVideo('video-123')).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/videos/video-123',
        { method: 'DELETE' }
      );
    });

    it('should throw error if delete fails', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockFetchError('Failed to delete', 500)
      );

      await expect(AdminVideoClientService.deleteVideo('video-123')).rejects.toThrow();
    });
  });

  describe('togglePublish', () => {
    it('should toggle publish status from true to false', async () => {
      const updatedVideo = { id: 'video-123', is_published: false };
      (global.fetch as any).mockResolvedValueOnce(mockFetchResponse(updatedVideo));

      const result = await AdminVideoClientService.togglePublish('video-123', true);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/videos/video-123',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_published: false }),
        }
      );
      expect(result.is_published).toBe(false);
    });

    it('should toggle publish status from false to true', async () => {
      const updatedVideo = { id: 'video-123', is_published: true };
      (global.fetch as any).mockResolvedValueOnce(mockFetchResponse(updatedVideo));

      const result = await AdminVideoClientService.togglePublish('video-123', false);

      expect(result.is_published).toBe(true);
    });
  });

  describe('toggleFeatured', () => {
    it('should toggle featured status', async () => {
      const updatedVideo = { id: 'video-123', is_featured: true };
      (global.fetch as any).mockResolvedValueOnce(mockFetchResponse(updatedVideo));

      const result = await AdminVideoClientService.toggleFeatured('video-123', false);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/videos/video-123',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_featured: true }),
        }
      );
      expect(result.is_featured).toBe(true);
    });
  });
});
