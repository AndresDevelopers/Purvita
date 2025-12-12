import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { UploadLimitsService } from '@/modules/upload/services/upload-limits-service';

/**
 * POST /api/upload/validate
 * Validate a file before upload against configured limits
 *
 * This is a helper endpoint that can be called from the frontend
 * before attempting to upload a file, to provide immediate feedback
 * to the user about file validation.
 *
 * Usage:
 * ```typescript
 * const response = await fetch('/api/upload/validate', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     size: file.size,
 *     type: file.type,
 *     category: 'image', // 'image' | 'video' | 'document' | 'avatar'
 *     width: 1920, // optional for images
 *     height: 1080, // optional for images
 *     duration: 60 // optional for videos (in seconds)
 *   })
 * });
 * ```
 */

const FileValidationSchema = z.object({
  size: z.number().positive('File size must be positive'),
  type: z.string().min(1, 'File type is required'),
  category: z.enum(['image', 'video', 'document', 'avatar'], {
    message: 'Invalid category',
  }),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  duration: z.number().positive().optional(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Parse and validate request body
    const body = await req.json();
    const validation = FileValidationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid request data',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { size, type, category, width, height, duration } = validation.data;

    // Validate file against configured limits
    const service = new UploadLimitsService(supabase);
    const result = await service.validateFile(
      {
        size,
        type,
        width,
        height,
        duration,
      },
      category
    );

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'File is valid and can be uploaded',
    });
  } catch (error) {
    console.error('[API] File validation error:', error);
    const message = error instanceof Error ? error.message : 'File validation failed';
    return NextResponse.json(
      {
        valid: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
