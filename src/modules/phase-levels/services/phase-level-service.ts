/**
 * Phase Level Service
 * Service layer for accessing phase level configuration
 */

import { createAdminClient } from '@/lib/supabase/server';
import { PhaseLevelSchema, type PhaseLevel } from '../domain/models/phase-level';

/**
 * Database column names for phase_levels table
 */
const PHASE_LEVEL_COLUMNS =
  'id, level, name, name_en, name_es, commission_rate, subscription_discount_rate, affiliate_sponsor_commission_rate, credit_cents, free_product_value_cents, is_active, display_order, descriptor_en, descriptor_es, requirement_en, requirement_es, rewards_en, rewards_es, visibility_tag_en, visibility_tag_es, created_at, updated_at';

/**
 * Maps database row (snake_case) to domain model (camelCase)
 */
function mapDatabaseRowToPhaseLevel(row: any): PhaseLevel {
  return PhaseLevelSchema.parse({
    id: row.id,
    level: row.level,
    name: row.name,
    nameEn: row.name_en,
    nameEs: row.name_es,
    commissionRate: row.commission_rate,
    subscriptionDiscountRate: row.subscription_discount_rate ?? 0,
    affiliateSponsorCommissionRate: row.affiliate_sponsor_commission_rate ?? 0,
    creditCents: row.credit_cents,
    freeProductValueCents: row.free_product_value_cents ?? (row.level === 1 ? 6500 : 0),
    isActive: row.is_active,
    displayOrder: row.display_order,
    descriptorEn: row.descriptor_en,
    descriptorEs: row.descriptor_es,
    requirementEn: row.requirement_en,
    requirementEs: row.requirement_es,
    rewardsEn: row.rewards_en,
    rewardsEs: row.rewards_es,
    visibilityTagEn: row.visibility_tag_en,
    visibilityTagEs: row.visibility_tag_es,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * Get all phase levels ordered by display order
 */
export async function getPhaseLevels(): Promise<PhaseLevel[]> {
  const supabase = await createAdminClient();
  
  const { data, error } = await supabase
    .from('phase_levels')
    .select(PHASE_LEVEL_COLUMNS)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  
  if (error) {
    console.error('[PhaseLevelService] Error fetching phase levels:', error);
    throw new Error('Failed to fetch phase levels');
  }
  
  if (!data || data.length === 0) {
    console.warn('[PhaseLevelService] No phase levels found');
    return [];
  }
  
  return data.map(mapDatabaseRowToPhaseLevel);
}

/**
 * Get a specific phase level by level number
 */
export async function getPhaseLevel(level: number): Promise<PhaseLevel | null> {
  const supabase = await createAdminClient();
  
  const { data, error } = await supabase
    .from('phase_levels')
    .select(PHASE_LEVEL_COLUMNS)
    .eq('level', level)
    .eq('is_active', true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('[PhaseLevelService] Error fetching phase level:', error);
    throw new Error('Failed to fetch phase level');
  }
  
  return mapDatabaseRowToPhaseLevel(data);
}

/**
 * Get phase level by ID
 */
export async function getPhaseLevelById(id: string): Promise<PhaseLevel | null> {
  const supabase = await createAdminClient();
  
  const { data, error } = await supabase
    .from('phase_levels')
    .select(PHASE_LEVEL_COLUMNS)
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[PhaseLevelService] Error fetching phase level by ID:', error);
    throw new Error('Failed to fetch phase level');
  }
  
  return mapDatabaseRowToPhaseLevel(data);
}
