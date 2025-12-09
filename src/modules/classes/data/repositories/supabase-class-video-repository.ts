import type { SupabaseClient } from '@supabase/supabase-js';
import { ClassVideoSchema, type ClassVideo } from '@/lib/models/definitions';
import type { ClassVideoRepository } from '../../domain/contracts/class-video-repository';

type _SupabaseError = { code?: string; message?: string } | null;

export interface SupabaseClassVideoRepositoryDependencies {
  publicClient: SupabaseClient;
  serviceRoleClient?: SupabaseClient;
  auditLogger: (action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) => Promise<void>;
}

export class SupabaseClassVideoRepository implements ClassVideoRepository {
  constructor(private readonly deps: SupabaseClassVideoRepositoryDependencies) {}

  async listPublished(): Promise<ClassVideo[]> {
    console.log('📊 SupabaseClassVideoRepository.listPublished: Iniciando consulta...');

    const { data, error } = await this.deps.publicClient
      .from('class_videos')
      .select('*')
      .eq('is_published', true)
      .order('order_index', { ascending: true });

    console.log('📊 SupabaseClassVideoRepository.listPublished: Data:', data);
    console.log('📊 SupabaseClassVideoRepository.listPublished: Error:', error);

    if (error) {
      console.error('📊 SupabaseClassVideoRepository.listPublished: Error completo:', error);
      throw new Error(`Error fetching published class videos: ${error.message}`);
    }

    const result = this.parseVideos(data);
    console.log('📊 SupabaseClassVideoRepository.listPublished: Resultado parseado:', result);
    return result;
  }

  async listPublishedForUser(userId: string, hasActiveSubscription: boolean, hasPurchasedProducts: boolean): Promise<ClassVideo[]> {
    console.log('📊 SupabaseClassVideoRepository.listPublishedForUser: Iniciando consulta...', { userId, hasActiveSubscription, hasPurchasedProducts });

    try {
      const { data, error } = await this.deps.publicClient
        .from('class_videos')
        .select('*')
        .eq('is_published', true)
        .order('order_index', { ascending: true });

      console.log('📊 SupabaseClassVideoRepository.listPublishedForUser: Data:', data);
      console.log('📊 SupabaseClassVideoRepository.listPublishedForUser: Error:', error);

      if (error) {
        console.error('📊 SupabaseClassVideoRepository.listPublishedForUser: Supabase error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Error fetching published class videos: ${error.message}`);
      }

      // Verificar si hay datos
      if (!data || data.length === 0) {
        console.log('📊 SupabaseClassVideoRepository.listPublishedForUser: No hay videos publicados');
        return [];
      }

      // Filtrar por visibilidad
      const allVideos = this.parseVideos(data);
      const filteredVideos = allVideos.filter(video => {
        switch (video.visibility) {
          case 'all':
            return true;
          case 'subscription':
            return hasActiveSubscription;
          case 'product':
            return hasPurchasedProducts;
          default:
            return true; // Por defecto, mostrar
        }
      });

      console.log('📊 SupabaseClassVideoRepository.listPublishedForUser: Videos filtrados:', filteredVideos.length, 'de', allVideos.length);
      return filteredVideos;
    } catch (error: any) {
      console.error('📊 SupabaseClassVideoRepository.listPublishedForUser: Error inesperado:', {
        error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async getById(id: string): Promise<ClassVideo | null> {
    if (!this.deps.serviceRoleClient) {
      throw new Error('Service role client not available');
    }
    const { data, error } = await this.deps.serviceRoleClient
      .from('class_videos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching class video: ${error.message}`);
    }

    return ClassVideoSchema.parse(data);
  }

  async create(video: Omit<ClassVideo, 'id' | 'created_at' | 'updated_at'>): Promise<ClassVideo> {
    if (!this.deps.serviceRoleClient) {
      throw new Error('Service role client not available');
    }
    const { data, error } = await this.deps.serviceRoleClient
      .from('class_videos')
      .insert([video])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating class video: ${error.message}`);
    }

    const parsed = ClassVideoSchema.parse(data);

    await this.deps.auditLogger('CLASS_VIDEO_CREATED', 'class_video', parsed.id, {
      title: parsed.title,
      youtube_id: parsed.youtube_id,
    });

    return parsed;
  }

  async update(id: string, updates: Partial<Omit<ClassVideo, 'id' | 'created_at'>>): Promise<ClassVideo> {
    if (!this.deps.serviceRoleClient) {
      throw new Error('Service role client not available');
    }
    const { data, error } = await this.deps.serviceRoleClient
      .from('class_videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating class video: ${error.message}`);
    }

    const parsed = ClassVideoSchema.parse(data);

    await this.deps.auditLogger('CLASS_VIDEO_UPDATED', 'class_video', parsed.id, {
      title: parsed.title,
      updatedFields: Object.keys(updates ?? {}),
    });

    return parsed;
  }

  async delete(id: string): Promise<void> {
    if (!this.deps.serviceRoleClient) {
      throw new Error('Service role client not available');
    }
    const { data: videoData, error: fetchError } = await this.deps.serviceRoleClient
      .from('class_videos')
      .select('title, youtube_id')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Error fetching class video for deletion: ${fetchError.message}`);
    }

    const { error } = await this.deps.serviceRoleClient
      .from('class_videos')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting class video: ${error.message}`);
    }

    const metadata = videoData
      ? {
          title: videoData.title,
          youtube_id: videoData.youtube_id,
        }
      : { videoId: id };

    await this.deps.auditLogger('CLASS_VIDEO_DELETED', 'class_video', id, metadata);
  }

  async reorder(videos: { id: string; order_index: number }[]): Promise<void> {
    if (!this.deps.serviceRoleClient) {
      throw new Error('Service role client not available');
    }
    const updates = videos.map(({ id, order_index }) => ({
      id,
      order_index,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.deps.serviceRoleClient
      .from('class_videos')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      throw new Error(`Error reordering class videos: ${error.message}`);
    }

    await this.deps.auditLogger('CLASS_VIDEOS_REORDERED', 'class_video', undefined, {
      reorderedCount: videos.length,
    });
  }

  private parseVideos(data: any[] | null | undefined): ClassVideo[] {
    if (!data || data.length === 0) {
      return [];
    }

    const results: ClassVideo[] = [];
    const errors: Array<{ index: number; item: any; error: unknown }> = [];

    data.forEach((item, index) => {
      try {
        const parsed = ClassVideoSchema.parse(item);
        results.push(parsed);
      } catch (error: any) {
        console.error(`📊 parseVideos: Error parsing video at index ${index}:`, {
          item,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          zodIssues: (error as any)?.issues,
        });
        errors.push({ index, item, error });
      }
    });

    if (errors.length > 0) {
      console.error(`📊 parseVideos: Failed to parse ${errors.length} of ${data.length} videos`);
      // Throw error with detailed information
      const errorDetails = errors.map(e => ({
        index: e.index,
        issues: (e.error as any)?.issues || [],
      }));
      throw new Error(`Failed to parse ${errors.length} videos. Details: ${JSON.stringify(errorDetails)}`);
    }

    return results;
  }
}