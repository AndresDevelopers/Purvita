import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Plan } from '@/lib/models/definitions';
import { PlanSchema, normalizeStringArray } from '@/lib/models/definitions';
import { isBuildSmokeTestEnabled } from '@/lib/env/test-flags';
import { supabase, getServiceRoleClient } from '@/lib/supabase';

// Type-safe raw plan data from database
type RawPlan = Record<string, unknown>;

// Type guard helpers
const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string');

// Transform null values to undefined for Zod compatibility
const transformPlanForZod = (data: RawPlan): Record<string, unknown> => ({
    ...data,
    name: data.name === null || !isString(data.name) ? undefined : data.name,
    description: data.description === null || !isString(data.description) ? undefined : data.description,
    name_en: data.name_en === null || !isString(data.name_en) ? undefined : data.name_en,
    name_es: data.name_es === null || !isString(data.name_es) ? undefined : data.name_es,
    description_en: data.description_en === null || !isString(data.description_en) ? undefined : data.description_en,
    description_es: data.description_es === null || !isString(data.description_es) ? undefined : data.description_es,
    features: data.features === null || !isStringArray(data.features) ? undefined : data.features,
    features_en: data.features_en === null || !isStringArray(data.features_en) ? undefined : data.features_en,
    features_es: data.features_es === null || !isStringArray(data.features_es) ? undefined : data.features_es,
});

// Centralized query execution with consistent error handling
const executePlanQuery = async <T extends RawPlan | RawPlan[]>(
    queryBuilder: PromiseLike<{ data: T | null; error: PostgrestError | null }>
): Promise<T | null> => {
    const { data, error } = await queryBuilder;

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // No rows found
        }
        throw new Error(`Error fetching plan(s): ${error.message}`);
    }

    return data;
};

// Parse and validate plan data
const parsePlanData = (data: RawPlan | RawPlan[] | null): Plan | Plan[] | null => {
    if (!data) return null;

    if (Array.isArray(data)) {
        const transformed = data.map(transformPlanForZod);
        return PlanSchema.array().parse(transformed);
    }

    return PlanSchema.parse(transformPlanForZod(data));
};

const normalizePlanPayload = (
    planData: Partial<Omit<Plan, 'id' | 'created_at' | 'updated_at'>>,
): Partial<Omit<Plan, 'id' | 'created_at' | 'updated_at'>> => {
    const payload: Record<string, unknown> = {};

    const assign = (key: string, value: unknown) => {
        if (value !== undefined) {
            payload[key] = value;
        }
    };

    assign('slug', planData.slug);
    assign('price', planData.price);
    assign('is_active', planData.is_active);
    assign('is_affiliate_plan', planData.is_affiliate_plan);
    assign('is_mlm_plan', planData.is_mlm_plan);

    const resolvedName = planData.name_en ?? planData.name ?? planData.name_es;
    if (resolvedName !== undefined) {
        payload.name = resolvedName;
        assign('name_en', planData.name_en ?? resolvedName);
        assign('name_es', planData.name_es);
    }

    const resolvedDescription = planData.description_en ?? planData.description ?? planData.description_es;
    if (resolvedDescription !== undefined) {
        payload.description = resolvedDescription;
        assign('description_en', planData.description_en ?? resolvedDescription);
        assign('description_es', planData.description_es);
    }

    const featuresEn = planData.features_en !== undefined ? normalizeStringArray(planData.features_en) : undefined;
    const featuresLegacy = planData.features !== undefined ? normalizeStringArray(planData.features) : undefined;
    const featuresEs = planData.features_es !== undefined ? normalizeStringArray(planData.features_es) : undefined;

    const resolvedFeatures =
        featuresEn && featuresEn.length > 0
            ? featuresEn
            : featuresLegacy && featuresLegacy.length > 0
                ? featuresLegacy
                : featuresEs;

    if (resolvedFeatures !== undefined) {
        assign('features', resolvedFeatures);
        assign('features_en', featuresEn ?? resolvedFeatures);
        assign('features_es', featuresEs);
    }

    return payload as Partial<Omit<Plan, 'id' | 'created_at' | 'updated_at'>>;
};

const formatPlanError = (action: 'creating' | 'updating', error: PostgrestError) => {
    const message = error.message ?? '';
    if (message.includes("'name_en'") || message.includes("'description_en'") || message.includes("'features_en'")) {
        return new Error(
            `Missing multilingual plan columns in Supabase. Please apply the SQL in db/patch_plan_translations.sql before ${action} plans.`,
        );
    }

    return new Error(`Error ${action} plan: ${error.message}`);
};

