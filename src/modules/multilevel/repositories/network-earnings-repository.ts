import type { SupabaseClient } from '@supabase/supabase-js';
import { getCachedAppSettings } from '@/lib/helpers/settings-helper';

export interface NetworkEarningsMemberBreakdown {
  memberId: string;
  memberName: string | null;
  memberEmail: string | null;
  totalCents: number;
}

export interface NetworkEarningsSummary {
  totalAvailableCents: number;
  currency: string;
  members: NetworkEarningsMemberBreakdown[];
}

interface NetworkCommissionRow {
  id: string;
  member_id: string;
  amount_cents: number;
  available_cents: number;
  currency: string | null;
  created_at: string;
  member: {
    name: string | null;
    email: string | null;
  } | null;
}

interface DecrementResult {
  id: string;
  deductedCents: number;
}

const createDefaultSummary = (currency: string): NetworkEarningsSummary => ({
  totalAvailableCents: 0,
  currency,
  members: [],
});

export class NetworkEarningsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async fetchAvailableSummary(userId: string): Promise<NetworkEarningsSummary> {
    const settings = await getCachedAppSettings();

    const { data, error } = await this.client
      .from('network_commissions')
      .select(
        `id,
         member_id,
         amount_cents,
         available_cents,
         currency,
         created_at,
         member:member_id (
           name,
           email
         )`
      )
      .eq('user_id', userId);

    if (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : null;
      if (code === '42P01') {
        return createDefaultSummary(settings.currency);
      }
      throw error;
    }

    const rows: NetworkCommissionRow[] = Array.isArray(data)
      ? data.map((entry) => {
          const raw = entry as Record<string, unknown> & { member?: unknown };

          const normalizeMember = () => {
            const memberData = raw.member;

            if (!memberData) {
              return null;
            }

            if (Array.isArray(memberData)) {
              const first = memberData[0] as Record<string, unknown> | undefined;
              if (!first) {
                return null;
              }
              return {
                name: typeof first.name === 'string' ? first.name : null,
                email: typeof first.email === 'string' ? first.email : null,
              };
            }

            if (typeof memberData === 'object') {
              const memberRecord = memberData as Record<string, unknown>;
              return {
                name: typeof memberRecord.name === 'string' ? memberRecord.name : null,
                email: typeof memberRecord.email === 'string' ? memberRecord.email : null,
              };
            }

            return null;
          };

          return {
            id: String(raw.id ?? ''),
            member_id: String(raw.member_id ?? ''),
            amount_cents: Number(raw.amount_cents ?? 0),
            available_cents: Number(raw.available_cents ?? 0),
            currency: typeof raw.currency === 'string' ? raw.currency : null,
            created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
            member: normalizeMember(),
          } satisfies NetworkCommissionRow;
        })
      : [];

    if (rows.length === 0) {
      return createDefaultSummary(settings.currency);
    }

    const currency = rows[0]?.currency || settings.currency;
    let totalAvailable = 0;
    const memberTotals = new Map<string, NetworkEarningsMemberBreakdown>();

    rows.forEach((row) => {
      const available = Number(row.available_cents ?? 0);
      totalAvailable += available;

      const key = row.member_id;
      if (!memberTotals.has(key)) {
        memberTotals.set(key, {
          memberId: key,
          memberName: row.member?.name ?? null,
          memberEmail: row.member?.email ?? null,
          totalCents: 0,
        });
      }

      const breakdown = memberTotals.get(key);
      if (breakdown) {
        breakdown.totalCents += available;
      }
    });

    const members = Array.from(memberTotals.values()).sort((a, b) => b.totalCents - a.totalCents);

    return {
      totalAvailableCents: totalAvailable,
      currency: currency ?? settings.currency,
      members,
    };
  }

  async decrementAvailable(userId: string, amountCents: number): Promise<DecrementResult[]> {
    if (amountCents <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    const { data, error } = await this.client
      .from('network_commissions')
      .select('id, available_cents, created_at')
      .eq('user_id', userId)
      .gt('available_cents', 0)
      .order('created_at', { ascending: true });

    if (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : null;
      if (code === '42P01') {
        throw new Error('Network commissions table is not provisioned');
      }
      throw error;
    }

    const rows = Array.isArray(data) ? (data as Array<{ id: string; available_cents: number }>) : [];

    const totalAvailable = rows.reduce((sum, row) => sum + Number(row.available_cents ?? 0), 0);
    
    if (totalAvailable === 0) {
      throw new Error('No tienes ganancias disponibles para transferir. Las comisiones aparecerán aquí cuando tu equipo realice compras.');
    }
    
    if (totalAvailable < amountCents) {
      throw new Error(`Saldo insuficiente. Tienes $${(totalAvailable / 100).toFixed(2)} disponibles pero intentas transferir $${(amountCents / 100).toFixed(2)}.`);
    }

    let remaining = amountCents;
    const decremented: DecrementResult[] = [];

    for (const row of rows) {
      if (remaining <= 0) {
        break;
      }

      const currentAvailable = Number(row.available_cents ?? 0);
      if (currentAvailable <= 0) {
        continue;
      }

      const deduction = Math.min(currentAvailable, remaining);

      const { error: updateError } = await this.client
        .from('network_commissions')
        .update({
          available_cents: currentAvailable - deduction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateError) {
        throw updateError;
      }

      decremented.push({ id: row.id, deductedCents: deduction });
      remaining -= deduction;
    }

    if (remaining > 0) {
      throw new Error('Unable to allocate the full amount from available commissions');
    }

    return decremented;
  }

  /**
   * Admin-only: Adjust network earnings balance
   * Creates or updates a commission entry with a special admin member_id
   */
  async adminAdjustEarnings(
    userId: string,
    targetAmountCents: number,
    _note?: string
  ): Promise<void> {
    if (targetAmountCents < 0) {
      throw new Error('Target amount cannot be negative');
    }

    // Get current total
    const summary = await this.fetchAvailableSummary(userId);
    const currentTotal = summary.totalAvailableCents;
    const delta = targetAmountCents - currentTotal;

    if (delta === 0) {
      return; // No change needed
    }

    // Use a special UUID for admin adjustments
    const ADMIN_ADJUSTMENT_MEMBER_ID = '00000000-0000-0000-0000-000000000001';

    if (delta > 0) {
      // Add earnings
      const settings = await getCachedAppSettings();

      const { error } = await this.client
        .from('network_commissions')
        .insert({
          user_id: userId,
          member_id: ADMIN_ADJUSTMENT_MEMBER_ID,
          amount_cents: delta,
          available_cents: delta,
          currency: settings.currency,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }
    } else {
      // Deduct earnings (delta is negative)
      const amountToDeduct = Math.abs(delta);
      
      // Get all available commissions ordered by creation date
      const { data, error } = await this.client
        .from('network_commissions')
        .select('id, available_cents')
        .eq('user_id', userId)
        .gt('available_cents', 0)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? (data as Array<{ id: string; available_cents: number }>) : [];
      
      let remaining = amountToDeduct;

      for (const row of rows) {
        if (remaining <= 0) break;

        const currentAvailable = Number(row.available_cents ?? 0);
        if (currentAvailable <= 0) continue;

        const deduction = Math.min(currentAvailable, remaining);

        const { error: updateError } = await this.client
          .from('network_commissions')
          .update({
            available_cents: currentAvailable - deduction,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        if (updateError) {
          throw updateError;
        }

        remaining -= deduction;
      }

      if (remaining > 0) {
        throw new Error('Insufficient available earnings to complete the adjustment');
      }
    }
  }
}
