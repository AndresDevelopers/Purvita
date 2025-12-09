import type { Session, User } from '@supabase/supabase-js';

export interface SessionRepository {
  getCurrentSession(): Promise<{ session: Session | null; user: User | null }>;
  signOut(): Promise<void>;
  refreshSession(): Promise<Session | null>;
}