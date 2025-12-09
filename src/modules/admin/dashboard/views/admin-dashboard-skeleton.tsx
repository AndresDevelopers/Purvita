import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';

interface AdminDashboardSkeletonProps {
  lang: Locale;
}

export const AdminDashboardSkeleton = ({ lang }: AdminDashboardSkeletonProps) => {
  const loadingLabel = getDictionary(lang, DEFAULT_APP_NAME).adminDashboardSkeleton.loading;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="h-8 w-36 animate-pulse rounded-md bg-primary/20" />
        <p className="text-sm text-background-dark/60 dark:text-background-light/60">{loadingLabel}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-xl border border-primary/20 bg-background-light p-6 shadow-sm dark:border-primary/30 dark:bg-background-dark">
            <div className="h-4 w-20 animate-pulse rounded-md bg-primary/20" />
            <div className="mt-4 h-8 w-24 animate-pulse rounded-md bg-primary/30" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded-md bg-primary/20" />
        <div className="h-32 animate-pulse rounded-xl border border-primary/10 bg-primary/10 dark:border-primary/20 dark:bg-primary/10" />
      </div>

      <div className="space-y-3">
        <div className="h-6 w-40 animate-pulse rounded-md bg-primary/20" />
        <div className="h-32 animate-pulse rounded-xl border border-primary/10 bg-primary/10 dark:border-primary/20 dark:bg-primary/10" />
      </div>

      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded-md bg-primary/20" />
        <div className="h-32 animate-pulse rounded-xl border border-primary/10 bg-primary/10 dark:border-primary/20 dark:bg-primary/10" />
      </div>
    </div>
  );
};
