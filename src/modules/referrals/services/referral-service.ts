import type { ReferralRepository } from '../domain/contracts/referral-repository';
import type { ReferralSponsor } from '../domain/entities/referral-sponsor';
import { validateReferralCode } from '@/lib/security/validate-referral-code';

export type ReferralResolutionErrorCode = 'invalid_input' | 'not_found' | 'unexpected';

export class ReferralResolutionError extends Error {
  constructor(
    public readonly code: ReferralResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ReferralResolutionError';
  }
}

export interface ReferralResolutionResult {
  sponsorId: string;
  normalizedCode: string;
  referralCode: string | null;
  sponsorName: string | null;
  // ✅ SECURITY FIX #5: Removed sponsorEmail to prevent information disclosure
  // Email addresses should not be exposed to prevent:
  // - Phishing attacks
  // - User enumeration
  // - Privacy violations
}

const UUID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

export class ReferralService {
  constructor(private readonly repository: ReferralRepository) {}

  normalizeInput(raw: string | null | undefined): string | null {
    if (!raw) {
      return null;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const urlCandidate = this.extractFromUrl(trimmed);
    if (urlCandidate) {
      return urlCandidate;
    }

    const queryCandidate = this.extractFromQuery(trimmed);
    if (queryCandidate) {
      return queryCandidate;
    }

    return trimmed;
  }

  async resolveSponsor(raw: string): Promise<ReferralResolutionResult> {
    const normalized = this.normalizeInput(raw);

    if (!normalized) {
      throw new ReferralResolutionError('invalid_input', 'A referral code is required to resolve the sponsor.');
    }

    // Validate and sanitize the referral code
    try {
      validateReferralCode(normalized);
    } catch (error) {
      throw new ReferralResolutionError(
        'invalid_input',
        error instanceof Error ? error.message : 'Invalid referral code format'
      );
    }

    const searchCandidates = this.buildSearchCandidates(normalized);
    let sponsor: ReferralSponsor | null = null;

    for (const candidate of searchCandidates) {
      sponsor = await candidate();
      if (sponsor) {
        break;
      }
    }

    if (!sponsor) {
      throw new ReferralResolutionError('not_found', 'No sponsor matches the provided referral code.');
    }

    return {
      sponsorId: sponsor.id,
      normalizedCode: normalized,
      referralCode: sponsor.referralCode,
      sponsorName: sponsor.name,
      // ✅ SECURITY FIX #5: Do NOT return email to prevent information disclosure
    };
  }

  private extractFromUrl(input: string): string | null {
    try {
      const parsed = new URL(input);
      const sponsorParam =
        parsed.searchParams.get('sponsor') ??
        parsed.searchParams.get('ref') ??
        parsed.searchParams.get('referral') ??
        parsed.searchParams.get('code');

      if (sponsorParam && sponsorParam.trim()) {
        return sponsorParam.trim();
      }

      const segments = parsed.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];

      if (lastSegment && !lastSegment.includes('.')) {
        return lastSegment.trim();
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  private extractFromQuery(input: string): string | null {
    const parts = input.split(/[?&]/);
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (!value) {
        continue;
      }
      if (['sponsor', 'ref', 'referral', 'code'].includes(key)) {
        return value.trim();
      }
    }
    return null;
  }

  private buildSearchCandidates(normalized: string) {
    const candidates: Array<() => Promise<ReferralSponsor | null>> = [];

    if (UUID_REGEX.test(normalized)) {
      candidates.push(() => this.repository.findByUserId(normalized));
    }

    const lowered = normalized.toLowerCase();

    candidates.push(() => this.repository.findByReferralCode(lowered));

    if (lowered !== normalized) {
      candidates.push(() => this.repository.findByReferralCode(normalized));
    }

    return candidates;
  }
}
