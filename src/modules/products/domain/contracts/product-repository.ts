import type { Product, ProductCreationInput, ProductImage } from '@/lib/models/definitions';
import type { ProductInventorySummary } from '../models/product-inventory';

export interface ProductRepository {
  list(): Promise<Product[]>;
  listFeatured(limit?: number): Promise<Product[]>;
  count(): Promise<number>;
  getBySlug(slug: string): Promise<Product | null>;
  listRelated(baseSlug: string): Promise<Product[]>;
  listRecent(limit?: number): Promise<Product[]>;
  create(product: ProductCreationInput): Promise<Product>;
  update(id: string, updates: Partial<Omit<Product, 'id'>>): Promise<Product>;
  delete(id: string): Promise<void>;
  uploadImage(file: File, productId: string): Promise<ProductImage>;
  uploadImages(files: File[], productId: string): Promise<ProductImage[]>;
  getStockSummary(): Promise<ProductInventorySummary>;
}
