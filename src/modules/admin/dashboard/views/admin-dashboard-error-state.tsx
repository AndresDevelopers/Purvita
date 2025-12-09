import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';

interface AdminDashboardErrorStateProps {
  lang: Locale;
  onRetry: () => Promise<void> | void;
  isRetrying?: boolean;
}

export const AdminDashboardErrorState = ({ lang, onRetry, isRetrying = false }: AdminDashboardErrorStateProps) => {
  const copy = getDictionary(lang, DEFAULT_APP_NAME).adminDashboardErrorState;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 shadow-sm dark:border-rose-900/40 dark:bg-rose-900/30 dark:text-rose-100">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500 dark:bg-rose-800/70 dark:text-rose-100">
        !
      </div>
      <div>
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="mt-2 text-sm opacity-80">{copy.description}</p>
      </div>
      <button
        type="button"
        onClick={() => onRetry()}
        disabled={isRetrying}
        className="inline-flex items-center rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring focus:ring-rose-300 disabled:opacity-70 dark:bg-rose-500 dark:hover:bg-rose-400"
      >
        {isRetrying ? `${copy.action}...` : copy.action}
      </button>
    </div>
  );
};
