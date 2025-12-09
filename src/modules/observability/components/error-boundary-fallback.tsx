'use client';

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

/**
 * ErrorBoundaryFallback renders a resilient, mobile-first fallback UI whenever an unrecoverable error occurs.
 * The copy is intentionally bilingual so the experience stays consistent for every locale while translations
 * are propagated through the rest of the app.
 */
export function ErrorBoundaryFallback(): React.JSX.Element {
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <section className="flex min-h-[40vh] flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <AlertTriangle aria-hidden className="h-12 w-12 text-destructive" />
      <div className="space-y-2">
        <h2 className="text-balance text-xl font-semibold">
          Something went wrong. / Ocurrió un problema inesperado.
        </h2>
        <p className="text-sm text-muted-foreground">
          We have already registered the incident. Please refresh to try again. /
          Ya registramos el incidente automáticamente. Actualiza para intentarlo nuevamente.
        </p>
      </div>
      <Button
        size="lg"
        className="min-h-11 min-w-[11rem] gap-2"
        onClick={handleReload}
        aria-label="Reload the page / Recargar la página"
      >
        <RefreshCcw className="h-5 w-5" />
        Refresh / Actualizar
      </Button>
    </section>
  );
}
