import type { ProductImage } from '@/lib/models/definitions';

export interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: number;
  stockQuantity: number;
  isFeatured: boolean;
}

/**
 * Extracts and validates product form data from FormData
 */
export function extractProductFormData(formData: FormData): ProductFormData {
  const name = formData.get('name') as string;
  const slug = formData.get('slug') as string;
  const description = formData.get('description') as string;
  const price = parseFloat(formData.get('price') as string);
  const stockQuantity = Math.max(0, Number.parseInt(formData.get('stock_quantity') as string, 10) || 0);
  const isFeatured = formData.get('is_featured') === 'true';

  return {
    name,
    slug,
    description,
    price,
    stockQuantity,
    isFeatured,
  };
}

/**
 * Generates a unique client-side ID
 */
export function createClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

/**
 * Merges existing and newly uploaded images
 */
export function mergeProductImages(
  existingImages: ProductImage[],
  uploadedImages: ProductImage[]
): ProductImage[] {
  return [...existingImages, ...uploadedImages];
}

/**
 * Validates that at least one image is marked as featured
 * If none are featured, marks the first image as featured
 */
export function ensureFeaturedImage(images: ProductImage[]): ProductImage[] {
  if (images.length === 0) {
    return images;
  }

  const hasFeatured = images.some((img) => img.isFeatured);

  if (!hasFeatured) {
    return images.map((img, index) => ({
      ...img,
      isFeatured: index === 0,
    }));
  }

  return images;
}
