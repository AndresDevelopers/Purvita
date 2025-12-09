import { createHash } from 'crypto';

import { i18n, type Locale } from '@/i18n/config';

export interface RequestFingerprint {
  fingerprint: string;
  locale: Locale;
}

const RATE_LIMIT_HEADER_ORDER = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];

const extractIp = (request: Request): string => {
  for (const header of RATE_LIMIT_HEADER_ORDER) {
    const value = request.headers.get(header);
    if (value) {
      const [first] = value.split(',');
      if (first) {
        return first.trim();
      }
    }
  }

  const socketAddress = (request as unknown as { ip?: string }).ip;
  if (socketAddress) {
    return socketAddress;
  }

  return 'anonymous';
};

const resolveLocale = (request: Request): Locale => {
  const header = request.headers.get('accept-language');
  if (!header) {
    return i18n.defaultLocale;
  }

  const candidates = header
    .split(',')
    .map((part) => part.split(';')[0]?.trim()?.toLowerCase())
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (i18n.locales.includes(candidate as Locale)) {
      return candidate as Locale;
    }

    const [base] = candidate.split('-');
    if (base && i18n.locales.includes(base as Locale)) {
      return base as Locale;
    }
  }

  return i18n.defaultLocale;
};

export const getRequestFingerprint = (request: Request): RequestFingerprint => {
  const ip = extractIp(request);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const locale = resolveLocale(request);

  const raw = `${ip}|${userAgent}`;
  const fingerprint = createHash('sha256').update(raw).digest('hex');

  return { fingerprint, locale };
};
