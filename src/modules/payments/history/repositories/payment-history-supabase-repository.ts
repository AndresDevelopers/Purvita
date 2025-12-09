import { addDays, addMonths, formatISO } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ManualPaymentInputSchema,
  PaymentHistoryEntrySchema,
  PaymentHistoryFilterSchema,
  PaymentStatusSchema,
  type ManualPaymentInput,
  type PaymentHistoryEntry,
  type PaymentHistoryFilter,
  type PaymentStatus,
} from '../domain/models/payment-history-entry';
import {
  PaymentScheduleConfigSchema,
  PaymentScheduleUpdateInputSchema,
  type PaymentScheduleConfig,
  type PaymentScheduleUpdateInput,
} from '../domain/models/payment-schedule';
import type { PaymentHistoryRepository } from './payment-history-repository';

type PaymentHistoryRow = {
  id: string;
  user_id: string;
  user_name_snapshot: string | null;
  user_email_snapshot: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  next_due_date: string | null;
  method: string;
  manual: boolean;
  notes: string | null;
  created_at: string;
  profiles?: { name?: string | null; email?: string | null } | null;
};

type PaymentScheduleRow = {
  frequency: string;
  day_of_month: number | null;
  weekday: number | null;
  reminder_days_before: number[] | null;
  default_amount_cents: number;
  currency: string;
  payment_mode: string;
  updated_at: string | null;
};

export interface SupabasePaymentHistoryRepositoryOptions {
  currentUserId?: string | null;
}

const DEFAULT_SCHEDULE: PaymentScheduleConfig = PaymentScheduleConfigSchema.parse({
  frequency: 'monthly',
  dayOfMonth: 10,
  weekday: null,
  reminderDaysBefore: [3, 1],
  defaultAmountCents: 3499,
  currency: 'USD',
  paymentMode: 'automatic',
  updatedAt: formatISO(new Date()),
});

const sanitizeReminderDays = (reminders: number[]): number[] => {
  const unique = Array.from(new Set(reminders.map((value) => Math.max(0, Math.min(30, value)))));
  return unique
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
    .slice(0, 3);
};

const mapRowToEntry = (row: PaymentHistoryRow): PaymentHistoryEntry =>
  PaymentHistoryEntrySchema.parse({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name_snapshot ?? row.profiles?.name ?? '—',
    userEmail: row.user_email_snapshot ?? row.profiles?.email ?? 'unknown@example.com',
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    nextDueDate: row.next_due_date,
    method: row.method,
    manual: row.manual,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  });

const mapScheduleRow = (row: PaymentScheduleRow | null): PaymentScheduleConfig => {
  if (!row) {
    return DEFAULT_SCHEDULE;
  }

  return PaymentScheduleConfigSchema.parse({
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    weekday: row.weekday,
    reminderDaysBefore: row.reminder_days_before ?? [],
    defaultAmountCents: row.default_amount_cents,
    currency: row.currency,
    paymentMode: row.payment_mode ?? 'automatic',
    updatedAt: row.updated_at ?? formatISO(new Date()),
  });
};

const computeNextDueDate = (paidAt: Date, schedule: PaymentScheduleConfig): string | null => {
  switch (schedule.frequency) {
    case 'weekly': {
      const base = addDays(paidAt, 7);
      if (schedule.weekday == null) {
        return formatISO(base);
      }

      let candidate = new Date(base);
      while (candidate.getUTCDay() !== schedule.weekday) {
        candidate = addDays(candidate, 1);
      }
      return formatISO(candidate);
    }
    case 'biweekly': {
      const base = addDays(paidAt, 14);
      if (schedule.weekday == null) {
        return formatISO(base);
      }

      let candidate = new Date(base);
      while (candidate.getUTCDay() !== schedule.weekday) {
        candidate = addDays(candidate, 1);
      }
      return formatISO(candidate);
    }
    case 'monthly': {
      const nextMonth = addMonths(paidAt, 1);
      const target = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 1));
      const desiredDay = schedule.dayOfMonth ?? paidAt.getUTCDate();
      const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(desiredDay, daysInMonth));
      target.setUTCHours(paidAt.getUTCHours(), paidAt.getUTCMinutes(), paidAt.getUTCSeconds(), paidAt.getUTCMilliseconds());
      return formatISO(target);
    }
    default:
      return null;
  }
};

