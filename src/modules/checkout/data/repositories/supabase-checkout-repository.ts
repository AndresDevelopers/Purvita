import type { SupabaseClient } from '@supabase/supabase-js';
import type { CheckoutRepository } from '../../domain/contracts/checkout-repository';
import {
  CheckoutProfileSchema,
  CheckoutProfileUpdateSchema,
  type CheckoutProfile,
  type CheckoutProfileUpdateInput,
} from '../../domain/models/checkout-profile';

interface SupabaseCheckoutRepositoryDependencies {
  client: SupabaseClient;
}

const toNullable = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class SupabaseCheckoutRepository implements CheckoutRepository {
  constructor(private readonly deps: SupabaseCheckoutRepositoryDependencies) {}

  private async getUserId(): Promise<string | null> {
    const { data, error } = await this.deps.client.auth.getUser();

    if (error) {
      if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
        return null;
      }
      throw new Error(`Error fetching authenticated user: ${error.message}`);
    }

    return data.user?.id ?? null;
  }

  async getCurrentProfile(): Promise<CheckoutProfile | null> {
    const userId = await this.getUserId();

    if (!userId) {
      return null;
    }

    const { data, error } = await this.deps.client
      .from('profiles')
      .select(
        'id, name, address, city, state, postal_code, country, phone, default_payment_provider, updated_at',
      )
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching checkout profile: ${error.message}`);
    }

    const profile = CheckoutProfileSchema.parse({
      id: data.id,
      fullName: data.name ?? '',
      addressLine1: data.address ?? '',
      city: data.city ?? '',
      state: data.state ?? '',
      postalCode: data.postal_code ?? '',
      country: data.country ?? '',
      phone: data.phone ?? '',
      paymentProvider: data.default_payment_provider ?? null,
      updatedAt: data.updated_at ?? new Date().toISOString(),
    });

    return profile;
  }

  async saveProfile(input: CheckoutProfileUpdateInput): Promise<CheckoutProfile> {
    const userId = await this.getUserId();

    if (!userId) {
      throw new Error('User is not authenticated. Please sign in again.');
    }

    const payload = CheckoutProfileUpdateSchema.parse(input);
    const normalizedProvider = payload.paymentProvider ? payload.paymentProvider.toLowerCase() : null;

    const { data, error } = await this.deps.client
      .from('profiles')
      .update({
        name: payload.fullName.trim(),
        address: payload.addressLine1.trim(),
        city: payload.city.trim(),
        state: toNullable(payload.state),
        postal_code: toNullable(payload.postalCode),
        country: payload.country.trim(),
        phone: toNullable(payload.phone),
        default_payment_provider: normalizedProvider,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, name, address, city, state, postal_code, country, phone, default_payment_provider, updated_at')
      .single();

    if (error) {
      throw new Error(`Unable to save checkout profile: ${error.message}`);
    }

    return CheckoutProfileSchema.parse({
      id: data.id,
      fullName: data.name ?? payload.fullName,
      addressLine1: data.address ?? payload.addressLine1,
      city: data.city ?? payload.city,
      state: data.state ?? payload.state ?? '',
      postalCode: data.postal_code ?? payload.postalCode ?? '',
      country: data.country ?? payload.country,
      phone: data.phone ?? payload.phone ?? '',
      paymentProvider: data.default_payment_provider ?? normalizedProvider,
      updatedAt: data.updated_at ?? new Date().toISOString(),
    });
  }
}
