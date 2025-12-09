import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleClient, supabase } from '@/lib/supabase';
import type { TutorialRepository } from '../domain/contracts/tutorial-repository';
import type { UserTutorialProgressRepository } from '../domain/contracts/user-tutorial-progress-repository';
import { SupabaseTutorialRepository } from '../data/repositories/supabase-tutorial-repository';
import { SupabaseUserTutorialProgressRepository } from '../data/repositories/supabase-user-tutorial-progress-repository';

export interface TutorialModule {
  tutorialRepository: TutorialRepository;
  progressRepository: UserTutorialProgressRepository;
}

export interface CreateTutorialModuleOverrides {
  adminClient?: SupabaseClient;
}

export const createTutorialModule = (
  overrides: CreateTutorialModuleOverrides = {},
): TutorialModule => {
  const adminClient = overrides.adminClient ?? getServiceRoleClient() ?? supabase;

  const tutorialRepository = new SupabaseTutorialRepository({
    adminClient,
  });

  const progressRepository = new SupabaseUserTutorialProgressRepository({
    adminClient,
  });

  return {
    tutorialRepository,
    progressRepository,
  };
};