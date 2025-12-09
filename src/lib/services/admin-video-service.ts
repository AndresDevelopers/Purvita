import { ZodError } from 'zod';
import { createClient as _createClient } from '@supabase/supabase-js';
import { ClassVideoSchema, type ClassVideo } from '@/lib/models/definitions';
import { getServiceRoleClient } from '@/lib/supabase';

const normaliseErrorMessage = (message: string) => {
  if (!message) {
    return 'Unknown error';
  }

  return message.replace('published class videos', 'class videos');
};

export const getAllClassVideos = async (filters?: { visibility?: string[]; levels?: number[] }): Promise<ClassVideo[]> => {
  console.log('🎥 getAllClassVideos: Iniciando...', filters);

  const client = getServiceRoleClient();

  if (!client) {
    throw new Error('Service role client not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  try {
    console.log('🎥 getAllClassVideos: Consultando todos los videos...');

    let query = client
      .from('class_videos')
      .select('*');

    if (filters?.visibility && filters.visibility.length > 0) {
      query = query.in('visibility', filters.visibility);
    }

    // Filter by levels: show videos where allowed_levels is null/empty OR contains any of the requested levels
    if (filters?.levels && filters.levels.length > 0) {
      // Use PostgreSQL array overlap operator (&&)
      // This will match if allowed_levels array has any common elements with the filter levels
      // OR if allowed_levels is null (which means all levels can view)
      query = query.or(`allowed_levels.ov.{${filters.levels.join(',')}},allowed_levels.is.null`);
    }

    const { data, error } = await query.order('order_index', { ascending: true });

    if (error) {
      throw new Error(`Error fetching class videos: ${error.message}`);
    }

    const result = ClassVideoSchema.array().parse(data ?? []);
    console.log('🎥 getAllClassVideos: Resultado:', result.length, 'videos');
    return result;
  } catch (error) {
    console.error('🎥 getAllClassVideos: Error completo:', error);

    if (error instanceof ZodError) {
      console.error('🎥 getAllClassVideos: Error de validación Zod:', error.errors);
      throw new Error('Invalid class video data received');
    }

    if (error instanceof Error) {
      console.error('🎥 getAllClassVideos: Error message:', error.message);
      const message = normaliseErrorMessage(error.message);
      throw new Error(`Error fetching class videos: ${message}`);
    }

    throw new Error('Error fetching class videos: Unknown error');
  }
};

export const createClassVideo = async (video: Omit<ClassVideo, 'id' | 'created_at' | 'updated_at'>): Promise<ClassVideo> => {
  const client = getServiceRoleClient();

  if (!client) {
    throw new Error('Service role client not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  try {
    const { data, error } = await client
      .from('class_videos')
      .insert([video])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating class video: ${error.message}`);
    }

    return ClassVideoSchema.parse(data);
  } catch (error) {
    console.error('Error creating class video:', error);
    throw error;
  }
};

export const updateClassVideo = async (id: string, updates: Partial<Omit<ClassVideo, 'id' | 'created_at'>>): Promise<ClassVideo> => {
  const client = getServiceRoleClient();

  if (!client) {
    throw new Error('Service role client not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  try {
    const { data, error } = await client
      .from('class_videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating class video: ${error.message}`);
    }

    return ClassVideoSchema.parse(data);
  } catch (error) {
    console.error('Error updating class video:', error);
    throw error;
  }
};

export const deleteClassVideo = async (id: string): Promise<void> => {
  const client = getServiceRoleClient();

  if (!client) {
    throw new Error('Service role client not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  try {
    const { error } = await client
      .from('class_videos')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting class video: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting class video:', error);
    throw error;
  }
};

export const getClassVideoById = async (id: string): Promise<ClassVideo | null> => {
  const client = getServiceRoleClient();

  if (!client) {
    throw new Error('Service role client not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  try {
    const { data, error } = await client
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
  } catch (error) {
    console.error('Error getting class video by id:', error);
    throw error;
  }
};