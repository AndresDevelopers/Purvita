import type { PostgrestError } from '@supabase/supabase-js';
import { cache } from 'react';

import type { Locale } from '@/i18n/config';
import type { Seo, SeoUpsertInput } from '@/lib/models/definitions';
import { SeoCollectionPayloadSchema, SeoSchema, SeoUpsertSchema } from '@/lib/models/definitions';
import { supabase, getServiceRoleClient } from '@/lib/supabase';
import { isBuildSmokeTestEnabled } from '@/lib/env/test-flags';

const TABLE_NAME = 'seo_settings';
const SCHEMA_ERROR_CODES = new Set(['42P01', '42703']);
const SCHEMA_DOC_PATH = 'docs/database/full-schema.sql (sección "Centralised SEO settings")';

let schemaWarningLogged = false;

const formatSupabaseError = (error: PostgrestError | null): string => {
  if (!error) {
    return 'unknown error';
  }

  return error.message ?? 'unknown error';
};

const buildSchemaUpgradeHint = (error: PostgrestError, context: string) =>
  [
    `La tabla ${TABLE_NAME} en Supabase no tiene la estructura esperada (${context}).`,
    `Ejecuta la sección indicada en ${SCHEMA_DOC_PATH} y vuelve a intentarlo.`,
    `Código ${error.code ?? 'desconocido'}: ${error.message}`,
  ].join(' ');

const isSchemaOutdatedError = (error: PostgrestError | null | undefined): error is PostgrestError => {
  if (!error) {
    return false;
  }

  return SCHEMA_ERROR_CODES.has(error.code ?? '');
};

const logSchemaWarningOnce = (message: string) => {
  if (schemaWarningLogged) {
    return;
  }

  schemaWarningLogged = true;
  console.warn(`[SEO] ${message}`);
};

const getSupabaseClient = () => {
  return supabase;
};

const getAdminClient = () => {
  const client = getServiceRoleClient();
  if (!client) {
    throw new Error('Service role client is not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
  return client;
};

const sanitizeNullable = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const sanitizeUrl = (value: string | null | undefined): string | null => {
  const result = sanitizeNullable(value);
  if (!result) {
    return null;
  }

  if (result.startsWith('/')) {
    return result;
  }

  try {
    // Throws if invalid absolute URL
    new URL(result);
    return result;
  } catch {
    throw new Error(`La URL "${value}" no es válida.`);
  }
};

const sanitizeJsonLd = (value: string | null | undefined): string | null => {
  const trimmed = sanitizeNullable(value);
  if (!trimmed) {
    return null;
  }

  try {
    JSON.parse(trimmed);
  } catch (_error) {
    throw new Error('El bloque de datos estructurados JSON-LD no es válido. Verifica la sintaxis.');
  }

  return trimmed;
};

const prepareUpsertPayload = (payload: SeoUpsertInput[]): SeoUpsertInput[] =>
  payload.map((entry) => {
    const parsed = SeoUpsertSchema.parse(entry);

    const prepared: SeoUpsertInput = {
      page: parsed.page,
      locale: parsed.locale,
      keywords: (parsed.keywords ?? '').trim(),
      title: parsed.title.trim(),
      description: parsed.description.trim(),
      canonical_url: sanitizeUrl(parsed.canonical_url ?? null),
      robots_index: parsed.robots_index ?? true,
      robots_follow: parsed.robots_follow ?? true,
      robots_advanced: sanitizeNullable(parsed.robots_advanced ?? null),
      og_title: sanitizeNullable(parsed.og_title ?? null),
      og_description: sanitizeNullable(parsed.og_description ?? null),
      og_image: sanitizeUrl(parsed.og_image ?? null),
      twitter_title: sanitizeNullable(parsed.twitter_title ?? null),
      twitter_description: sanitizeNullable(parsed.twitter_description ?? null),
      twitter_image: sanitizeUrl(parsed.twitter_image ?? null),
      json_ld: sanitizeJsonLd(parsed.json_ld ?? null),
    };

    if (parsed.id) {
      prepared.id = parsed.id;
    }

    return prepared;
  });

export const getSeoSettings = async (): Promise<Seo[]> => {
  if (isBuildSmokeTestEnabled()) {
    return [];
  }

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .select('*')
    .order('page', { ascending: true })
    .order('locale', { ascending: true });

  if (isSchemaOutdatedError(error)) {
    const message = buildSchemaUpgradeHint(error, 'lectura de registros');
    logSchemaWarningOnce(message);
    throw new Error(message);
  }

  if (error) {
    throw new Error(`Error fetching SEO settings: ${formatSupabaseError(error)}`);
  }

  return SeoSchema.array().parse(data ?? []);
};

export const upsertSeoSettings = async (payload: unknown): Promise<Seo[]> => {
  const parsed = SeoCollectionPayloadSchema.parse(payload);
  const entries = prepareUpsertPayload(parsed.settings);

  if (entries.length === 0) {
    return getSeoSettings();
  }

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .upsert(entries, { onConflict: 'page,locale' })
    .select('*')
    .order('page', { ascending: true })
    .order('locale', { ascending: true });

  if (isSchemaOutdatedError(error)) {
    const message = buildSchemaUpgradeHint(error, 'actualización de registros');
    logSchemaWarningOnce(message);
    throw new Error(message);
  }

  if (error) {
    throw new Error(`Error updating SEO settings: ${formatSupabaseError(error)}`);
  }

  return SeoSchema.array().parse(data ?? []);
};

const fetchSeoEntry = cache(async (page: string, locale: Locale): Promise<Seo | null> => {
  if (isBuildSmokeTestEnabled()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('page', page)
    .eq('locale', locale)
    .maybeSingle();

  if (isSchemaOutdatedError(error)) {
    const message = buildSchemaUpgradeHint(error, `consulta pública ${page}:${locale}`);
    logSchemaWarningOnce(message);
    return null;
  }

  if (error) {
    // During build time, database might not be available - log warning instead of throwing
    console.warn(
      `[SEO] Error fetching SEO entry for ${page}:${locale} - ${formatSupabaseError(error)}. Using defaults.`
    );
    return null;
  }

  if (!data) {
    return null;
  }

  return SeoSchema.parse(data);
});

export const getSeoEntry = async (page: string, locale: Locale): Promise<Seo | null> =>
  fetchSeoEntry(page, locale);

export const getSeoFallback = async (locale: Locale): Promise<Seo | null> =>
  fetchSeoEntry('global', locale);