import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ProductSchema,
  type Product,
  type ProductCreationInput,
  type ProductImage,
} from '@/lib/models/definitions';
import type { ProductRepository } from '../../domain/contracts/product-repository';
import { ProductEventBus, type ProductEvent } from '../../domain/events/product-event-bus';
import { retryWithBackoff, CircuitBreaker } from '@/lib/utils';
import type { ProductInventorySummary } from '../../domain/models/product-inventory';

type SupabaseError = { code?: string; message?: string } | null;

const isMissingFeaturedColumn = (error: SupabaseError) => {
  return Boolean(error?.code === '42703' && error?.message?.includes('is_featured'));
};

const missingFeaturedColumnMessage =
  'Supabase reports that the "is_featured" column is missing on the products table. ' +
  'Add it with ALTER TABLE products ADD COLUMN is_featured boolean DEFAULT false; to enable the featured carousel.';

const isMissingExperienceColumn = (error: SupabaseError) => {
  return Boolean(error?.code === '42703' && error?.message?.includes('experience'));
};

const missingExperienceColumnMessage =
  'Supabase reports that the "experience" column is missing on the products table. ' +
  "Add it with ALTER TABLE products ADD COLUMN experience jsonb DEFAULT '{}'::jsonb; to store curated product content.";

const isMissingDiscountColumn = (error: SupabaseError) => {
  const message = error?.message;

  if (error?.code !== '42703' || typeof message !== 'string') {
    return false;
  }

  return ['discount_type', 'discount_value', 'discount_label'].some((column) =>
    message.includes(column),
  );
};

const missingDiscountColumnMessage =
  'Supabase reports that the discount columns are missing on the products table. ' +
  'Run docs/migrations/20250330_add_product_discounts.sql to add discount_type, discount_value and discount_label.';

const isMissingCartVisibilityColumn = (error: SupabaseError) => {
  return Boolean(error?.code === '42703' && error?.message?.includes('cart_visibility_countries'));
};

const missingCartVisibilityColumnMessage =
  'Supabase reports that the "cart_visibility_countries" column is missing on the products table. ' +
  'Run docs/migrations/20250418_add_product_cart_visibility_countries.sql to enable per-country cart controls.';

