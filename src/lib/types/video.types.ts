/**
 * Centralized type definitions for video-related features
 * Provides better type safety and reusability
 */

import type { ClassVideo } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';

/**
 * Video translation record from database
 */
export interface VideoTranslation {
  id: string;
  video_id: string;
  locale: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * Video with localized content for display
 */
export interface VideoWithLocalizedContent extends Omit<ClassVideo, 'title' | 'description'> {
  title: string;
  description: string;
  originalTitle?: string;
  originalDescription?: string;
}

/**
 * Translation input for creating/updating
 */
export interface TranslationInput {
  title: string;
  description?: string;
}

/**
 * Video with all translations (admin view)
 */
export interface VideoWithTranslations extends ClassVideo {
  translations: Record<Locale, TranslationInput>;
}

/**
 * API response types
 */
export interface VideoListResponse {
  videos: VideoWithLocalizedContent[];
  total: number;
  locale: Locale;
}

export interface VideoDetailResponse {
  video: VideoWithLocalizedContent;
  locale: Locale;
}

/**
 * Error types
 */
export class VideoNotFoundError extends Error {
  constructor(videoId: string) {
    super(`Video not found: ${videoId}`);
    this.name = 'VideoNotFoundError';
  }
}

export class TranslationNotFoundError extends Error {
  constructor(videoId: string, locale: Locale) {
    super(`Translation not found for video ${videoId} in locale ${locale}`);
    this.name = 'TranslationNotFoundError';
  }
}
