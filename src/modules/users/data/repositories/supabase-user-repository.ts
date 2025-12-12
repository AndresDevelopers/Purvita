import type { SupabaseClient, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type {
  CreateUserProfile,
  UpdateUserProfile,
  UserProfile,
} from '@/lib/models/definitions';
import { getGlobalCommissionRate } from '@/lib/helpers/settings-helper';
import type { UserFilters, UserRepository } from '../../domain/contracts/user-repository';

export interface SupabaseUserRepositoryDependencies {
  adminClient: SupabaseClient | null;
  componentClient: SupabaseClient;
  auditLogger: (
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
}

type ProfileInput = Partial<UserProfile> & {
  id: string;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
};

const pickString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const pickPaymentProvider = (value: unknown): 'paypal' | 'stripe' | 'wallet' | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'paypal' || normalized === 'stripe' || normalized === 'wallet') {
    return normalized;
  }

  return undefined;
};

const coerceBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
};

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const parsed = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'));
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly deps: SupabaseUserRepositoryDependencies) { }

  private async getDefaultCommissionRate(): Promise<number> {
    return getGlobalCommissionRate();
  }

  async countProfiles(): Promise<number> {
    const { count, error } = await this.deps.componentClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Error fetching users count: ${error.message}`);
    }

    return count ?? 0;
  }

  async listProfiles(filters?: UserFilters): Promise<UserProfile[]> {
    if (!this.deps.adminClient) {
      throw new Error('Admin client not available');
    }
    let query = this.deps.adminClient
      .from('profiles')
      .select(`
        *,
        role_name:roles(name),
        phase:phases(phase),
        subscription:subscriptions(status, subscription_type)
      `)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }

    const rawProfiles = Array.isArray(data) ? (data as ProfileInput[]) : [];
    const defaultCommissionRate = await this.getDefaultCommissionRate();

    let normalizedProfiles = rawProfiles.map((profile) =>
      this.normalizeProfile(profile, defaultCommissionRate),
    );

    // Apply filters in memory since we can't easily filter by joined tables in Supabase without complex query builders or views
    if (filters) {
      if (filters.levels && filters.levels.length > 0) {
        normalizedProfiles = normalizedProfiles.filter((p) =>
          p.current_phase !== undefined && filters.levels!.includes(p.current_phase)
        );
      }

      if (filters.subscriptionStatus && filters.subscriptionStatus.length > 0) {
        normalizedProfiles = normalizedProfiles.filter((p) =>
          p.subscription_status !== undefined && filters.subscriptionStatus!.includes(p.subscription_status)
        );
      }
    }

    const profileMap = new Map<string, UserProfile>(
      normalizedProfiles.map((profile) => [profile.id, profile]),
    );

    const authUsers = await this.listAuthUsers();
    const mergedUsers: UserProfile[] = authUsers.map((authUser) => {
      const existingProfile = profileMap.get(authUser.id) ?? null;
      profileMap.delete(authUser.id);
      return this.mergeProfileWithAuth(authUser, existingProfile, defaultCommissionRate);
    });

    for (const leftoverProfile of profileMap.values()) {
      mergedUsers.push(leftoverProfile);
    }

    return mergedUsers.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  async getProfileById(id: string): Promise<UserProfile | null> {
    if (!this.deps.adminClient) {
      throw new Error('Admin client not available');
    }
    const { data, error } = await this.deps.adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching user: ${error.message}`);
    }

    return data;
  }

  async getCurrentProfile(): Promise<UserProfile | null> {
    const {
      data: { user },
      error,
    } = await this.deps.componentClient.auth.getUser();

    if (error) {
      // Handle AuthSessionMissingError gracefully by returning null
      if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
        return null;
      }
      throw new Error(`Error fetching user profile: ${error.message}`);
    }

    if (!user) {
      return null;
    }

    const { data, error: profileError } = await this.deps.componentClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }

    return data;
  }

  async createProfile(profile: CreateUserProfile): Promise<UserProfile> {
    const { data, error } = await this.deps.componentClient
      .from('profiles')
      .insert(profile)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating user profile: ${error.message}`);
    }

    return data;
  }

  async updateProfile(id: string, updates: UpdateUserProfile): Promise<UserProfile> {
    if (!this.deps.adminClient) {
      throw new Error('Admin client not available');
    }
    const { data, error } = await this.deps.adminClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating user profile: ${error.message}`);
    }

    return data;
  }

  async listReferredProfiles(userId: string): Promise<UserProfile[]> {
    if (!this.deps.adminClient) {
      throw new Error('Admin client not available');
    }
    const { data, error } = await this.deps.adminClient
      .from('profiles')
      .select('*')
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching referred users: ${error.message}`);
    }

    return data ?? [];
  }

  async generateReferralCode(baseName: string): Promise<string> {
    const baseCode = baseName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    let codeCandidate = baseCode;

    for (let counter = 0; counter < 1000; counter += 1) {
      const { data, error } = await this.deps.componentClient
        .from('profiles')
        .select('id')
        .eq('referral_code', codeCandidate)
        .single();

      if (error && error.code === 'PGRST116') {
        return codeCandidate;
      }

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Error checking referral code: ${error.message}`);
      }

      if (!data) {
        return codeCandidate;
      }

      codeCandidate = `${baseCode}${counter + 1}`;
    }

    throw new Error('Unable to generate a unique referral code after multiple attempts.');
  }

  async updateStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<UserProfile> {
    return this.updateProfile(id, { status });
  }

  async updateRole(id: string, role: 'member' | 'admin'): Promise<UserProfile> {
    return this.updateProfile(id, { role });
  }

  async listRecentProfiles(limit: number = 5): Promise<UserProfile[]> {
    const { data, error } = await this.deps.componentClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching recent users: ${error.message}`);
    }

    return data ?? [];
  }

  private normalizeProfile(
    profile: ProfileInput,
    defaultCommissionRate: number,
  ): UserProfile {
    const email = pickString(profile.email) ?? 'unknown@example.com';
    const name = pickString(profile.name) ?? email;
    const payValue = coerceBoolean(profile.pay);
    const commission = coerceNumber(profile.commission_rate) ?? defaultCommissionRate;
    const totalEarnings = coerceNumber(profile.total_earnings) ?? 0;
    const teamCount = coerceNumber(profile.team_count) ?? 0;

    // Role is now determined by role_id, not the old role field
    const status: UserProfile['status'] = ['inactive', 'suspended'].includes(profile.status as string)
      ? (profile.status as UserProfile['status'])
      : 'active';

    return {
      id: profile.id,
      name,
      email,
      role_id: pickString(profile.role_id as any),
      role_name: (profile as any).role_name,
      status,
      pay: typeof payValue === 'boolean' ? payValue : false,
      show_reviews: typeof coerceBoolean((profile as any).show_reviews) === 'boolean'
        ? (coerceBoolean((profile as any).show_reviews) as boolean)
        : false,
      referral_code: pickString(profile.referral_code),
      referred_by: pickString(profile.referred_by),
      team_count: teamCount,
      phone: pickString(profile.phone),
      address: pickString(profile.address),
      city: pickString(profile.city),
      state: pickString(profile.state),
      postal_code: pickString(profile.postal_code),
      country: pickString(profile.country),
      default_payment_provider: pickPaymentProvider(profile.default_payment_provider),
      avatar_url: pickString(profile.avatar_url),
      commission_rate: commission,
      total_earnings: totalEarnings,
      current_phase: (profile as any).phase?.phase,
      ...this.extractSubscriptionInfo((profile as any).subscription),
      created_at: toIsoString(profile.created_at),
      updated_at: toIsoString(profile.updated_at ?? profile.created_at),
    };
  }

  /**
   * Extract subscription info, prioritizing active subscriptions.
   * Returns subscription_status and subscription_type.
   */
  private extractSubscriptionInfo(subscription: unknown): { 
    subscription_status?: 'active' | 'inactive' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid' | 'paused'; 
    subscription_type?: 'mlm' | 'affiliate';
  } {
    if (!subscription) {
      return {};
    }

    type SubscriptionStatusType = 'active' | 'inactive' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid' | 'paused';
    
    const isValidStatus = (status: unknown): status is SubscriptionStatusType => {
      return typeof status === 'string' && 
        ['active', 'inactive', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'paused'].includes(status);
    };

    // Handle array of subscriptions (multiple rows)
    if (Array.isArray(subscription)) {
      // First, try to find an active subscription
      const activeSubscription = subscription.find(
        (s: { status?: string }) => s?.status === 'active'
      );
      
      if (activeSubscription && isValidStatus(activeSubscription.status)) {
        return {
          subscription_status: activeSubscription.status,
          subscription_type: activeSubscription.subscription_type,
        };
      }

      // If no active, return the first one (most recent due to query order)
      const firstSubscription = subscription[0];
      if (firstSubscription && isValidStatus(firstSubscription.status)) {
        return {
          subscription_status: firstSubscription.status,
          subscription_type: firstSubscription.subscription_type,
        };
      }

      return {};
    }

    // Handle single subscription object
    const sub = subscription as { status?: string; subscription_type?: 'mlm' | 'affiliate' };
    if (isValidStatus(sub.status)) {
      return {
        subscription_status: sub.status,
        subscription_type: sub.subscription_type,
      };
    }
    
    return {
      subscription_type: sub.subscription_type,
    };
  }

  private async listAuthUsers(): Promise<SupabaseAuthUser[]> {
    if (!this.deps.adminClient) {
      return [];
    }

    try {
      const adminApi = (this.deps.adminClient.auth as { admin?: { listUsers?: Function } } | undefined)?.admin;

      if (!adminApi || typeof adminApi.listUsers !== 'function') {
        return [];
      }

      const listUsers = adminApi.listUsers as (
        params: { page: number; perPage: number },
      ) => Promise<{
        data?: { users?: SupabaseAuthUser[] } | null;
        error?: { message?: string } | null;
      }>;

      const users: SupabaseAuthUser[] = [];
      const perPage = 100;
      let page = 1;

      while (true) {
        const { data, error } = await listUsers({
          page,
          perPage,
        });

        if (error) {
          console.warn(
            `[SupabaseUserRepository] Failed to fetch auth users: ${error.message}`,
          );
          break;
        }

        const batch = data?.users ?? [];
        users.push(...batch);

        if (batch.length < perPage) {
          break;
        }

        page += 1;
      }

      return users;
    } catch (error) {
      console.warn('[SupabaseUserRepository] Unexpected error fetching auth users', error);
      return [];
    }
  }

  private mergeProfileWithAuth(
    authUser: SupabaseAuthUser,
    profile: UserProfile | null,
    defaultCommissionRate: number,
  ): UserProfile {
    const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
    const profileInput: ProfileInput = profile
      ? ({ ...profile } as ProfileInput)
      : { id: authUser.id };

    const email = pickString(profileInput.email) ?? pickString(authUser.email) ?? 'unknown@example.com';
    const name =
      pickString(profileInput.name) ??
      pickString(metadata.full_name) ??
      pickString(metadata.name) ??
      pickString(metadata.display_name) ??
      email;

    const _metadataRole = pickString(metadata.role);
    const metadataStatus = pickString(metadata.status);

    const statusFromMetadata: UserProfile['status'] = metadataStatus === 'inactive' || metadataStatus === 'suspended'
      ? metadataStatus
      : 'active';

    const payFromMetadataCandidates = [
      metadata.pay,
      metadata.isPaid,
      metadata.has_subscription,
      metadata.hasSubscription,
      metadata.paid,
    ];

    let payFromMetadata: boolean | undefined;
    for (const candidate of payFromMetadataCandidates) {
      const coerced = coerceBoolean(candidate);
      if (typeof coerced === 'boolean') {
        payFromMetadata = coerced;
        break;
      }
    }

    const commissionFromMetadata = coerceNumber(metadata.commission_rate);
    const totalEarningsFromMetadata = coerceNumber(metadata.total_earnings);

    return this.normalizeProfile({
      ...profileInput,
      id: authUser.id,
      name,
      email,
      // Role is now determined by role_id from the roles table
      role_id: profileInput.role_id,
      role_name: (profileInput as any).role_name,
      status: profileInput.status ?? statusFromMetadata,
      pay: profileInput.pay ?? payFromMetadata ?? false,
      referral_code: profileInput.referral_code ?? pickString(metadata.referral_code),
      referred_by: profileInput.referred_by ?? pickString(metadata.referred_by),
      phone: profileInput.phone ?? pickString(authUser.phone ?? metadata.phone),
      address: profileInput.address ?? pickString(metadata.address),
      city: profileInput.city ?? pickString(metadata.city),
      state: profileInput.state ?? pickString(metadata.state),
      postal_code: profileInput.postal_code ?? pickString(metadata.postal_code),
      country: profileInput.country ?? pickString(metadata.country),
      default_payment_provider:
        profileInput.default_payment_provider ?? pickPaymentProvider(metadata.default_payment_provider),
      avatar_url: profileInput.avatar_url ?? pickString(metadata.avatar_url),
      commission_rate: profileInput.commission_rate ?? commissionFromMetadata,
      total_earnings: profileInput.total_earnings ?? totalEarningsFromMetadata,
      created_at: profileInput.created_at ?? authUser.created_at,
      updated_at:
        profileInput.updated_at ??
        authUser.updated_at ??
        authUser.last_sign_in_at ??
        profileInput.created_at ??
        authUser.created_at,
    }, defaultCommissionRate);
  }
}
