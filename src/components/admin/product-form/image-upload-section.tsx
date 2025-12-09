'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Star } from 'lucide-react';
import type { ProductImage } from '@/lib/models/definitions';

const ACCEPTED_IMAGE_TYPES = 'image/*';
const _IMAGE_GRID_BREAKPOINTS = {
  base: 2,
  sm: 3,
  md: 4,
  lg: 5,
} as const;

interface ImageUploadSectionProps {
  product?: { images?: ProductImage[] };
  selectedFiles: File[];
  existingImages: ProductImage[];
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onRemoveExistingImage: (index: number) => void;
  onSetFeaturedImage: (index: number) => void;
  onClearFiles: () => void;
}

export function ImageUploadSection({
  product,
  selectedFiles,
  existingImages,
  onFileSelect,
  onRemoveFile,
  onRemoveExistingImage,
  onSetFeaturedImage,
  onClearFiles,
}: ImageUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onClearFiles();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Imágenes del producto</Label>
        <p id="image-upload-help" className="text-sm text-muted-foreground">
          {product
            ? 'Agrega nuevas imágenes o visualiza las existentes. Las nuevas imágenes se agregarán al guardar.'
            : 'Selecciona las imágenes para el producto.'}
        </p>
      </div>

      {/* Upload Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            id="images"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            onChange={onFileSelect}
            className="flex-1"
            aria-describedby="image-upload-help"
          />
          {selectedFiles.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>
              Limpiar
            </Button>
          )}
        </div>

        {/* Preview of selected files */}
        {selectedFiles.length > 0 && (
          <NewImagesPreview files={selectedFiles} onRemove={onRemoveFile} />
        )}
      </div>

      {/* Existing images */}
      {existingImages.length > 0 && (
        <ExistingImagesGrid
          images={existingImages}
          originalCount={product?.images?.length ?? 0}
          onRemove={onRemoveExistingImage}
          onSetFeatured={onSetFeaturedImage}
        />
      )}

      {!product?.images?.length && selectedFiles.length === 0 && <EmptyImageState />}
    </div>
  );
}

function NewImagesPreview({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  // Create object URLs and clean them up on unmount
  const fileUrls = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => {
      fileUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [fileUrls]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-green-700 dark:text-green-400">
          Nuevas imágenes ({files.length})
        </Label>
        <span className="text-xs text-muted-foreground">Se agregarán al guardar</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {files.map((file, index) => (
          <div
            key={index}
            className="group relative aspect-square rounded-lg border-2 border-green-200 dark:border-green-800 overflow-hidden bg-green-50 dark:bg-green-950/20"
          >
            <Image src={fileUrls[index]} alt={file.name} fill className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white truncate">{file.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExistingImagesGrid({
  images,
  originalCount,
  onRemove,
  onSetFeatured,
}: {
  images: ProductImage[];
  originalCount: number;
  onRemove: (index: number) => void;
  onSetFeatured: (index: number) => void;
}) {
  return (
    <div className="space-y-2 pt-3 border-t">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Imágenes actuales ({images.length})</Label>
          <p className="text-xs text-muted-foreground">Click en la estrella para marcar como imagen principal</p>
        </div>
        {originalCount > 0 && images.length !== originalCount && (
          <span className="text-xs text-orange-600 dark:text-orange-400">
            {originalCount - images.length} eliminada(s)
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {images.map((image, index) => (
          <ImageCard
            key={`${image.id}-${index}`}
            image={image}
            index={index}
            onRemove={onRemove}
            onSetFeatured={onSetFeatured}
          />
        ))}
      </div>
    </div>
  );
}

function ImageCard({
  image,
  index,
  onRemove,
  onSetFeatured,
}: {
  image: ProductImage;
  index: number;
  onRemove: (index: number) => void;
  onSetFeatured: (index: number) => void;
}) {
  return (
    <div
      className={`group relative aspect-square rounded-lg border-2 overflow-hidden bg-muted transition-all ${
        image.isFeatured
          ? 'border-yellow-400 dark:border-yellow-500 ring-2 ring-yellow-400/50'
          : 'border-transparent hover:border-gray-300'
      }`}
    >
      <Image src={image.url} alt={image.hint || `Imagen ${index + 1}`} fill className="object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

      {/* Featured badge */}
      {image.isFeatured && (
        <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
          <Star className="h-3 w-3 fill-white" />
          Principal
        </div>
      )}

      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          type="button"
          variant={image.isFeatured ? 'default' : 'secondary'}
          size="icon"
          className={`h-7 w-7 ${image.isFeatured ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}
          onClick={() => onSetFeatured(index)}
          title="Marcar como imagen principal"
        >
          <Star className={`h-4 w-4 ${image.isFeatured ? 'fill-white' : ''}`} />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="h-7 w-7"
          onClick={() => onRemove(index)}
          title="Eliminar imagen"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {image.hint && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-xs text-white truncate">{image.hint}</p>
        </div>
      )}
    </div>
  );
}

function EmptyImageState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
      <PlusCircle className="h-10 w-10 text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">No hay imágenes seleccionadas</p>
      <p className="text-xs text-muted-foreground mt-1">Selecciona archivos para comenzar</p>
    </div>
  );
}
import Image from 'next/image';
