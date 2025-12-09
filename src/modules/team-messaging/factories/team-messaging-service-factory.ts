import { getSupabaseAdminClient } from '@/modules/multilevel/infrastructure/supabase-admin-client';
import { createTreeService } from '@/modules/multilevel/factories/tree-service-factory';
import { SupabaseTeamMessageRepository } from '../data/repositories/supabase-team-message-repository';
import { TeamMessagingService } from '../services/team-messaging-service';

export const createTeamMessagingService = () => {
  const client = getSupabaseAdminClient();
  const repository = new SupabaseTeamMessageRepository({ client });
  const treeService = createTreeService();
  return new TeamMessagingService(repository, treeService);
};
