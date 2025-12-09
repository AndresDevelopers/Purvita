'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import type { AppSettings } from '@/modules/app-settings/domain/models/app-settings';

interface CompensationOverviewProps {
  lang: Locale;
  settings: AppSettings;
  copy: {
    title?: string;
    description?: string;
    rates?: {
      title?: string;
      base?: { label?: string; helper?: string };
      referral?: { label?: string; helper?: string };
      leadership?: { label?: string; helper?: string };
      payoutFrequency?: { label?: string; helper?: string };
      currency?: { label?: string; helper?: string };
      frequencyOptions?: Partial<Record<AppSettings['payoutFrequency'], string>>;
    };
    earnings?: {
      title?: string;
      helper?: string;
      empty?: string;
      perMember?: string;
      levelLabel?: string;
    };
    capacity?: {
      title?: string;
      helper?: string;
      empty?: string;
      membersSuffix?: string;
      levelLabel?: string;
    };
  };
}

const localeMap: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES',
};

const _formatPercentage = (value: number, options?: { minimumFractionDigits?: number }) => {
  return `${(value * 100).toFixed(options?.minimumFractionDigits ?? 2)}%`;
};

export function CompensationOverview({ lang, settings, copy }: CompensationOverviewProps) {
  const locale = localeMap[lang] ?? 'en-US';
  const title = copy.title ?? 'Compensation & capacity overview';
  const description =
    copy.description ?? 'These metrics update automatically with the administrator application settings.';
  const ratesTitle = copy.rates?.title ?? 'Commission breakdown';
  const _earningsTitle = copy.earnings?.title ?? 'Earnings by level';
  const _earningsHelper =
    copy.earnings?.helper ?? 'Review how much you earn for each active member within every level.';
  const _earningsEmpty = copy.earnings?.empty ?? 'No level compensation configured yet.';
  const _earningsPerMember = copy.earnings?.perMember ?? 'per member';
  const levelLabel = copy.earnings?.levelLabel ?? copy.capacity?.levelLabel ?? 'Level';
  const capacityTitle = copy.capacity?.title ?? 'Capacity by level';
  const capacityHelper =
    copy.capacity?.helper ?? 'The maximum number of members allowed in each level of your organisation.';
  const capacityEmpty = copy.capacity?.empty ?? 'No capacity limits configured yet.';
  const membersSuffix = copy.capacity?.membersSuffix ?? 'members';

  const _currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: settings.currency,
        currencyDisplay: 'symbol',
        maximumFractionDigits: 2,
      });
    } catch (error) {
      console.error('[CompensationOverview] Failed to create formatter', error);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });
    }
  }, [locale, settings.currency]);

  const capacities = useMemo(() => {
    return [...settings.maxMembersPerLevel]
      .sort((a, b) => a.level - b.level)
      .map((entry) => ({
        level: entry.level,
        maxMembers: entry.maxMembers,
      }));
  }, [settings.maxMembersPerLevel]);

  const payoutFrequencyLabel = useMemo(() => {
    const frequencyCopy = copy.rates?.frequencyOptions ?? {};
    return frequencyCopy?.[settings.payoutFrequency] ?? settings.payoutFrequency;
  }, [copy.rates?.frequencyOptions, settings.payoutFrequency]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/70 p-8 shadow-lg dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-teal-500/10">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 opacity-0 transition-opacity duration-300 hover:opacity-100" />
      <div className="relative space-y-8">
        <header className="space-y-3 text-center sm:text-left">
          <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{title}</h2>
          <p className="text-base text-emerald-800/80 dark:text-emerald-100/80">{description}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-5">
            <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">{ratesTitle}</h3>
            <ul className="space-y-4">
              {[{
                label: copy.rates?.payoutFrequency?.label ?? 'Payout frequency',
                helper: copy.rates?.payoutFrequency?.helper,
                value: payoutFrequencyLabel,
              },
              {
                label: copy.rates?.currency?.label ?? 'Currency',
                helper: copy.rates?.currency?.helper,
                value: settings.currency,
              }].map((item) => (
                <li
                  key={item.label}
                  className="rounded-2xl border border-emerald-200/60 bg-white/70 px-4 py-3 text-left shadow-sm backdrop-blur-sm dark:border-emerald-500/40 dark:bg-emerald-500/10"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{item.label}</p>
                      {item.helper ? (
                        <p className="text-xs text-emerald-800/70 dark:text-emerald-100/70">{item.helper}</p>
                      ) : null}
                    </div>
                    <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{item.value}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl border border-emerald-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-emerald-500/40 dark:bg-emerald-500/10">
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">{capacityTitle}</h3>
              <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-100/80">{capacityHelper}</p>
              <ul className="mt-4 space-y-3">
                {capacities.length === 0 ? (
                  <li className="rounded-xl bg-emerald-100/50 px-4 py-3 text-sm text-emerald-800/80 dark:bg-emerald-500/10 dark:text-emerald-100/80">
                    {capacityEmpty}
                  </li>
                ) : (
                  capacities.map((entry) => (
                    <li
                      key={entry.level}
                      className="flex items-center justify-between rounded-xl border border-emerald-200/60 bg-white/80 px-4 py-3 text-sm font-medium text-emerald-900 shadow-sm transition hover:border-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100"
                    >
                      <span>
                        {levelLabel} {entry.level}
                      </span>
                      <span>
                        {entry.maxMembers.toLocaleString(locale)}
                        {membersSuffix ? ` · ${membersSuffix}` : ''}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
