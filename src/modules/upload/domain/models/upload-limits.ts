import { z } from 'zod';

/**
 * Upload Limits Configuration
 * Defines limits for file uploads (images, videos, documents)
 */

// Allowed MIME types
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
] as const;

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

// Database model
export interface UploadLimitsConfig {
  id: string;

  // Image limits
  max_image_size_mb: number;
  allowed_image_types: string[];
  max_image_width: number;
  max_image_height: number;

  // Video limits
  max_video_size_mb: number;
  allowed_video_types: string[];
  max_video_duration_seconds: number;

  // Document limits
  max_document_size_mb: number;
  allowed_document_types: string[];

  // Avatar limits
  max_avatar_size_mb: number;

  // General limits
  max_files_per_upload: number;
  max_total_upload_size_mb: number;

  // Feature flags
  enable_image_compression: boolean;
  enable_video_transcoding: boolean;
  enable_virus_scanning: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

// Validation schemas
export const UploadLimitsUpdateSchema = z.object({
  // Image limits
  max_image_size_mb: z.number()
    .min(0.1, 'Image size must be at least 0.1 MB')
    .max(100, 'Image size cannot exceed 100 MB')
    .optional(),

  allowed_image_types: z.array(z.string())
    .min(1, 'At least one image type must be allowed')
    .optional(),

  max_image_width: z.number()
    .int()
    .min(100, 'Width must be at least 100px')
    .max(10000, 'Width cannot exceed 10000px')
    .optional(),

  max_image_height: z.number()
    .int()
    .min(100, 'Height must be at least 100px')
    .max(10000, 'Height cannot exceed 10000px')
    .optional(),

  // Video limits
  max_video_size_mb: z.number()
    .min(1, 'Video size must be at least 1 MB')
    .max(1000, 'Video size cannot exceed 1000 MB (1 GB)')
    .optional(),

  allowed_video_types: z.array(z.string())
    .min(1, 'At least one video type must be allowed')
    .optional(),

  max_video_duration_seconds: z.number()
    .int()
    .min(10, 'Duration must be at least 10 seconds')
    .max(3600, 'Duration cannot exceed 3600 seconds (1 hour)')
    .optional(),

  // Document limits
  max_document_size_mb: z.number()
    .min(0.1, 'Document size must be at least 0.1 MB')
    .max(100, 'Document size cannot exceed 100 MB')
    .optional(),

  allowed_document_types: z.array(z.string())
    .min(1, 'At least one document type must be allowed')
    .optional(),

  // Avatar limits
  max_avatar_size_mb: z.number()
    .min(0.1, 'Avatar size must be at least 0.1 MB')
    .max(10, 'Avatar size cannot exceed 10 MB')
    .optional(),

  // General limits
  max_files_per_upload: z.number()
    .int()
    .min(1, 'Must allow at least 1 file per upload')
    .max(100, 'Cannot exceed 100 files per upload')
    .optional(),

  max_total_upload_size_mb: z.number()
    .min(1, 'Total size must be at least 1 MB')
    .max(1000, 'Total size cannot exceed 1000 MB (1 GB)')
    .optional(),

  // Feature flags
  enable_image_compression: z.boolean().optional(),
  enable_video_transcoding: z.boolean().optional(),
  enable_virus_scanning: z.boolean().optional(),
}).strict();

export type UploadLimitsUpdate = z.infer<typeof UploadLimitsUpdateSchema>;

// Helper to convert bytes to MB
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

// Helper to convert MB to bytes
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

// File type validation
export function isValidImageType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}

export function isValidVideoType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}

export function isValidDocumentType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}

// File size validation
export function isValidFileSize(sizeInBytes: number, maxSizeMB: number): boolean {
  const fileSizeMB = bytesToMB(sizeInBytes);
  return fileSizeMB <= maxSizeMB;
}
