'use client';

import React from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  lang: Locale;
  onReset?: () => void;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('GlobalErrorBoundary caught an error', error, info);
    // Aquí se podría enviar el error a un servicio de logging
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
    // Recargar la página como fallback
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const dict = getDictionary(this.props.lang, DEFAULT_APP_NAME).errorBoundary;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-light p-6 text-center dark:bg-background-dark">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-500 dark:bg-rose-800/70 dark:text-rose-100">
          ⚠️
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{dict.title}</h1>
          <p className="mt-2 text-muted-foreground">{dict.message}</p>
        </div>
        <button
          type="button"
          onClick={this.handleReset}
          className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 focus:outline-none focus:ring focus:ring-primary/30"
        >
          {dict.action}
        </button>
      </div>
    );
  }
}