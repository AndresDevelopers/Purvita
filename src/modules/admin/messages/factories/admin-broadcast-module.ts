import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAdminBroadcastRepository } from '../data/repositories/supabase-admin-broadcast-repository';
import type { AdminBroadcastRepository } from '../domain/contracts/admin-broadcast-repository';
import { AdminBroadcastService } from '../services/admin-broadcast-service';
import type { AdminBroadcastServiceDependencies } from '../services/admin-broadcast-service';

export interface AdminBroadcastModule {
  repository: AdminBroadcastRepository;
  service: AdminBroadcastService;
}

export interface AdminBroadcastModuleDependencies {
  client: SupabaseClient;
  brandName: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  emailSender?: AdminBroadcastServiceDependencies['emailSender'];
}

export const createAdminBroadcastModule = (
  deps: AdminBroadcastModuleDependencies,
): AdminBroadcastModule => {
  const repository = new SupabaseAdminBroadcastRepository({ client: deps.client });

  const service = new AdminBroadcastService({
    repository,
    environment: {
      brandName: deps.brandName,
      fromName: deps.fromName ?? null,
      fromEmail: deps.fromEmail ?? null,
      replyTo: deps.replyTo ?? null,
    },
    emailSender: deps.emailSender,
  });

  return { repository, service };
};

