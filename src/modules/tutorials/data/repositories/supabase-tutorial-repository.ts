import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TutorialSchema,
  TutorialCreateSchema,
  TutorialUpdateSchema,
  type Tutorial,
  type TutorialCreateInput,
  type TutorialUpdateInput,
} from '../../domain/models/tutorial';
import type { TutorialRepository } from '../../domain/contracts/tutorial-repository';

interface SupabaseTutorialRepositoryDependencies {
  adminClient: SupabaseClient | null;
}

type DbTutorialRow = {
  id: string;
  title: string;
  description: string | null;
  content: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const mapRowToTutorial = (row: DbTutorialRow): Tutorial => {
  return TutorialSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description,
    content: Array.isArray(row.content) ? row.content : [],
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
};

const mapCreateInputToPayload = (input: TutorialCreateInput) => {
  const payload = TutorialCreateSchema.parse(input);

  return {
    title: payload.title,
    description: payload.description,
    content: payload.content,
    is_active: payload.is_active,
  };
};

const mapUpdateInputToPayload = (input: TutorialUpdateInput) => {
  const payload = TutorialUpdateSchema.parse(input);

  return {
    ...(payload.title !== undefined && { title: payload.title }),
    ...(payload.description !== undefined && { description: payload.description }),
    ...(payload.content !== undefined && { content: payload.content }),
    ...(payload.is_active !== undefined && { is_active: payload.is_active }),
  };
};

export class SupabaseTutorialRepository implements TutorialRepository {
  constructor(private readonly deps: SupabaseTutorialRepositoryDependencies) {}

  private get client(): SupabaseClient {
    if (!this.deps.adminClient) {
      throw new Error('Admin client not available');
    }

    return this.deps.adminClient;
  }

  async getAll(): Promise<Tutorial[]> {
    const { data, error } = await this.client
      .from('tutorials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching tutorials: ${error.message}`);
    }

    return (data as DbTutorialRow[]).map(mapRowToTutorial);
  }

  async getById(id: string): Promise<Tutorial | null> {
    const { data, error } = await this.client
      .from('tutorials')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching tutorial: ${error.message}`);
    }

    return data ? mapRowToTutorial(data as DbTutorialRow) : null;
  }

  async create(input: TutorialCreateInput): Promise<Tutorial> {
    const payload = mapCreateInputToPayload(input);

    const { data, error } = await this.client
      .from('tutorials')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating tutorial: ${error.message}`);
    }

    return mapRowToTutorial(data as DbTutorialRow);
  }

  async update(id: string, input: TutorialUpdateInput): Promise<Tutorial> {
    const payload = mapUpdateInputToPayload(input);

    const { data, error } = await this.client
      .from('tutorials')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating tutorial: ${error.message}`);
    }

    return mapRowToTutorial(data as DbTutorialRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('tutorials')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting tutorial: ${error.message}`);
    }
  }
}