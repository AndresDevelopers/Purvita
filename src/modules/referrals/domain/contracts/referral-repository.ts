import type { ReferralSponsor } from '../entities/referral-sponsor';

export interface ReferralRepository {
  findByReferralCode(code: string): Promise<ReferralSponsor | null>;
  findByUserId(userId: string): Promise<ReferralSponsor | null>;
}