// Get admin client with error handling
const getAdminClient = (): SupabaseClient => {
    const client = getServiceRoleClient();
    if (!client) {
        throw new Error('Service role client is not available. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
    }
    return client;
};

const SMOKE_TEST_PLAN: Plan = PlanSchema.parse({
    id: 'smoke-test-plan',
    slug: 'smoke-test-plan',
    name: 'Smoke Test Plan',
    name_en: 'Smoke Test Plan',
    name_es: 'Plan de prueba',
    description: 'Build smoke test placeholder plan.',
    description_en: 'Build smoke test placeholder plan.',
    description_es: 'Plan placeholder para pruebas de build.',
    features: ['Access to core features'],
    features_en: ['Access to core features'],
    features_es: ['Acceso a funcionalidades básicas'],
    price: 1,
    is_active: true,
});

const getSmokeTestPlans = (): Plan[] => [SMOKE_TEST_PLAN];

// Public API - Get active plans
export const getPlans = async (): Promise<Plan[]> => {
    if (isBuildSmokeTestEnabled()) {
        return getSmokeTestPlans();
    }

    const query = supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

    const data = await executePlanQuery(query);

    return (parsePlanData(data) as Plan[]) ?? [];
};

// Admin API - Get all plans (including inactive)
export const getAllPlans = async (): Promise<Plan[]> => {
    if (isBuildSmokeTestEnabled()) {
        return getSmokeTestPlans();
    }

    const adminClient = getAdminClient();

    const query = adminClient
        .from('plans')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

    const data = await executePlanQuery(query);

    return (parsePlanData(data) as Plan[]) ?? [];
};

// Public API - Get plan by slug
export const getPlanBySlug = async (slug: string): Promise<Plan | null> => {
    if (isBuildSmokeTestEnabled()) {
        return slug === SMOKE_TEST_PLAN.slug ? SMOKE_TEST_PLAN : null;
    }

    const query = supabase
        .from('plans')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    const data = await executePlanQuery(query);

    return parsePlanData(data) as Plan | null;
};

// Admin API - Get plan by ID
export const getPlanById = async (id: string): Promise<Plan | null> => {
    if (isBuildSmokeTestEnabled()) {
        return id === SMOKE_TEST_PLAN.id ? SMOKE_TEST_PLAN : null;
    }

    const adminClient = getAdminClient();

    const query = adminClient
        .from('plans')
        .select('*')
        .eq('id', id)
        .single();

    const data = await executePlanQuery(query);

    return parsePlanData(data) as Plan | null;
};

// Admin API - Create plan
export const createPlan = async (planData: Omit<Plan, 'id' | 'created_at' | 'updated_at'>): Promise<Plan> => {
    const adminClient = getAdminClient();
    const payload = normalizePlanPayload(planData);

    const { data, error } = await adminClient
        .from('plans')
        .insert(payload)
        .select()
        .single();

    if (error) {
        throw formatPlanError('creating', error);
    }

    if (!data) {
        throw new Error('No data returned after creating plan');
    }

    return parsePlanData(data) as Plan;
};

// Admin API - Update plan
export const updatePlan = async (
    id: string,
    planData: Partial<Omit<Plan, 'id' | 'created_at' | 'updated_at'>>
): Promise<Plan> => {
    const adminClient = getAdminClient();
    const payload = normalizePlanPayload(planData);

    // If setting this plan as default, unset all other defaults first
    if (payload.is_default === true) {
        await adminClient
            .from('plans')
            .update({ is_default: false })
            .neq('id', id);
    }

    const { data, error } = await adminClient
        .from('plans')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw formatPlanError('updating', error);
    }

    if (!data) {
        throw new Error('No data returned after updating plan');
    }

    return parsePlanData(data) as Plan;
};

// Admin API - Delete plan
export const deletePlan = async (id: string): Promise<void> => {
    const adminClient = getAdminClient();

    const { error } = await adminClient
        .from('plans')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Error deleting plan: ${error.message}`);
    }
};

// Admin API - Update plan order
export const updatePlanOrder = async (planOrders: { id: string; display_order: number }[]): Promise<void> => {
    const adminClient = getAdminClient();

    // Update each plan's display_order
    const updates = planOrders.map(({ id, display_order }) =>
        adminClient
            .from('plans')
            .update({ display_order })
            .eq('id', id)
    );

    const results = await Promise.all(updates);

    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
        throw new Error(`Error updating plan order: ${errors[0].error?.message}`);
    }
};

// Admin API - Set default plan
export const setDefaultPlan = async (id: string): Promise<Plan> => {
    const adminClient = getAdminClient();

    // First, unset all defaults
    await adminClient
        .from('plans')
        .update({ is_default: false })
        .neq('id', id);

    // Then set the new default
    const { data, error } = await adminClient
        .from('plans')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw formatPlanError('updating' as any, error);
    }

    if (!data) {
        throw new Error('No data returned after setting default plan');
    }

    return parsePlanData(data) as Plan;
};

// Public API - Get user's current plan based on their subscription
export const getUserPlan = async (userId: string): Promise<Plan | null> => {
    const adminClient = getAdminClient();

    // Get user's subscription with plan_id
    const { data: subscription, error: subError } = await adminClient
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

    if (subError) {
        console.error('[PlanService] Error fetching user subscription:', subError);
        return null;
    }

    if (!subscription?.plan_id) {
        return null;
    }

    // Get the plan details
    return getPlanById(subscription.plan_id);
};
