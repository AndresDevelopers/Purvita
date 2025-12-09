import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AppSettingsSchema,
  AppSettingsUpdateSchema,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsUpdateInput,
} from '../../domain/models/app-settings';
import type { AppSettingsRepository } from '../../domain/contracts/app-settings-repository';

interface SupabaseAppSettingsRepositoryDependencies {
  adminClient: SupabaseClient | null;
}

type DbAppSettingsRow = {
  id: string;
  max_members_per_level: any;
  payout_frequency: string | null;
  currency: string | null;
  currencies: unknown;
  auto_advance_enabled: boolean | null;
  ecommerce_commission_rate: number | null;
  team_levels_visible: number | null;
  store_owner_discount_type: string | null;
  store_owner_discount_value: number | null;
  direct_sponsor_commission_rate: number | null;
  network_commission_rate: number | null;
  reward_credit_label_en: string | null;
  reward_credit_label_es: string | null;
  free_product_label_en: string | null;
  free_product_label_es: string | null;
  affiliate_commission_rate: number | null;
  affiliate_direct_sponsor_commission_rate: number | null;
  affiliate_general_sponsor_commission_rate: number | null;
  created_at: string | null;
  updated_at: string | null;
};

const normalizeLevelArray = (
  value: any,
  fallback: any,
): any => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const entries = value.filter((item: any): item is Record<string, unknown> => typeof item === 'object' && item !== null);

  const normalized = entries
    .map((entry: any) => {
      const level = typeof entry.level === 'number' ? entry.level : Number(entry.level);
      return {
        ...(entry as Record<string, unknown>),
        level,
      };
    })
    .filter((entry: any) => Number.isInteger(entry.level) && entry.level > 0)
    .sort((a: any, b: any) => a.level - b.level);

  return normalized;
};

