import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import AdminGuard from '@/components/admin-guard';
import { RoleForm } from '@/components/admin/role-form';

export const dynamic = 'force-dynamic';

export default async function NewRolePage({ searchParams }: { searchParams: Promise<{ lang?: Locale }> }) {
  const params = await searchParams;
  const lang = params.lang || 'en';

  return (
    <AdminGuard lang={lang}>
      <NewRolePageContent lang={lang} />
    </AdminGuard>
  );
}

async function NewRolePageContent({ lang }: { lang: Locale }) {
  const dict = await getLocalizedDictionary(lang);
  const copy = dict.admin.roles;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/roles?lang=${lang}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">{copy.createRole}</h1>
          <p className="text-muted-foreground mt-1">{copy.description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.createRole}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <RoleForm lang={lang} copy={copy} />
        </CardContent>
      </Card>
    </div>
  );
}

