import { supabase } from '@/lib/supabase';
import type { Locale } from '@/i18n/config';
import type { ClassVideo } from '@/lib/models/definitions';
import { VideoTranslationRepository, type VideoTranslation } from '@/lib/repositories/video-translation-repository';

export interface VideoWithLocalizedContent extends Omit<ClassVideo, 'title' | 'description'> {
  title: string;
  description: string;
  originalTitle?: string;
  originalDescription?: string;
}

/**
 * Helper function to map a video with its translation
 */
function mapVideoWithTranslation(
  video: ClassVideo,
  translation: VideoTranslation | null | undefined,
  fallbackTranslation: VideoTranslation | null | undefined
): VideoWithLocalizedContent {
  const activeTranslation = translation || fallbackTranslation;

  return {
    id: video.id,
    youtube_id: video.youtube_id,
    category: video.category,
    visibility: video.visibility || 'all',
    allowed_levels: video.allowed_levels ?? [],
    is_published: video.is_published ?? true,
    is_featured: video.is_featured ?? false,
    order_index: video.order_index ?? 0,
    created_at: video.created_at,
    updated_at: video.updated_at,
    title: activeTranslation?.title || video.title || 'Untitled',
    description: activeTranslation?.description || video.description || '',
    originalTitle: video.title,
    originalDescription: video.description,
  };
}

/**
 * Get all videos with localized content for a specific locale
 * Falls back to English if translation doesn't exist
 */
export async function getVideosWithLocale(locale: Locale): Promise<VideoWithLocalizedContent[]> {
  try {
    // Get all videos
    const { data: videos, error: videosError } = await supabase
      .from('class_videos')
      .select('*')
      .order('order_index', { ascending: true });

    if (videosError) {
      console.error('Error fetching videos:', videosError);
      return [];
    }

    if (!videos || videos.length === 0) {
      return [];
    }

    // Try to get translations (may fail if table doesn't exist yet)
    const videoIds = videos.map(v => v.id);
    const locales = locale === 'en' ? ['en'] : [locale, 'en'];
    const translations = await VideoTranslationRepository.findByVideosAndLocales(videoIds, locales);

    // Create a lookup map for faster access
    const translationMap = new Map<string, VideoTranslation>();
    translations?.forEach(t => {
      const key = `${t.video_id}-${t.locale}`;
      translationMap.set(key, t);
    });

    // Map videos with their localized content
    return videos.map(video => {
      const translation = translationMap.get(`${video.id}-${locale}`);
      const fallbackTranslation = locale !== 'en' 
        ? translationMap.get(`${video.id}-en`)
        : undefined;

      return mapVideoWithTranslation(video, translation, fallbackTranslation);
    });
  } catch (error) {
    console.error('Error in getVideosWithLocale:', error);
    return [];
  }
}

/**
 * Get a single video with localized content
 */
export async function getVideoWithLocale(
  videoId: string,
  locale: Locale
): Promise<VideoWithLocalizedContent | null> {
  try {
    // Get video
    const { data: video, error: videoError } = await supabase
      .from('class_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('Error fetching video:', videoError);
      return null;
    }

    // Try to get translations (may fail if table doesn't exist yet)
    const locales = locale === 'en' ? ['en'] : [locale, 'en'];
    const translations = await VideoTranslationRepository.findByVideosAndLocales([videoId], locales);
    
    const translation = translations?.find(t => t.video_id === videoId && t.locale === locale);
    const fallbackTranslation = locale !== 'en' 
      ? translations?.find(t => t.video_id === videoId && t.locale === 'en')
      : undefined;

    return mapVideoWithTranslation(video, translation, fallbackTranslation);
  } catch (error) {
    console.error('Error in getVideoWithLocale:', error);
    return null;
  }
}
