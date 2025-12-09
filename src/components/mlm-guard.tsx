'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowLeft, Loader2 } from 'lucide-react';

interface MLMGuardProps {
  children: React.ReactNode;
  lang: Locale;
  fallbackUrl?: string;
}

/**
 * MLMGuard - Protects routes that are only accessible to users with MLM subscription.
 * 
 * This guard checks if the user has an active MLM subscription.
 * If not, it shows an access denied message and redirects to the fallback URL.
 * 
 * Use this for:
 * - /team - Network management
 * - /wallet - Wallet/commissions
 * - /income-calculator - Income calculator
 */
export default function MLMGuard({ children, lang, fallbackUrl }: MLMGuardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const checkMLMAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (!ignore) {
            router.push(`/${lang}/login`);
          }
          return;
        }

        // Check if user has active MLM subscription
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('status, subscription_type')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .eq('subscription_type', 'mlm')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) {
          console.error('[MLMGuard] Error checking subscription:', subError);
          if (!ignore) {
            setError(lang === 'es' 
              ? 'Error al verificar tu suscripción.' 
              : 'Error verifying your subscription.');
            setIsLoading(false);
          }
          return;
        }

        if (!ignore) {
          if (subscription) {
            setHasAccess(true);
          } else {
            setError(lang === 'es'
              ? 'Esta sección está disponible solo para suscriptores de Red Multinivel (MLM).'
              : 'This section is only available for Multilevel Network (MLM) subscribers.');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[MLMGuard] Unexpected error:', err);
        if (!ignore) {
          setError(lang === 'es' 
            ? 'Error inesperado al verificar acceso.' 
            : 'Unexpected error verifying access.');
          setIsLoading(false);
        }
      }
    };

    void checkMLMAccess();

    return () => {
      ignore = true;
    };
  }, [lang, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {lang === 'es' ? 'Verificando acceso...' : 'Verifying access...'}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess || error) {
    return (
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Users className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-xl">
                {lang === 'es' ? 'Acceso Restringido' : 'Restricted Access'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {error || (lang === 'es'
                  ? 'Esta sección requiere una suscripción MLM activa.'
                  : 'This section requires an active MLM subscription.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button 
                onClick={() => router.push(`/${lang}/subscription`)}
                className="w-full"
              >
                {lang === 'es' ? 'Ver Planes de Suscripción' : 'View Subscription Plans'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push(fallbackUrl || `/${lang}/dashboard`)}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {lang === 'es' ? 'Volver' : 'Go Back'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
