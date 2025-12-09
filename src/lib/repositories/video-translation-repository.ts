/**
 * Repository pattern for video translation data access
 * Abstracts Supabase queries and provides a clean interface
 */

import { supabase } from '@/lib/supabase';
import { translationCache } from '@/lib/utils/cache';

export interface VideoTranslation {
  id: string;
  video_id: string;
  locale: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export class VideoTranslationRepository {
  /**
   * Check if translations table exists
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('class_video_translations')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Fetch translations for multiple videos and locales
   * Returns null if table doesn't exist
   * Uses cache to reduce database queries
   */
  static async findByVideosAndLocales(
    videoIds: string[],
    locales: string[]
  ): Promise<VideoTranslation[] | null> {
    // Create cache key from sorted IDs and locales for consistency
    const cacheKey = `translations:${videoIds.sort().join(',')}:${locales.sort().join(',')}`;
    
    // Try cache first
    const cached = translationCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('class_video_translations')
        .select('*')
        .in('video_id', videoIds)
        .in('locale', locales);

      if (error) {
        console.log('Translations query error:', error.message);
        return null;
      }

      // Cache the result
      translationCache.set(cacheKey, data);
      return data;
    } catch (_err) {
      console.log('Translations table not available');
      return null;
    }
  }

  /**
   * Fetch translation for a specific video and locale
   */
  static async findByVideoAndLocale(
    videoId: string,
    locale: string
  ): Promise<VideoTranslation | null> {
    try {
      const { data, error } = await supabase
        .from('class_video_translations')
        .select('*')
        .eq('video_id', videoId)
        .eq('locale', locale)
        .maybeSingle();

      if (error) {
        console.log('Translation query error:', error.message);
        return null;
      }

      return data;
    } catch (_err) {
      console.log('Translations table not available');
      return null;
    }
  }

  /**
   * Upsert a translation
   * Invalidates cache after mutation
   */
  static async upsert(translation: Omit<VideoTranslation, 'id' | 'created_at' | 'updated_at'>): Promise<VideoTranslation | null> {
    try {
      const { data, error } = await supabase
        .from('class_video_translations')
        .upsert(translation, {
          onConflict: 'video_id,locale',
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting translation:', error);
        return null;
      }

      // Invalidate cache for this video
      this.invalidateCacheForVideo(translation.video_id);
      return data;
    } catch (err) {
      console.error('Failed to upsert translation:', err);
      return null;
    }
  }

  /**
   * Delete translation
   */
  static async delete(videoId: string, locale: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('class_video_translations')
        .delete()
        .eq('video_id', videoId)
        .eq('locale', locale);

      if (error) {
        console.error('Error deleting translation:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Failed to delete translation:', err);
      return false;
    }
  }

  /**
   * Delete all translations for a video
   * Invalidates cache after mutation
   */
  static async deleteAllForVideo(videoId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('class_video_translations')
        .delete()
        .eq('video_id', videoId);

      if (error) {
        console.error('Error deleting translations:', error);
        return false;
      }

      // Invalidate cache for this video
      this.invalidateCacheForVideo(videoId);
      return true;
    } catch (err) {
      console.error('Failed to delete translations:', err);
      return false;
    }
  }

  /**
   * Invalidate cache entries for a specific video
   * Called after mutations to ensure fresh data
   */
  private static invalidateCacheForVideo(_videoId: string): void {
    // Clear all cache entries (simple approach)
    // In production, you might want more granular invalidation
    translationCache.clear();
  }
}
