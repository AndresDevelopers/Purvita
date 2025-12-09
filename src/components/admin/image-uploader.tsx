'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { Upload, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, PAGE_BUCKET } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useUploadLimits } from '@/modules/upload';

interface ImageUploaderProps {
    /**
     * Current image URL value
     */
    value: string;

    /**
     * Callback when the image URL changes (either from upload or manual input)
     */
    onChange: (url: string) => void;

    /**
     * Label for the input field
     */
    label?: string;

    /**
     * Placeholder text for the URL input
     */
    placeholder?: string;

    /**
     * Prefix for the uploaded file name (e.g., 'testimonial', 'tutorial-step')
     */
    filePrefix: string;

    /**
     * Optional ID for the input element
     */
    id?: string;

    /**
     * Whether the uploader is disabled
     */
    disabled?: boolean;

    /**
     * Show preview of the image
     */
    showPreview?: boolean;

    /**
     * Custom class name for the container
     */
    className?: string;

    /**
     * Accept specific image types (default: 'image/*')
     */
    accept?: string;

    /**
     * Show URL input field (default: true)
     */
    showUrlInput?: boolean;

    /**
     * Show size limit hint below the uploader (default: true)
     */
    showSizeHint?: boolean;

    /**
     * Custom hint text (overrides dynamic limit text)
     */
    hintText?: string;
}

export function ImageUploader({
    value,
    onChange,
    label,
    placeholder = 'https://ejemplo.com/imagen.jpg',
    filePrefix,
    id,
    disabled = false,
    showPreview = true,
    className = '',
    accept = 'image/*',
    showUrlInput = true,
    showSizeHint = true,
    hintText,
}: ImageUploaderProps) {
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const { limits: _limits, validateImageSize, getImageLimitText } = useUploadLimits();

    const uploadFile = useCallback(
        async (file: File) => {
            setUploading(true);
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${filePrefix}-${Date.now()}.${fileExt}`;

                const { data: _data, error } = await supabase.storage
                    .from(PAGE_BUCKET)
                    .upload(fileName, file);

                if (error) throw error;

                const {
                    data: { publicUrl },
                } = supabase.storage.from(PAGE_BUCKET).getPublicUrl(fileName);

                onChange(publicUrl);

                toast({
                    title: 'Imagen subida',
                    description: 'La imagen se subió correctamente.',
                });
            } catch (err) {
                console.error('Error uploading image:', err);
                toast({
                    title: 'Error al subir imagen',
                    description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
                    variant: 'destructive',
                });
            } finally {
                setUploading(false);
            }
        },
        [filePrefix, onChange, toast]
    );

    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) {
                // Validar tamaño antes de subir
                const validation = validateImageSize(file);
                if (!validation.valid) {
                    toast({
                        title: 'Archivo muy grande',
                        description: validation.error,
                        variant: 'destructive',
                    });
                    event.target.value = '';
                    return;
                }
                uploadFile(file);
            }
            // Reset the input so the same file can be selected again
            event.target.value = '';
        },
        [uploadFile, validateImageSize, toast]
    );

    const handleClearImage = useCallback(() => {
        onChange('');
    }, [onChange]);

    const inputId = id || `image-uploader-${filePrefix}`;
    const fileInputId = `${inputId}-file`;

    return (
        <div className={`space-y-3 ${className}`}>
            {label && <Label htmlFor={inputId}>{label}</Label>}

            <div className="flex gap-2">
                {/* Upload Button */}
                <div className="flex-shrink-0">
                    <Label
                        htmlFor={fileInputId}
                        className={`inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Subiendo...
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Subir imagen
                            </>
                        )}
                    </Label>
                    <Input
                        id={fileInputId}
                        type="file"
                        accept={accept}
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={disabled || uploading}
                    />
                </div>

                {/* URL Input (optional) */}
                {showUrlInput && (
                    <div className="flex-1 flex gap-2">
                        <Input
                            id={inputId}
                            type="url"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            disabled={disabled || uploading}
                            className="flex-1"
                        />
                        {value && !disabled && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleClearImage}
                                disabled={uploading}
                                title="Limpiar imagen"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Preview */}
            {showPreview && value && (
                <div className="relative mt-2 w-full max-w-xs overflow-hidden rounded-lg border bg-muted">
                    <div className="relative h-48 w-full">
                        <Image
                            src={value}
                            alt="Preview"
                            fill
                            sizes="(max-width: 640px) 100vw, 320px"
                            className="object-contain"
                        />
                    </div>
                </div>
            )}

            {/* Size hint */}
            {showSizeHint && (
                <p className="text-xs text-muted-foreground">
                    {hintText || getImageLimitText()}
                </p>
            )}
        </div>
    );
}
