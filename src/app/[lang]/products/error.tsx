'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to a reporting service
    // This includes the error message, stack trace, and a digest for server-side errors.
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-lg text-center">
            <CardHeader>
                <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="mt-4 text-2xl font-headline">¡Oops! Algo salió mal</CardTitle>
                <CardDescription className="text-lg">
                    Se encontró un error al procesar tu solicitud.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">
                    Puedes intentar recargar la página. Si el problema persiste, contacta a soporte.
                </p>
                <Button onClick={() => reset()} size="lg">
                    Intentar de Nuevo
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
