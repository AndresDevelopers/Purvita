
import type { Locale } from '@/i18n/config';
import type { ProductReviewDisplay } from '../types/product-review';

type ReviewApiPayload = {
  id?: string;
  author?: string | null;
  avatarUrl?: string | null;
  rating?: number | null;
  comment?: string | null;
  createdAt?: string | null;
  userId?: string | null;
  source?: 'admin' | 'member' | string | null;
};

export const computeRelativeTimeAgo = (
  createdAt: string | null | undefined,
  lang: Locale,
): string | undefined => {
  if (!createdAt) {
    return undefined;
  }

  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / (1000 * 60));

  if (!Number.isFinite(minutes)) {
    return undefined;
  }

  const thresholds: Array<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { limit: 60, divisor: 1, unit: 'minute' },
    { limit: 60 * 24, divisor: 60, unit: 'hour' },
    { limit: 60 * 24 * 7, divisor: 60 * 24, unit: 'day' },
    { limit: 60 * 24 * 30, divisor: 60 * 24 * 7, unit: 'week' },
    { limit: 60 * 24 * 365, divisor: 60 * 24 * 30, unit: 'month' },
  ];

  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const threshold of thresholds) {
    if (minutes < threshold.limit) {
      const value = -Math.round(minutes / threshold.divisor);
      return formatter.format(value, threshold.unit);
    }
  }

  const years = -Math.round(minutes / (60 * 24 * 365));
  return formatter.format(years, 'year');
};

export const normalizeMemberReviewResponse = (
  value: unknown,
  lang: Locale,
): ProductReviewDisplay | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as ReviewApiPayload;
  const id = typeof payload.id === 'string' && payload.id.trim().length > 0
    ? payload.id
    : Math.random().toString(36).slice(2);
  const author = typeof payload.author === 'string' && payload.author.trim().length > 0
    ? payload.author.trim()
    : 'Customer';
  const rating = typeof payload.rating === 'number' && Number.isFinite(payload.rating)
    ? payload.rating
    : 0;
  const comment = typeof payload.comment === 'string' ? payload.comment : '';
  const createdAt = typeof payload.createdAt === 'string' && payload.createdAt.length > 0
    ? payload.createdAt
    : null;

  if (comment.trim().length === 0 || rating <= 0) {
    return null;
  }

  return {
    id,
    author,
    avatarUrl:
      typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim().length > 0
        ? payload.avatarUrl
        : undefined,
    rating,
    comment,
    createdAt,
    timeAgo: computeRelativeTimeAgo(createdAt, lang),
    source: payload.source === 'admin' ? 'admin' : 'member',
    userId: typeof payload.userId === 'string' ? payload.userId : undefined,
  } satisfies ProductReviewDisplay;
};
