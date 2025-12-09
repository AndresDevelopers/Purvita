import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { CheckoutRepository } from '../domain/contracts/checkout-repository';
import { SupabaseCheckoutRepository } from '../data/repositories/supabase-checkout-repository';
import { CheckoutEventBus } from '../domain/events/checkout-event-bus';

export interface CheckoutModule {
  repository: CheckoutRepository;
  eventBus: CheckoutEventBus;
}

export interface CheckoutModuleOverrides {
  client?: SupabaseClient;
  repository?: CheckoutRepository;
  eventBus?: CheckoutEventBus;
}

export const createCheckoutModule = (
  overrides: CheckoutModuleOverrides = {},
): CheckoutModule => {
  if (overrides.repository && overrides.eventBus) {
    return {
      repository: overrides.repository,
      eventBus: overrides.eventBus,
    };
  }

  const client = overrides.client ?? supabase;
  const repository =
    overrides.repository ??
    new SupabaseCheckoutRepository({
      client,
    });

  const eventBus = overrides.eventBus ?? new CheckoutEventBus();

  return {
    repository,
    eventBus,
  };
};
