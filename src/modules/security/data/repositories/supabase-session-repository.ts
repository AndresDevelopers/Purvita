import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { SessionRepository } from '../../domain/contracts/session-repository';

export interface SupabaseSessionRepositoryDependencies {
  client: SupabaseClient;
}

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly deps: SupabaseSessionRepositoryDependencies) {}

  async getCurrentSession(): Promise<{ session: Session | null; user: User | null }> {
    const { data, error } = await this.deps.client.auth.getSession();

    if (error) {
      throw new Error(`Error getting current session: ${error.message}`);
    }

    return {
      session: data.session,
      user: data.session?.user ?? null,
    };
  }

  async signOut(): Promise<void> {
    const { error } = await this.deps.client.auth.signOut();

    if (error) {
      throw new Error(`Error signing out: ${error.message}`);
    }
  }

  async refreshSession(): Promise<Session | null> {
    const { data, error } = await this.deps.client.auth.refreshSession();

    if (error) {
      throw new Error(`Error refreshing session: ${error.message}`);
    }

    return data.session;
  }
}