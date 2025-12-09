import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanForm } from '../plan-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ lang?: Locale }> }) {
  const params = await searchParams;
  const lang = params?.lang || 'en';
  const _dict = await getLocalizedDictionary(lang as Locale);

  return (
    <div>
      <Button variant="ghost" asChild className="mb-4">
        <Link href={`/admin/plans?lang=${lang}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a planes
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Crear nuevo plan</CardTitle>
          <CardDescription>Agrega un nuevo plan de suscripción al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanForm lang={lang} />
        </CardContent>
      </Card>
    </div>
  );
}