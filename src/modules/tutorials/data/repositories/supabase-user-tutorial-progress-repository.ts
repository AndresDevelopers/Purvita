import type { SupabaseClient } from '@supabase/supabase-js';
import {
  UserTutorialProgressSchema,
  UserTutorialProgressCreateSchema,
  UserTutorialStatusSchema,
  type UserTutorialProgress,
  type UserTutorialProgressCreateInput,
  type UserTutorialStatus,
} from '../../domain/models/user-tutorial-progress';
import type { UserTutorialProgressRepository } from '../../domain/contracts/user-tutorial-progress-repository';

interface SupabaseUserTutorialProgressRepositoryDependencies {
  adminClient: SupabaseClient | null;
}

type DbUserTutorialProgressRow = {
  user_id: string;
  tutorial_id: string;
  current_step: number;
  completed: boolean;
  skipped: boolean;
  completed_at: string | null;
  skipped_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbUserTutorialStatusRow = {
  tutorial_id: string;
  title: string;
  description: string | null;
  current_step: number;
  total_steps: number;
  completed: boolean;
  skipped: boolean;
  show_tutorial: boolean;
};

const mapRowToUserTutorialProgress = (row: DbUserTutorialProgressRow): UserTutorialProgress => {
  return UserTutorialProgressSchema.parse({
    user_id: row.user_id,
    tutorial_id: row.tutorial_id,
    current_step: row.current_step,
    completed: row.completed,
    skipped: row.skipped,
    completed_at: row.completed_at,
    skipped_at: row.skipped_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
};

const mapRowToUserTutorialStatus = (row: DbUserTutorialStatusRow): UserTutorialStatus => {
  return UserTutorialStatusSchema.parse({
    tutorial_id: row.tutorial_id,
    title: row.title,
    description: row.description,
    current_step: row.current_step,
    total_steps: row.total_steps,
    completed: row.completed,
    skipped: row.skipped,
    show_tutorial: row.show_tutorial,
  });
};

export class SupabaseUserTutorialProgressRepository implements UserTutorialProgressRepository {
  constructor(private readonly deps: SupabaseUserTutorialProgressRepositoryDependencies) {}

  private get client(): SupabaseClient {
    if (!this.deps.adminClient) {
      throw new Error('Admin client not available');
    }

    return this.deps.adminClient;
  }

  async getUserStatus(userId: string): Promise<UserTutorialStatus[]> {
    const { data, error } = await this.client.rpc('get_user_tutorial_status', {
      p_user_id: userId,
    });

    if (error) {
      throw new Error(`Error fetching user tutorial status: ${error.message}`);
    }

    return (data as DbUserTutorialStatusRow[]).map(mapRowToUserTutorialStatus);
  }

  async getByUserAndTutorial(userId: string, tutorialId: string): Promise<UserTutorialProgress | null> {
    const { data, error } = await this.client
      .from('user_tutorial_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('tutorial_id', tutorialId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching user tutorial progress: ${error.message}`);
    }

    return data ? mapRowToUserTutorialProgress(data as DbUserTutorialProgressRow) : null;
  }

  async create(input: UserTutorialProgressCreateInput): Promise<UserTutorialProgress> {
    const payload = UserTutorialProgressCreateSchema.parse(input);

    const { data, error } = await this.client
      .from('user_tutorial_progress')
      .insert({
        user_id: payload.user_id,
        tutorial_id: payload.tutorial_id,
        current_step: payload.current_step,
        completed: payload.completed,
        skipped: payload.skipped,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating user tutorial progress: ${error.message}`);
    }

    return mapRowToUserTutorialProgress(data as DbUserTutorialProgressRow);
  }

  async updateProgress(
    userId: string,
    tutorialId: string,
    currentStep: number,
    completed?: boolean,
    skipped?: boolean,
  ): Promise<UserTutorialProgress> {
    const { data, error } = await this.client.rpc('update_tutorial_progress', {
      p_user_id: userId,
      p_tutorial_id: tutorialId,
      p_current_step: currentStep,
      p_completed: completed,
      p_skipped: skipped,
    });

    if (error) {
      throw new Error(`Error updating tutorial progress: ${error.message}`);
    }

    return mapRowToUserTutorialProgress(data as DbUserTutorialProgressRow);
  }
}