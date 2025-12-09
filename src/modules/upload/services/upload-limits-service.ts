import { SupabaseClient } from '@supabase/supabase-js';
import type { UploadLimitsConfig, UploadLimitsUpdate } from '../domain/models/upload-limits';

/**
 * Upload Limits Service
 * Manages configuration for file upload limits
 */
export class UploadLimitsService {
  private static readonly CONFIG_ID = '00000000-0000-0000-0000-000000000001';

  constructor(private supabase: SupabaseClient) {}

  /**
   * Get current upload limits configuration
   */
  async getConfig(): Promise<UploadLimitsConfig | null> {
    const { data, error } = await this.supabase
      .from('upload_limits_config')
      .select('*')
      .eq('id', UploadLimitsService.CONFIG_ID)
      .single();

    if (error) {
      console.error('[UploadLimitsService] Error fetching config:', error);
      return null;
    }

    return data as UploadLimitsConfig;
  }

  /**
   * Update upload limits configuration
   * @param updates - Partial configuration updates
   * @param userId - ID of admin user making the update
   */
  async updateConfig(
    updates: UploadLimitsUpdate,
    userId: string
  ): Promise<UploadLimitsConfig | null> {
    const { data, error } = await this.supabase
      .from('upload_limits_config')
      .update({
        ...updates,
        updated_by: userId,
      })
      .eq('id', UploadLimitsService.CONFIG_ID)
      .select()
      .single();

    if (error) {
      console.error('[UploadLimitsService] Error updating config:', error);
      throw new Error(`Failed to update upload limits: ${error.message}`);
    }

    return data as UploadLimitsConfig;
  }

  /**
   * Reset to default configuration
   * @param userId - ID of admin user making the reset
   */
  async resetToDefaults(userId: string): Promise<UploadLimitsConfig | null> {
    const defaults: UploadLimitsUpdate = {
      max_image_size_mb: 5.0,
      allowed_image_types: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      max_image_width: 4096,
      max_image_height: 4096,

      max_video_size_mb: 100.0,
      allowed_video_types: ['video/mp4', 'video/webm', 'video/ogg'],
      max_video_duration_seconds: 600,

      max_document_size_mb: 10.0,
      allowed_document_types: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],

      max_avatar_size_mb: 2.0,

      max_files_per_upload: 10,
      max_total_upload_size_mb: 50.0,

      enable_image_compression: true,
      enable_video_transcoding: false,
      enable_virus_scanning: false,
    };

    return this.updateConfig(defaults, userId);
  }

  /**
   * Validate a file against current limits
   */
  async validateFile(
    file: {
      size: number;
      type: string;
      width?: number;
      height?: number;
      duration?: number;
    },
    fileCategory: 'image' | 'video' | 'document' | 'avatar'
  ): Promise<{ valid: boolean; error?: string }> {
    const config = await this.getConfig();

    if (!config) {
      return { valid: false, error: 'Upload configuration not found' };
    }

    const fileSizeMB = file.size / (1024 * 1024);

    switch (fileCategory) {
      case 'image': {
        // Check size
        if (fileSizeMB > config.max_image_size_mb) {
          return {
            valid: false,
            error: `Image size exceeds maximum of ${config.max_image_size_mb} MB`,
          };
        }

        // Check type
        if (!config.allowed_image_types.includes(file.type)) {
          return {
            valid: false,
            error: `Image type ${file.type} is not allowed`,
          };
        }

        // Check dimensions
        if (file.width && file.width > config.max_image_width) {
          return {
            valid: false,
            error: `Image width exceeds maximum of ${config.max_image_width}px`,
          };
        }

        if (file.height && file.height > config.max_image_height) {
          return {
            valid: false,
            error: `Image height exceeds maximum of ${config.max_image_height}px`,
          };
        }

        break;
      }

      case 'video': {
        // Check size
        if (fileSizeMB > config.max_video_size_mb) {
          return {
            valid: false,
            error: `Video size exceeds maximum of ${config.max_video_size_mb} MB`,
          };
        }

        // Check type
        if (!config.allowed_video_types.includes(file.type)) {
          return {
            valid: false,
            error: `Video type ${file.type} is not allowed`,
          };
        }

        // Check duration
        if (file.duration && file.duration > config.max_video_duration_seconds) {
          return {
            valid: false,
            error: `Video duration exceeds maximum of ${config.max_video_duration_seconds} seconds`,
          };
        }

        break;
      }

      case 'document': {
        // Check size
        if (fileSizeMB > config.max_document_size_mb) {
          return {
            valid: false,
            error: `Document size exceeds maximum of ${config.max_document_size_mb} MB`,
          };
        }

        // Check type
        if (!config.allowed_document_types.includes(file.type)) {
          return {
            valid: false,
            error: `Document type ${file.type} is not allowed`,
          };
        }

        break;
      }

      case 'avatar': {
        // Check size
        if (fileSizeMB > config.max_avatar_size_mb) {
          return {
            valid: false,
            error: `Avatar size exceeds maximum of ${config.max_avatar_size_mb} MB`,
          };
        }

        // Check type (avatars must be images)
        if (!config.allowed_image_types.includes(file.type)) {
          return {
            valid: false,
            error: `Avatar type ${file.type} is not allowed`,
          };
        }

        break;
      }
    }

    return { valid: true };
  }

  /**
   * Validate multiple files upload
   */
  async validateMultipleFiles(
    files: Array<{ size: number; type: string }>
  ): Promise<{ valid: boolean; error?: string }> {
    const config = await this.getConfig();

    if (!config) {
      return { valid: false, error: 'Upload configuration not found' };
    }

    // Check number of files
    if (files.length > config.max_files_per_upload) {
      return {
        valid: false,
        error: `Cannot upload more than ${config.max_files_per_upload} files at once`,
      };
    }

    // Check total size
    const totalSizeBytes = files.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSizeBytes / (1024 * 1024);

    if (totalSizeMB > config.max_total_upload_size_mb) {
      return {
        valid: false,
        error: `Total upload size exceeds maximum of ${config.max_total_upload_size_mb} MB`,
      };
    }

    return { valid: true };
  }
}
