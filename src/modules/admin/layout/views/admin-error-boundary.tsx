'use client';

import React from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';
import { SentryLogger } from '../../../../modules/observability/services/sentry-logger';

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  lang: Locale;
  onReset?: () => void;
}

interface AdminErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AdminErrorBoundary extends React.Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  state: AdminErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AdminErrorBoundary caught an error', error, info);

    // Log admin errors to Sentry
    SentryLogger.captureException(error, {
      module: 'admin',
      operation: 'error_boundary',
      tags: {
        error_type: 'admin_ui_error',
        component: 'AdminErrorBoundary',
      },
      extra: {
        errorInfo: info,
        lang: this.props.lang,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const dict = getDictionary(this.props.lang, DEFAULT_APP_NAME).adminErrorBoundary;

    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 shadow-sm dark:border-rose-900/40 dark:bg-rose-900/30 dark:text-rose-100">
        <h2 className="text-lg font-semibold">{dict.title}</h2>
        <p className="max-w-sm text-sm opacity-80">{dict.message}</p>
        <button
          type="button"
          onClick={this.handleReset}
          className="inline-flex items-center rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow focus:outline-none focus:ring focus:ring-rose-300 dark:bg-rose-500 dark:focus:ring-rose-700"
        >
          {dict.action}
        </button>
      </div>
    );
  }
}
