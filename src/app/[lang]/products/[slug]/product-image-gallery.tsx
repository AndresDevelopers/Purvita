'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';
import type { ProductImage } from '@/lib/models/definitions';

interface ProductImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

const FALLBACK_IMAGE = '/placeholder-image.svg';

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const validImages = images.length > 0 ? images : [{ id: 'fallback', url: FALLBACK_IMAGE, hint: productName, isFeatured: true }];
  
  const featuredImage = validImages.find(img => img.isFeatured) || validImages[0];
  const [selectedImage, setSelectedImage] = useState(featuredImage);

  return (
    <div className="relative flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-6 shadow-lg dark:from-emerald-950/80 dark:via-emerald-900/40 dark:to-emerald-950/60">
        <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-white shadow-inner dark:bg-emerald-950/60">
          <Image
            src={selectedImage.url}
            alt={selectedImage.hint || productName}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 40vw"
            className="object-contain transition-transform duration-700 ease-out group-hover:scale-105"
            priority
          />
          {selectedImage.isFeatured && (
            <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg">
              <Star className="h-3.5 w-3.5 fill-white" />
              Principal
            </div>
          )}
        </div>
      </div>

      {validImages.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {validImages.map((image, index) => (
            <button
              key={`${image.id}-${index}`}
              type="button"
              onClick={() => setSelectedImage(image)}
              className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                selectedImage.id === image.id
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105'
                  : 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-800 dark:hover:border-emerald-600'
              }`}
            >
              <div className="relative h-full w-full bg-white dark:bg-emerald-950/60">
                <Image
                  src={image.url}
                  alt={image.hint || `${productName} - imagen ${index + 1}`}
                  fill
                  sizes="120px"
                  className="object-contain transition-transform duration-300 group-hover:scale-110"
                />
                {image.isFeatured && (
                  <div className="absolute top-1 right-1 bg-yellow-500 rounded-full p-1">
                    <Star className="h-2.5 w-2.5 fill-white text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