export interface SupabaseProductRepositoryDependencies {
  publicClient: SupabaseClient;
  serviceRoleClient: SupabaseClient | null;
  componentClient: SupabaseClient;
  productsBucket: string;
  auditLogger: (action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) => Promise<void>;
  eventBus: ProductEventBus;
}

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly deps: SupabaseProductRepositoryDependencies) { }

  private circuitBreaker = new CircuitBreaker();

  private getReadClient(): SupabaseClient {
    if (typeof window !== 'undefined' || !this.deps.serviceRoleClient) {
      return this.deps.publicClient;
    }

    return this.deps.serviceRoleClient;
  }

  private async executeWithResilience<T>(fn: () => T): Promise<T> {
    const result = fn();
    return this.circuitBreaker.execute(() => retryWithBackoff(() => Promise.resolve(result)));
  }

  private emit(event: ProductEvent) {
    this.deps.eventBus.emit(event);
  }

  async list(): Promise<Product[]> {
    const readClient = this.getReadClient();
    const { data, error } = await this.executeWithResilience(() => readClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false }));

    if (error) {
      if (isMissingDiscountColumn(error)) {
        console.warn(missingDiscountColumnMessage);
        return [];
      }
      if (isMissingCartVisibilityColumn(error)) {
        console.warn(missingCartVisibilityColumnMessage);
        return [];
      }
      throw new Error(`Error fetching products: ${error.message}`);
    }

    return this.parseProducts(data);
  }

  async listFeatured(limit?: number): Promise<Product[]> {
    const client = this.deps.serviceRoleClient ?? this.deps.publicClient;

    let query = client
      .from('products')
      .select('*')
      .eq('is_featured', true)
      .order('updated_at', { ascending: false });

    if (typeof limit === 'number') {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingFeaturedColumn(error)) {
        console.warn(missingFeaturedColumnMessage);
        return [];
      }
      if (isMissingDiscountColumn(error)) {
        console.warn(missingDiscountColumnMessage);
        return [];
      }
      if (isMissingCartVisibilityColumn(error)) {
        console.warn(missingCartVisibilityColumnMessage);
        return [];
      }
      throw new Error(`Error fetching featured products: ${error.message}`);
    }

    return this.parseProducts(data);
  }

  async count(): Promise<number> {
    const readClient = this.getReadClient();
    const { count, error } = await this.executeWithResilience(() => readClient
      .from('products')
      .select('*', { count: 'exact', head: true }));

    if (error) {
      if (isMissingDiscountColumn(error)) {
        console.warn(missingDiscountColumnMessage);
        return 0;
      }
      if (isMissingCartVisibilityColumn(error)) {
        console.warn(missingCartVisibilityColumnMessage);
        return 0;
      }
      throw new Error(`Error fetching products count: ${error.message}`);
    }

    return count ?? 0;
  }

  async getBySlug(slug: string): Promise<Product | null> {
    const client = this.deps.serviceRoleClient ?? this.deps.componentClient;
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      if (isMissingDiscountColumn(error)) {
        console.warn(missingDiscountColumnMessage);
        return null;
      }
      if (isMissingCartVisibilityColumn(error)) {
        console.warn(missingCartVisibilityColumnMessage);
        return null;
      }
      throw new Error(`Error fetching product: ${error.message}`);
    }

    return ProductSchema.parse(data);
  }

  async listRelated(baseSlug: string): Promise<Product[]> {
    const readClient = this.getReadClient();

    // Get the base product to check if it has configured related products
    const { data: baseProduct, error: baseError } = await readClient
      .from('products')
      .select('related_product_ids')
      .eq('slug', baseSlug)
      .single();

    if (baseError) {
      console.warn(`Error fetching base product for related products: ${baseError.message}`);
      return [];
    }

    // Only show related products if admin has explicitly configured them
    // If no related_product_ids are configured, return empty array (section won't show)
    if (!baseProduct?.related_product_ids || !Array.isArray(baseProduct.related_product_ids) || baseProduct.related_product_ids.length === 0) {
      return [];
    }

    const { data, error } = await readClient
      .from('products')
      .select('*')
      .in('id', baseProduct.related_product_ids);

    if (error) {
      if (isMissingCartVisibilityColumn(error)) {
        console.warn(missingCartVisibilityColumnMessage);
        return [];
      }
      console.warn(`Error fetching configured related products: ${error.message}`);
      return [];
    }

    // Return products in the order they were configured by admin
    const productsMap = new Map(this.parseProducts(data).map(p => [p.id, p]));
    const orderedProducts: Product[] = [];
    for (const id of baseProduct.related_product_ids) {
      const product = productsMap.get(id);
      if (product) {
        orderedProducts.push(product);
      }
    }
    return orderedProducts;
  }

  async listRecent(limit: number = 5): Promise<Product[]> {
    const readClient = this.getReadClient();
    const { data, error } = await readClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingCartVisibilityColumn(error)) {
        console.warn(missingCartVisibilityColumnMessage);
        return [];
      }
      throw new Error(`Error fetching recent products: ${error.message}`);
    }

    return this.parseProducts(data);
  }

  async create(product: ProductCreationInput): Promise<Product> {
    const normalizedProduct: ProductCreationInput = {
      ...product,
      cart_visibility_countries: product.cart_visibility_countries ?? [],
    };

    const { data, error } = await this.executeWithResilience(() => this.deps.componentClient
      .from('products')
      .insert([normalizedProduct])
      .select()
      .single());

    if (error) {
      if (isMissingFeaturedColumn(error)) {
        throw new Error(missingFeaturedColumnMessage);
      }
      if (isMissingExperienceColumn(error)) {
        throw new Error(missingExperienceColumnMessage);
      }
      if (isMissingDiscountColumn(error)) {
        throw new Error(missingDiscountColumnMessage);
      }
      if (isMissingCartVisibilityColumn(error)) {
        throw new Error(missingCartVisibilityColumnMessage);
      }
      throw new Error(`Error creating product: ${error.message}`);
    }

    const parsed = ProductSchema.parse(data);

    await this.deps.auditLogger('PRODUCT_CREATED', 'product', parsed.id, {
      name: parsed.name,
      slug: parsed.slug,
      price: parsed.price,
      stock: parsed.stock_quantity,
    });

    return parsed;
  }

  async update(id: string, updates: Partial<Omit<Product, 'id'>>): Promise<Product> {
    // First check if the product exists
    const { data: existingProduct, error: fetchError } = await this.deps.componentClient
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error(`Product with ID ${id} not found`);
      }
      throw new Error(`Error fetching current product: ${fetchError.message}`);
    }

    // Get current product images for comparison (before update)
    const currentImages = existingProduct?.images || [];

    // Update the product
    const { data: updateData, error } = await this.deps.componentClient
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (isMissingFeaturedColumn(error)) {
        throw new Error(missingFeaturedColumnMessage);
      }
      if (isMissingExperienceColumn(error)) {
        throw new Error(missingExperienceColumnMessage);
      }
      if (isMissingDiscountColumn(error)) {
        throw new Error(missingDiscountColumnMessage);
      }
      if (isMissingCartVisibilityColumn(error)) {
        throw new Error(missingCartVisibilityColumnMessage);
      }

      // Handle specific Supabase errors
      if (error.message?.includes('Cannot coerce the result to a single JSON object')) {
        // This error can happen when the update doesn't return a single record
        // Let's try to fetch the product again to verify the update worked
        const { data: verifyData, error: verifyError } = await this.deps.componentClient
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (verifyError) {
          throw new Error(`Error updating product: ${error.message}`);
        }

        if (!verifyData) {
          throw new Error(`Product with ID ${id} not found after update`);
        }

        const parsed = ProductSchema.parse(verifyData);

        // Continue with the rest of the update logic
        await this.processImageChanges(id, currentImages, updates.images);

        await this.deps.auditLogger('PRODUCT_UPDATED', 'product', parsed.id, {
          name: parsed.name,
          slug: parsed.slug,
          price: parsed.price,
          stock: parsed.stock_quantity,
          updatedFields: Object.keys(updates ?? {}),
        });

        return parsed;
      }

      throw new Error(`Error updating product: ${error.message}`);
    }

    if (!updateData) {
      // This is the original "Cannot coerce" error fallback
      throw new Error(`No data returned after updating product ${id}. This might be due to the update affecting 0 rows or constraint violations.`);
    }

    const parsed = ProductSchema.parse(updateData);

    // Process image changes (delete old images that are no longer needed)
    await this.processImageChanges(id, currentImages, updates.images);

    await this.deps.auditLogger('PRODUCT_UPDATED', 'product', parsed.id, {
      name: parsed.name,
      slug: parsed.slug,
      price: parsed.price,
      stock: parsed.stock_quantity,
      updatedFields: Object.keys(updates ?? {}),
    });

    return parsed;
  }

  private async processImageChanges(productId: string, currentImages: ProductImage[], updatedImages?: ProductImage[]) {
    // Delete old images that are no longer in the updated product
    if (currentImages && Array.isArray(currentImages) && updatedImages) {
      const currentImageIds = new Set(currentImages.map((img: { id: string }) => img.id));
      const newImageIds = new Set(updatedImages.map(img => img.id));
      const imagesToDelete = Array.from(currentImageIds).filter(id => !newImageIds.has(id));

      if (imagesToDelete.length > 0) {
        try {
          await this.deleteImages(imagesToDelete);
        } catch (imageError) {
          console.warn(`Failed to delete old images for product ${productId}:`, imageError);
          // Continue with update even if image deletion fails
        }
      }
    }
  }

  async delete(id: string): Promise<void> {
    const { data: productData, error: fetchError } = await this.deps.componentClient
      .from('products')
      .select('name, slug, price, images, stock_quantity')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Error fetching product for deletion: ${fetchError.message}`);
    }

    // Delete images from storage if product exists
    if (productData?.images && Array.isArray(productData.images)) {
      const imagePaths = productData.images.map((img: { id: string }) => img.id).filter(Boolean);
      if (imagePaths.length > 0) {
        try {
          await this.deleteImages(imagePaths);
        } catch (imageError) {
          console.warn(`Failed to delete images for product ${id}:`, imageError);
          // Continue with product deletion even if image deletion fails
        }
      }
    }

    const { error } = await this.deps.componentClient
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting product: ${error.message}`);
    }

    const metadata = productData
      ? {
        name: productData.name,
        slug: productData.slug,
        price: productData.price,
        stock: productData.stock_quantity,
      }
      : { productId: id };

    await this.deps.auditLogger('PRODUCT_DELETED', 'product', id, metadata);
  }

  async uploadImage(file: File, productId: string): Promise<ProductImage> {
    // ✅ SECURITY: Validate file before upload
    const { validateImageFile, sanitizeFilename } = await import('@/lib/security/file-validation');
    const validation = await validateImageFile(file);

    if (!validation.valid) {
      // Log rejected upload
      const { SecurityLogger } = await import('@/lib/security/security-logger');
      await SecurityLogger.logFileUploadRejected({
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        reason: validation.error || 'Unknown error'
      });

      throw new Error(`File validation failed: ${validation.error}`);
    }

    // Use MIME type for extension, not filename
    const fileExt = file.type.split('/')[1] || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedName = sanitizeFilename(file.name);
    const fileName = `${productId}/${timestamp}-${random}.${fileExt}`;

    const storage = this.deps.componentClient.storage.from(this.deps.productsBucket);
    const { data, error } = await storage.upload(fileName, file, {
      upsert: false,
      contentType: file.type, // Explicitly set content type
    });

    if (error) {
      if (error.message.includes('Bucket not found')) {
        throw new Error(
          `Error: El bucket "${this.deps.productsBucket}" no existe en Supabase Storage. Por favor, crea el bucket siguiendo las instrucciones en README_SUPABASE_SETUP.md`,
        );
      }
      throw new Error(`Error uploading image: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = storage.getPublicUrl(fileName);

    return {
      id: data.path,
      url: publicUrl,
      hint: sanitizedName,
    };
  }

  async uploadImages(files: File[], productId: string): Promise<ProductImage[]> {
    const uploads = files.map((file) => this.uploadImage(file, productId));
    return Promise.all(uploads);
  }

  async getStockSummary(): Promise<ProductInventorySummary> {
    const readClient = this.getReadClient();
    const { data, error } = await readClient
      .from('products')
      .select('id, name, stock_quantity')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error fetching product stock summary: ${error.message}`);
    }

    const products = (data ?? []).map((record: Record<string, unknown>) => {
      const rawQuantity = record?.stock_quantity;
      const quantity = typeof rawQuantity === 'number' ? rawQuantity : Number(rawQuantity ?? 0);
      return {
        id: String(record.id),
        name: String(record.name ?? 'Unnamed product'),
        stockQuantity: Number.isNaN(quantity) ? 0 : Math.max(0, quantity),
      };
    });

    const totalStock = products.reduce((sum, item) => sum + item.stockQuantity, 0);

    return { totalStock, products };
  }

  async deleteImage(imagePath: string): Promise<void> {
    const storage = this.deps.componentClient.storage.from(this.deps.productsBucket);
    const { error } = await storage.remove([imagePath]);

    if (error) {
      throw new Error(`Error deleting image: ${error.message}`);
    }
  }

  async deleteImages(imagePaths: string[]): Promise<void> {
    if (imagePaths.length === 0) return;

    const storage = this.deps.componentClient.storage.from(this.deps.productsBucket);
    const { error } = await storage.remove(imagePaths);

    if (error) {
      throw new Error(`Error deleting images: ${error.message}`);
    }
  }

  private parseProducts(data: unknown[] | null | undefined): Product[] {
    return (data ?? []).map((item) => ProductSchema.parse(item));
  }
}
