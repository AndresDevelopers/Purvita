/**
 * File Validation Utilities
 * 
 * Provides secure file validation including:
 * - MIME type validation
 * - File size limits
 * - Magic byte verification
 * - Extension validation
 */

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
] as const;

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg'
] as const;

export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg'
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

// File size limits (in bytes)
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Magic bytes for common file types
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'video/mp4': [[0x00, 0x00, 0x00]], // ftyp signature
  'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2]], // MP3
};

/**
 * Verify file magic bytes match the declared MIME type
 */
async function verifyMagicBytes(file: File): Promise<boolean> {
  const expectedBytes = MAGIC_BYTES[file.type];
  if (!expectedBytes) {
    // No magic bytes defined for this type, skip verification
    return true;
  }

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check if any of the expected byte sequences match
    return expectedBytes.some(expected => {
      if (bytes.length < expected.length) {
        return false;
      }
      return expected.every((byte, index) => bytes[index] === byte);
    });
  } catch (error) {
    console.error('Error verifying magic bytes:', error);
    return false;
  }
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and special characters
  return filename
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 255); // Limit length
}

/**
 * Validate image file
 */
export async function validateImageFile(file: File): Promise<FileValidationResult> {
  // 1. Validate size
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Image size exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  // 2. Validate MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    };
  }

  // 3. Verify magic bytes (except SVG which is XML-based)
  if (file.type !== 'image/svg+xml') {
    const magicBytesValid = await verifyMagicBytes(file);
    if (!magicBytesValid) {
      return {
        valid: false,
        error: 'File content does not match declared type'
      };
    }
  }

  return { valid: true };
}

/**
 * Validate video file
 */
export async function validateVideoFile(file: File): Promise<FileValidationResult> {
  if (file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: `Video size exceeds ${MAX_VIDEO_SIZE / 1024 / 1024}MB limit`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  if (!ALLOWED_VIDEO_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid video type. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate audio file
 */
export async function validateAudioFile(file: File): Promise<FileValidationResult> {
  if (file.size > MAX_AUDIO_SIZE) {
    return {
      valid: false,
      error: `Audio size exceeds ${MAX_AUDIO_SIZE / 1024 / 1024}MB limit`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  if (!ALLOWED_AUDIO_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid audio type. Allowed: ${ALLOWED_AUDIO_TYPES.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate document file
 */
export async function validateDocumentFile(file: File): Promise<FileValidationResult> {
  if (file.size > MAX_DOCUMENT_SIZE) {
    return {
      valid: false,
      error: `Document size exceeds ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB limit`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `Invalid document type. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`
    };
  }

  // Verify PDF magic bytes
  if (file.type === 'application/pdf') {
    const magicBytesValid = await verifyMagicBytes(file);
    if (!magicBytesValid) {
      return {
        valid: false,
        error: 'File content does not match declared type'
      };
    }
  }

  return { valid: true };
}

/**
 * Generic file validator that routes to specific validators
 */
export async function validateFile(
  file: File,
  type?: 'image' | 'video' | 'audio' | 'document'
): Promise<FileValidationResult> {
  // If type is specified, use specific validator
  if (type) {
    switch (type) {
      case 'image':
        return validateImageFile(file);
      case 'video':
        return validateVideoFile(file);
      case 'audio':
        return validateAudioFile(file);
      case 'document':
        return validateDocumentFile(file);
    }
  }

  // Auto-detect based on MIME type
  if (ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return validateImageFile(file);
  }
  
  if (ALLOWED_VIDEO_TYPES.includes(file.type as any)) {
    return validateVideoFile(file);
  }
  
  if (ALLOWED_AUDIO_TYPES.includes(file.type as any)) {
    return validateAudioFile(file);
  }
  
  if (ALLOWED_DOCUMENT_TYPES.includes(file.type as any)) {
    return validateDocumentFile(file);
  }

  return {
    valid: false,
    error: 'Unsupported file type'
  };
}
