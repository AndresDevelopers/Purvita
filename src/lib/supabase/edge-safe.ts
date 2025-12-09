/**
 * Edge-safe Supabase utilities
 * Maneja las importaciones de Supabase de manera segura para Edge Runtime
 */

// Re-exportar solo lo necesario para evitar advertencias de Edge Runtime
export { createClient } from '@supabase/supabase-js';
export type { SupabaseClient, User, Session } from '@supabase/supabase-js';
