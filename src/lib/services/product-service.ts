import type { Product, ProductCreationInput, ProductImage } from '@/lib/models/definitions';
import { isBuildSmokeTestEnabled } from '@/lib/env/test-flags';
import type { ProductRepository } from '@/modules/products/domain/contracts/product-repository';
import {
  createProductModule,
  type ProductModule,
} from '@/modules/products/factories/product-module';
import type { ProductInventorySummary } from '@/modules/products/domain/models/product-inventory';

const createSmokeTestRepository = (): ProductRepository => ({
  async list() {
    return [];
  },
  async listFeatured() {
    return [];
  },
  async count() {
    return 0;
  },
  async getBySlug() {
    return null;
  },
  async listRelated() {
    return [];
  },
  async listRecent() {
    return [];
  },
  async create() {
    throw new Error('Product mutations are disabled during build smoke tests.');
  },
  async update() {
    throw new Error('Product mutations are disabled during build smoke tests.');
  },
  async delete() {
    throw new Error('Product mutations are disabled during build smoke tests.');
  },
  async uploadImage() {
    throw new Error('Product image uploads are disabled during build smoke tests.');
  },
  async uploadImages() {
    throw new Error('Product image uploads are disabled during build smoke tests.');
  },
  async getStockSummary(): Promise<ProductInventorySummary> {
    return { totalStock: 0, products: [] };
  },
});

const createSmokeTestModule = (): ProductModule => ({
  repository: createSmokeTestRepository(),
});

let overrideModule: ProductModule | null = null;
let defaultModule: ProductModule | null = null;
let smokeTestModule: ProductModule | null = null;

const getProductRepository = async (): Promise<ProductRepository> => {
  if (overrideModule) {
    return overrideModule.repository;
  }

  if (isBuildSmokeTestEnabled()) {
    if (!smokeTestModule) {
      smokeTestModule = createSmokeTestModule();
    }
    return smokeTestModule.repository;
  }

  if (!defaultModule) {
    defaultModule = createProductModule();
  }

  return defaultModule.repository;
};

// Allows tests or alternative bootstrapping code to provide a custom module implementation.
export const setProductModule = (module: ProductModule | null) => {
  overrideModule = module;
  if (!module) {
    return;
  }

  if (isBuildSmokeTestEnabled()) {
    smokeTestModule = module;
    return;
  }

  defaultModule = module;
};

export const getProducts = async (): Promise<Product[]> => {
  const repo = await getProductRepository();
  return repo.list();
};

export const getFeaturedProducts = async (limit?: number): Promise<Product[]> => {
  const repo = await getProductRepository();
  return repo.listFeatured(limit);
};

export const getProductsCount = async (): Promise<number> => {
  const repo = await getProductRepository();
  return repo.count();
};

export const getProductBySlug = async (slug: string): Promise<Product | null> => {
  const repo = await getProductRepository();
  return repo.getBySlug(slug);
};

export const getRelatedProducts = async (slug: string): Promise<Product[]> => {
  const repo = await getProductRepository();
  return repo.listRelated(slug);
};

export const createProduct = async (
  productData: ProductCreationInput,
): Promise<Product> => {
  const repo = await getProductRepository();
  return repo.create(productData);
};

export const updateProduct = async (
  id: string,
  productData: Partial<Omit<Product, 'id'>>,
): Promise<Product> => {
  const repo = await getProductRepository();
  return repo.update(id, productData);
};

export const deleteProduct = async (id: string): Promise<void> => {
  const repo = await getProductRepository();
  await repo.delete(id);
};

export const uploadProductImage = async (file: File, productId: string): Promise<ProductImage> => {
  const repo = await getProductRepository();
  return repo.uploadImage(file, productId);
};

export const uploadProductImages = async (files: File[], productId: string): Promise<ProductImage[]> => {
  const repo = await getProductRepository();
  return repo.uploadImages(files, productId);
};

export const getRecentProducts = async (limit: number = 5): Promise<Product[]> => {
  const repo = await getProductRepository();
  return repo.listRecent(limit);
};

export const getProductStockSummary = async (): Promise<ProductInventorySummary> => {
  const repo = await getProductRepository();
  return repo.getStockSummary();
};
