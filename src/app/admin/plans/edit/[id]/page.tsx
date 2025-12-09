'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanForm } from '../../plan-form';
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Plan } from '@/lib/models/definitions';
import { useSiteBranding } from '@/contexts/site-branding-context';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function EditPlanPage() {
  const searchParams = useSearchParams();
  const lang = (searchParams.get('lang') as Locale) || 'en';
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);

  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{dict.admin.planForm.loading}</p>
        </div>
      </div>
    }>
      <EditPlanPageContent />
    </Suspense>
  );
}

function EditPlanPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const lang = (searchParams.get('lang') as Locale) || 'en';
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const response = await fetch(`/api/admin/plans/${id}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Plan no encontrado');
          } else {
            const body = await response.json().catch(() => null);
            const message = body?.error || 'Error al cargar el plan';
            setError(message);
          }
          return;
        }

        const fetchedPlan = await response.json();
        setPlan(fetchedPlan);
      } catch (err) {
        console.error('Error fetching plan:', err);
        setError('Error al cargar el plan');
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="mb-6">
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/admin/plans?lang=${lang}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {dict.admin.planForm.backToPlans}
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{dict.admin.planForm.error}</AlertTitle>
          <AlertDescription>
            {error || dict.admin.planForm.notFound}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/admin/plans?lang=${lang}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {dict.admin.planForm.backToPlans}
          </Link>
        </Button>
      </div>

      <Card className="border-2">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="font-headline text-3xl tracking-tight">
            {dict.admin.editPlan}
          </CardTitle>
          <CardDescription className="text-base">
            {dict.admin.editPlanDesc} &quot;{lang === 'es' ? (plan.name_es || plan.name) : (plan.name_en || plan.name)}&quot;
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PlanForm lang={lang} plan={plan} />
        </CardContent>
      </Card>
    </div>
  );
}