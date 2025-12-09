import type { SupabaseClient } from '@supabase/supabase-js';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';

export class NetworkCapacityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sponsorId?: string,
    public readonly currentCount?: number,
    public readonly maxAllowed?: number,
  ) {
    super(message);
    this.name = 'NetworkCapacityError';
  }
}

export class NetworkCapacityService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Validates if a sponsor can accept a new direct member (level 1)
   * @param userId - The user ID who wants to subscribe
   * @throws NetworkCapacityError if the sponsor has reached their level 1 capacity limit
   */
  async validateSponsorCapacity(userId: string): Promise<void> {
    // Get the user's sponsor (referred_by)
    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    // If no sponsor, user can subscribe as independent (no limit check needed)
    if (!profile || !profile.referred_by) {
      return;
    }

    const sponsorId = profile.referred_by;

    // Get the max members allowed for level 1 from app settings
    const settings = await getAppSettings();
    const level1Config = settings.maxMembersPerLevel.find((config) => config.level === 1);

    // If no config for level 1, allow unlimited
    if (!level1Config) {
      return;
    }

    const maxMembersLevel1 = level1Config.maxMembers;

    // Count active direct members (level 1) under this sponsor
    const { count, error: countError } = await this.client
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', sponsorId)
      .neq('id', userId); // Exclude the current user in case they're re-subscribing

    if (countError) {
      throw countError;
    }

    const currentCount = count ?? 0;

    // Check if sponsor has reached their limit
    if (currentCount >= maxMembersLevel1) {
      throw new NetworkCapacityError(
        `El afiliador ha alcanzado su límite de ${maxMembersLevel1} miembros en su red. ` +
          `Por favor, regístrate como usuario principal sin código de afiliado.`,
        'sponsor_capacity_reached',
        sponsorId,
        currentCount,
        maxMembersLevel1,
      );
    }
  }

  /**
   * Get the current capacity status for a sponsor
   */
  async getSponsorCapacityStatus(sponsorId: string): Promise<{
    currentCount: number;
    maxAllowed: number;
    available: number;
    percentage: number;
  }> {
    const settings = await getAppSettings();
    const level1Config = settings.maxMembersPerLevel.find((config) => config.level === 1);
    const maxAllowed = level1Config?.maxMembers ?? 0;

    const { count, error } = await this.client
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', sponsorId);

    if (error) {
      throw error;
    }

    const currentCount = count ?? 0;
    const available = Math.max(0, maxAllowed - currentCount);
    const percentage = maxAllowed > 0 ? Math.round((currentCount / maxAllowed) * 100) : 0;

    return {
      currentCount,
      maxAllowed,
      available,
      percentage,
    };
  }
}
