'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowLeft, Loader2 } from 'lucide-react';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  lang: Locale;
  fallbackUrl?: string;
  /** If specified, only allow this subscription type */
  requiredType?: 'mlm' | 'affiliate';
  /** 
   * If true, allows access even without subscription.
   * The children will still render but can check subscription status.
   * Useful for dashboard where user should see content but with limited features.
   */
  allowWithoutSubscription?: boolean;
}

/**
 * SubscriptionGuard - Protects routes that require an active subscription.
 * 
 * This guard checks if the user has an active subscription (MLM or Affiliate).
 * Optionally, you can require a specific subscription type.
 * 
 * Use this for:
 * - /dashboard - Store dashboard
 * - /analytics - Store analytics
 * - Any feature that requires an active subscription
 */
export default function SubscriptionGuard({ 
  children, 
  lang, 
  fallbackUrl,
  requiredType,
  allowWithoutSubscription = false
}: SubscriptionGuardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_subscriptionType, setSubscriptionType] = useState<'mlm' | 'affiliate' | null>(null);

  useEffect(() => {
    let ignore = false;

    const checkSubscriptionAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (!ignore) {
            router.push(`/${lang}/login`);
          }
          return;
        }

        // Build query for active subscription
        let query = supabase
          .from('subscriptions')
          .select('status, subscription_type')
          .eq('user_id', session.user.id)
          .eq('status', 'active');

        // If a specific type is required, filter by it
        if (requiredType) {
          query = query.eq('subscription_type', requiredType);
        }

        const { data: subscription, error: subError } = await query
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) {
          console.error('[SubscriptionGuard] Error checking subscription:', subError);
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
            setSubscriptionType(subscription.subscription_type as 'mlm' | 'affiliate');
          } else if (allowWithoutSubscription) {
            // Allow access without subscription - dashboard will show appropriate UI
            setHasAccess(true);
            setSubscriptionType(null);
          } else {
            const typeLabel = requiredType === 'mlm' 
              ? (lang === 'es' ? 'Red Multinivel (MLM)' : 'Multilevel Network (MLM)')
              : requiredType === 'affiliate'
                ? (lang === 'es' ? 'Afiliado' : 'Affiliate')
                : (lang === 'es' ? 'activa' : 'active');
            
            setError(lang === 'es'
              ? `Esta sección requiere una suscripción ${typeLabel}.`
              : `This section requires an ${typeLabel} subscription.`);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[SubscriptionGuard] Unexpected error:', err);
        if (!ignore) {
          setError(lang === 'es' 
            ? 'Error inesperado al verificar acceso.' 
            : 'Unexpected error verifying access.');
          setIsLoading(false);
        }
      }
    };

    void checkSubscriptionAccess();

    return () => {
      ignore = true;
    };
  }, [lang, router, requiredType, allowWithoutSubscription]);

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
                <CreditCard className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-xl">
                {lang === 'es' ? 'Suscripción Requerida' : 'Subscription Required'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {error || (lang === 'es'
                  ? 'Esta sección requiere una suscripción activa.'
                  : 'This section requires an active subscription.')}
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
                onClick={() => router.push(fallbackUrl || `/${lang}/settings`)}
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