export class SupabasePaymentHistoryRepository implements PaymentHistoryRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly options: SupabasePaymentHistoryRepositoryOptions = {},
  ) {}

  async getHistory(filter?: PaymentHistoryFilter): Promise<PaymentHistoryEntry[]> {
    const safeFilter = filter ? PaymentHistoryFilterSchema.parse(filter) : undefined;

    let query = this.client
      .from('payment_history_entries')
      .select(
        `id, user_id, user_name_snapshot, user_email_snapshot, amount_cents, currency, status, due_date, paid_at, next_due_date, method, manual, notes, created_at, profiles!user_id(name, email)`,
      )
      .order('due_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (safeFilter?.status) {
      query = query.eq('status', safeFilter.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SupabasePaymentHistoryRepository] Error fetching history:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Database error: ${error.message} (code: ${error.code || 'unknown'})`);
    }

    return (data ?? []).map((row) => mapRowToEntry(row as PaymentHistoryRow));
  }

  async addManualPayment(input: ManualPaymentInput): Promise<PaymentHistoryEntry> {
    const payload = ManualPaymentInputSchema.parse(input);
    const schedule = await this.getSchedule();
    const now = new Date();
    const paidAt = payload.paidAt ? new Date(payload.paidAt) : now;
    const nextDueDate = computeNextDueDate(paidAt, schedule);

    const { data, error } = await this.client
      .from('payment_history_entries')
      .insert({
        user_id: payload.userId,
        user_name_snapshot: payload.userName,
        user_email_snapshot: payload.userEmail,
        amount_cents: payload.amountCents,
        currency: payload.currency,
        status: 'paid',
        due_date: formatISO(now),
        paid_at: formatISO(paidAt),
        next_due_date: nextDueDate,
        method: payload.method,
        manual: true,
        notes: payload.notes ?? null,
        recorded_by: this.options.currentUserId ?? null,
      })
      .select(
        `id, user_id, user_name_snapshot, user_email_snapshot, amount_cents, currency, status, due_date, paid_at, next_due_date, method, manual, notes, created_at, profiles!user_id(name, email)`,
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRowToEntry(data as PaymentHistoryRow);
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<PaymentHistoryEntry> {
    const safeStatus = PaymentStatusSchema.parse(status);

    const { data, error } = await this.client
      .from('payment_history_entries')
      .update({
        status: safeStatus,
        paid_at: safeStatus === 'paid' ? formatISO(new Date()) : null,
        updated_at: formatISO(new Date()),
      })
      .eq('id', id)
      .select(
        `id, user_id, user_name_snapshot, user_email_snapshot, amount_cents, currency, status, due_date, paid_at, next_due_date, method, manual, notes, created_at, profiles!user_id(name, email)`,
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRowToEntry(data as PaymentHistoryRow);
  }

  async getSchedule(): Promise<PaymentScheduleConfig> {
    const { data, error } = await this.client
      .from('payment_schedule_settings')
      .select('frequency, day_of_month, weekday, reminder_days_before, default_amount_cents, currency, payment_mode, updated_at')
      .eq('id', true)
      .maybeSingle();

    if (error) {
      console.error('[SupabasePaymentHistoryRepository] Error fetching schedule:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Database error fetching schedule: ${error.message} (code: ${error.code || 'unknown'})`);
    }

    return mapScheduleRow((data as PaymentScheduleRow | null) ?? null);
  }

  async updateSchedule(input: PaymentScheduleUpdateInput): Promise<PaymentScheduleConfig> {
    const safeInput = PaymentScheduleUpdateInputSchema.parse(input);
    const current = await this.getSchedule();
    const merged = {
      ...current,
      ...safeInput,
    };

    if (merged.frequency !== 'monthly') {
      merged.dayOfMonth = null;
    }

    if (merged.frequency === 'weekly' || merged.frequency === 'biweekly') {
      if (merged.weekday == null) {
        merged.weekday = 1;
      }
    } else {
      merged.weekday = null;
    }

    merged.reminderDaysBefore = sanitizeReminderDays(merged.reminderDaysBefore);

    const schedule = PaymentScheduleConfigSchema.parse({
      ...merged,
      updatedAt: formatISO(new Date()),
    });

    const { data, error } = await this.client
      .from('payment_schedule_settings')
      .upsert(
        {
          id: true,
          frequency: schedule.frequency,
          day_of_month: schedule.dayOfMonth,
          weekday: schedule.weekday,
          reminder_days_before: schedule.reminderDaysBefore,
          default_amount_cents: schedule.defaultAmountCents,
          currency: schedule.currency,
          payment_mode: schedule.paymentMode,
          updated_at: schedule.updatedAt,
          updated_by: this.options.currentUserId ?? null,
        },
        { onConflict: 'id' },
      )
      .select('frequency, day_of_month, weekday, reminder_days_before, default_amount_cents, currency, payment_mode, updated_at')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapScheduleRow(data as PaymentScheduleRow);
  }
}

export default SupabasePaymentHistoryRepository;