const mapRowToSettings = (row: DbAppSettingsRow | null): AppSettings => {
  if (!row) {
    return DEFAULT_APP_SETTINGS;
  }

  const normalizedCapacities = normalizeLevelArray(row.max_members_per_level as any, DEFAULT_APP_SETTINGS.maxMembersPerLevel);
  const rawCurrencies = Array.isArray(row.currencies)
    ? row.currencies
    : typeof row.currencies === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(row.currencies);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];
  const normalizedCurrencies = rawCurrencies
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const codeCandidate = record.code ?? record.currency;
      if (typeof codeCandidate !== 'string') {
        return null;
      }

      const countriesSource = record.countryCodes ?? record.countries ?? record.country_codes;
      const countries = Array.isArray(countriesSource)
        ? countriesSource.filter((country): country is string => typeof country === 'string')
        : [];

      return {
        code: codeCandidate,
        countryCodes: countries,
      };
    })
    .filter((entry): entry is { code: string; countryCodes: string[] } => Boolean(entry));

  return AppSettingsSchema.parse({
    id: row.id ?? DEFAULT_APP_SETTINGS.id,
    maxMembersPerLevel: normalizedCapacities.map((entry) => {
      const normalizedEntry = entry as { maxMembers?: number; max_members?: number };

      return {
        level: entry.level,
        maxMembers: Number(normalizedEntry.maxMembers ?? normalizedEntry.max_members ?? 0),
      };
    }),
    payoutFrequency: (row.payout_frequency ?? DEFAULT_APP_SETTINGS.payoutFrequency) as AppSettings['payoutFrequency'],
    currency: (row.currency ?? DEFAULT_APP_SETTINGS.currency).toUpperCase(),
    currencies:
      normalizedCurrencies.length > 0
        ? normalizedCurrencies
        : DEFAULT_APP_SETTINGS.currencies,
    autoAdvanceEnabled: Boolean(row.auto_advance_enabled ?? DEFAULT_APP_SETTINGS.autoAdvanceEnabled),
    ecommerceCommissionRate: Number(row.ecommerce_commission_rate ?? DEFAULT_APP_SETTINGS.ecommerceCommissionRate),
    teamLevelsVisible: Number(row.team_levels_visible ?? DEFAULT_APP_SETTINGS.teamLevelsVisible),
    storeOwnerDiscountType: (row.store_owner_discount_type as 'fixed' | 'percent') ?? DEFAULT_APP_SETTINGS.storeOwnerDiscountType,
    storeOwnerDiscountValue: Number(row.store_owner_discount_value ?? DEFAULT_APP_SETTINGS.storeOwnerDiscountValue),
    directSponsorCommissionRate: Number(row.direct_sponsor_commission_rate ?? DEFAULT_APP_SETTINGS.directSponsorCommissionRate),
    networkCommissionRate: Number(row.network_commission_rate ?? DEFAULT_APP_SETTINGS.networkCommissionRate),
    rewardCreditLabelEn: row.reward_credit_label_en ?? DEFAULT_APP_SETTINGS.rewardCreditLabelEn,
    rewardCreditLabelEs: row.reward_credit_label_es ?? DEFAULT_APP_SETTINGS.rewardCreditLabelEs,
    freeProductLabelEn: row.free_product_label_en ?? DEFAULT_APP_SETTINGS.freeProductLabelEn,
    freeProductLabelEs: row.free_product_label_es ?? DEFAULT_APP_SETTINGS.freeProductLabelEs,
    affiliateCommissionRate: Number(row.affiliate_commission_rate ?? DEFAULT_APP_SETTINGS.affiliateCommissionRate),
    affiliateDirectSponsorCommissionRate: Number(row.affiliate_direct_sponsor_commission_rate ?? DEFAULT_APP_SETTINGS.affiliateDirectSponsorCommissionRate),
    affiliateGeneralSponsorCommissionRate: Number(row.affiliate_general_sponsor_commission_rate ?? DEFAULT_APP_SETTINGS.affiliateGeneralSponsorCommissionRate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const mapInputToPayload = (input: AppSettingsUpdateInput) => {
  const payload = AppSettingsUpdateSchema.parse(input);

  return {
    max_members_per_level: payload.maxMembersPerLevel.map((entry) => ({
      level: entry.level,
      max_members: entry.maxMembers,
    })),
    payout_frequency: payload.payoutFrequency,
    currency: payload.currency.toUpperCase(),
    currencies: payload.currencies.map((entry) => ({
      code: entry.code.toUpperCase(),
      countryCodes: entry.countryCodes.map((country) => country.toUpperCase()),
    })),
    auto_advance_enabled: payload.autoAdvanceEnabled,
    ecommerce_commission_rate: payload.ecommerceCommissionRate,
    team_levels_visible: payload.teamLevelsVisible,
    store_owner_discount_type: payload.storeOwnerDiscountType,
    store_owner_discount_value: payload.storeOwnerDiscountValue,
    direct_sponsor_commission_rate: payload.directSponsorCommissionRate,
    network_commission_rate: payload.networkCommissionRate,
    reward_credit_label_en: payload.rewardCreditLabelEn,
    reward_credit_label_es: payload.rewardCreditLabelEs,
    free_product_label_en: payload.freeProductLabelEn,
    free_product_label_es: payload.freeProductLabelEs,
    affiliate_commission_rate: payload.affiliateCommissionRate,
    affiliate_direct_sponsor_commission_rate: payload.affiliateDirectSponsorCommissionRate,
    affiliate_general_sponsor_commission_rate: payload.affiliateGeneralSponsorCommissionRate,
    updated_at: new Date().toISOString(),
  } satisfies Partial<DbAppSettingsRow>;
};

export class SupabaseAppSettingsRepository implements AppSettingsRepository {
  constructor(private readonly deps: SupabaseAppSettingsRepositoryDependencies) { }

  private get client(): SupabaseClient {
    if (!this.deps.adminClient) {
      throw new Error('Admin client not available');
    }

    return this.deps.adminClient;
  }

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.client.from('app_settings').select('*').eq('id', 'global').maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return DEFAULT_APP_SETTINGS;
      }
      throw new Error(`Error fetching app settings: ${error.message}`);
    }

    return mapRowToSettings(data as DbAppSettingsRow | null);
  }

  async upsertSettings(input: AppSettingsUpdateInput): Promise<AppSettings> {
    const payload = mapInputToPayload(input);

    const { data, error } = await this.client
      .from('app_settings')
      .upsert({ id: 'global', ...payload }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Error saving app settings: ${error.message}`);
    }

    return mapRowToSettings(data as DbAppSettingsRow | null);
  }
}
