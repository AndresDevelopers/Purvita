import { supabase, getServiceRoleClient, PRODUCTS_BUCKET } from '@/lib/supabase';
import { logUserAction } from '@/lib/services/audit-log-service';
import { SupabaseProductRepository, type SupabaseProductRepositoryDependencies } from '../data/repositories/supabase-product-repository';
import type { ProductRepository } from '../domain/contracts/product-repository';
import { ProductEventBus } from '../domain/events/product-event-bus';

export interface ProductModule {
  repository: ProductRepository;
}

/**
 * Creates default dependencies for the product module using centralized client management
 */
const createDefaultDependencies = (): SupabaseProductRepositoryDependencies => {
  return {
    publicClient: supabase,
    // Avoid calling getServiceRoleClient() in the browser (it logs an error).
    // Only retrieve the service role client when running on the server.
    serviceRoleClient: typeof window === 'undefined' ? getServiceRoleClient() : null,
    componentClient: supabase,
    productsBucket: PRODUCTS_BUCKET,
    auditLogger: logUserAction,
    eventBus: new ProductEventBus(),
  };
};

/**
 * Creates a product module with dependency injection support
 * @param overrides - Optional dependency overrides for testing or customization
 * @returns ProductModule with configured repository
 */
export const createProductModule = (
  overrides: Partial<SupabaseProductRepositoryDependencies> = {},
): ProductModule => {
  const defaults = createDefaultDependencies();

  const dependencies: SupabaseProductRepositoryDependencies = {
    ...defaults,
    ...overrides,
  };

  const repository = new SupabaseProductRepository(dependencies);

  return { repository };
};
