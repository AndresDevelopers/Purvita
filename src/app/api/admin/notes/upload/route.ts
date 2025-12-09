import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { UploadLimitsService } from '@/modules/upload/services/upload-limits-service';
import { withAdminPermission } from '@/lib/auth/with-auth';
import {
  validateImageFile,
  validateVideoFile,
  validateAudioFile,
  validateDocumentFile,
} from '@/lib/security/file-validation';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity, extractRequestMetadata } from '@/lib/security/audit-logger';

const ADMIN_NOTES_BUCKET = 'admin-notes';

/**
 * POST /api/admin/notes/upload
 * Upload a file (image, video, or audio) for admin notes
 * Requires: manage_content permission
 */
export const POST = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const supabase = await createClient();

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine file type and validate with magic bytes
    const uploadLimitsService = new UploadLimitsService(supabase);
    let fileType: 'image' | 'video' | 'document' | 'audio' | null = null;

    // Get upload configuration
    const config = await uploadLimitsService.getConfig();
    if (!config) {
      return NextResponse.json({ error: 'Upload configuration not available' }, { status: 500 });
    }

    // ✅ SECURITY: Determine file type and validate with MAGIC BYTES (not just MIME type)
    let validation;

    if (config.allowed_image_types.includes(file.type)) {
      fileType = 'image';
      // ✅ SECURITY: Validate magic bytes to prevent MIME type spoofing
      validation = await validateImageFile(file);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    } else if (config.allowed_video_types.includes(file.type)) {
      fileType = 'video';
      // ✅ SECURITY: Validate video file
      validation = await validateVideoFile(file);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    } else if (config.allowed_document_types.includes(file.type)) {
      fileType = 'document';
      // ✅ SECURITY: Validate magic bytes for documents (especially PDFs)
      validation = await validateDocumentFile(file);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    } else if (file.type === 'audio/mpeg' || file.type === 'audio/wav' || file.type === 'audio/ogg') {
      fileType = 'audio';
      // ✅ SECURITY: Validate audio files with magic bytes
      validation = await validateAudioFile(file);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: 'Invalid file type. Only images, videos, documents, and audio files are allowed'
      }, { status: 400 });
    }

    // ✅ SECURITY: Additional validation using upload limits service for size limits
    if (fileType !== 'audio') {
      const limitsValidation = await uploadLimitsService.validateFile(
        { size: file.size, type: file.type },
        fileType as 'image' | 'video' | 'document'
      );

      if (!limitsValidation.valid) {
        return NextResponse.json({ error: limitsValidation.error }, { status: 400 });
      }
    }

    // Generate unique file name
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${request.user.id}/${timestamp}-${random}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: _data, error: uploadError } = await supabase.storage
      .from(ADMIN_NOTES_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(ADMIN_NOTES_BUCKET).getPublicUrl(fileName);

    // Return attachment object
    const attachment = {
      type: fileType,
      url: publicUrl,
      name: file.name,
      size: file.size,
    };

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Uploaded admin note attachment',
      {
        ...extractRequestMetadata(request),
        action: 'upload_admin_note_attachment',
        resourceType: 'admin_note_attachment',
        fileType: fileType,
        fileName: file.name,
        fileSize: file.size,
      },
      true
    );

    return NextResponse.json({ attachment });
  } catch (error) {
    console.error('Error in POST /api/admin/notes/upload:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

/**
 * DELETE /api/admin/notes/upload
 * Delete a file from admin notes storage
 * Requires: manage_content permission
 */
export const DELETE = withAdminPermission('manage_content', async (request) => {
  // ✅ SECURITY: Validate CSRF token
  const csrfError = await requireCsrfToken(request);
  if (csrfError) {
    return csrfError;
  }


  try {
    const supabase = await createClient();

    // Get file path from query params
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json({ error: 'File URL is required' }, { status: 400 });
    }

    // Extract file path from URL
    const urlParts = fileUrl.split(`/${ADMIN_NOTES_BUCKET}/`);
    if (urlParts.length < 2) {
      return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 });
    }
    const filePath = urlParts[1];

    // Delete file from storage
    const { error: deleteError } = await supabase.storage
      .from(ADMIN_NOTES_BUCKET)
      .remove([filePath]);

    if (deleteError) {
      console.error('Error deleting file:', deleteError);
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    await SecurityAuditLogger.log(
      SecurityEventType.ADMIN_ACTION,
      SecurityEventSeverity.CRITICAL,
      'Deleted admin note attachment',
      {
        ...extractRequestMetadata(request),
        action: 'delete_admin_note_attachment',
        resourceType: 'admin_note_attachment',
        filePath: filePath,
      },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/notes/upload:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
})

