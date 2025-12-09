const PLACEHOLDER_SIGNATURES = ['your_supabase', 'example.supabase.co'];

export type SupabaseEnvKey =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY';

const isPlaceholder = (value: string | undefined) => {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return PLACEHOLDER_SIGNATURES.some((signature) => normalized.includes(signature));
};

export const detectMissingSupabaseEnv = (keys: SupabaseEnvKey[]): SupabaseEnvKey[] => {
  return keys.filter((key) => isPlaceholder(process.env[key]));
};

export const hasSupabaseEnv = (keys: SupabaseEnvKey[]): boolean => {
  return detectMissingSupabaseEnv(keys).length === 0;
};

export const formatMissingSupabaseEnvMessage = (keys: SupabaseEnvKey[]): string => {
  return `Missing Supabase environment variables: ${keys.join(', ')}`;
};
