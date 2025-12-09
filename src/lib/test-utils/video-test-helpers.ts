/**
 * Test utilities for video-related features
 * Provides mock data and helper functions for testing
 */

import type { ClassVideo } from '@/lib/models/definitions';
import type { VideoTranslation, VideoWithLocalizedContent } from '@/lib/types/video.types';

/**
 * Create a mock video for testing
 */
export function createMockVideo(overrides?: Partial<ClassVideo>): ClassVideo {
  return {
    id: 'test-video-id',
    youtube_id: 'dQw4w9WgXcQ',
    category: 'Test Category',
    visibility: 'all',
    allowed_levels: [],
    is_published: true,
    is_featured: false,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    title: 'Test Video',
    description: 'Test Description',
    ...overrides,
  };
}

/**
 * Create a mock translation for testing
 */
export function createMockTranslation(
  videoId: string,
  locale: string,
  overrides?: Partial<VideoTranslation>
): VideoTranslation {
  return {
    id: `translation-${videoId}-${locale}`,
    video_id: videoId,
    locale,
    title: `Test Title (${locale})`,
    description: `Test Description (${locale})`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock localized video for testing
 */
export function createMockLocalizedVideo(
  locale: string,
  overrides?: Partial<VideoWithLocalizedContent>
): VideoWithLocalizedContent {
  return {
    id: 'test-video-id',
    youtube_id: 'dQw4w9WgXcQ',
    category: 'Test Category',
    visibility: 'all',
    allowed_levels: [],
    is_published: true,
    is_featured: false,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    title: `Test Title (${locale})`,
    description: `Test Description (${locale})`,
    originalTitle: 'Original Test Title',
    originalDescription: 'Original Test Description',
    ...overrides,
  };
}

/**
 * Create multiple mock videos for testing lists
 */
export function createMockVideoList(count: number): ClassVideo[] {
  return Array.from({ length: count }, (_, i) =>
    createMockVideo({
      id: `video-${i}`,
      youtube_id: `youtube-${i}`,
      title: `Video ${i}`,
      order_index: i,
    })
  );
}

/**
 * Mock fetch response helper
 */
export function mockFetchResponse<T>(data: T, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

/**
 * Mock fetch error helper
 */
export function mockFetchError(message: string, status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
  } as Response);
}

/**
 * Wait for async operations in tests
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock Supabase response
 */
export function mockSupabaseResponse<T>(data: T, error: unknown = null) {
  return {
    data: error ? null : data,
    error,
  };
}
