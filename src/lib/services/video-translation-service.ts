import { supabase } from '@/lib/supabase';
import type { Locale as _Locale } from '@/i18n/config';
import { availableLocales } from '@/i18n/dictionaries';
import type { VideoTranslation, VideoWithTranslations } from '@/lib/models/video-translations';

export async function getVideoWithTranslations(videoId: string): Promise<VideoWithTranslations | null> {
  try {
    // Get video base data
    const { data: video, error: videoError } = await supabase
      .from('class_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('Error fetching video:', videoError);
      return null;
    }

    // Get all translations
    const { data: translations, error: translationsError } = await supabase
      .from('class_video_translations')
      .select('*')
      .eq('video_id', videoId);

    if (translationsError) {
      console.error('Error fetching translations:', translationsError);
      return null;
    }

    // Convert translations array to record
    const translationsRecord: Record<string, VideoTranslation> = {};
    translations?.forEach((t) => {
      translationsRecord[t.locale] = t;
    });

    return {
      id: video.id,
      youtube_id: video.youtube_id,
      category: video.category,
      visibility: video.visibility || 'all',
      is_published: video.is_published ?? true,
      is_featured: video.is_featured ?? false,
      order_index: video.order_index ?? 0,
      created_at: video.created_at,
      updated_at: video.updated_at,
      translations: translationsRecord,
    };
  } catch (error) {
    console.error('Error in getVideoWithTranslations:', error);
    return null;
  }
}

export async function upsertVideoTranslation(
  videoId: string,
  locale: string,
  title: string,
  description: string
): Promise<VideoTranslation | null> {
  try {
    const { data, error } = await supabase
      .from('class_video_translations')
      .upsert(
        {
          video_id: videoId,
          locale,
          title,
          description,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'video_id,locale',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting translation:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in upsertVideoTranslation:', error);
    return null;
  }
}

export async function deleteVideoTranslation(videoId: string, locale: string): Promise<boolean> {
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
  } catch (error) {
    console.error('Error in deleteVideoTranslation:', error);
    return false;
  }
}

export async function ensureDefaultTranslations(videoId: string, defaultTitle: string, defaultDescription: string): Promise<void> {
  try {
    // Ensure all available locales have a translation
    for (const locale of availableLocales) {
      const { data: existing } = await supabase
        .from('class_video_translations')
        .select('id')
        .eq('video_id', videoId)
        .eq('locale', locale)
        .single();

      if (!existing) {
        await upsertVideoTranslation(videoId, locale, defaultTitle, defaultDescription);
      }
    }
  } catch (error) {
    console.error('Error ensuring default translations:', error);
  }
}
