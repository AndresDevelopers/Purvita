import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import AdminGuard from '@/components/admin-guard';
import { RoleForm } from '@/components/admin/role-form';
import { getServiceRoleClient } from '@/lib/supabase';
import type { Role } from '@/lib/models/role';

export const dynamic = 'force-dynamic';

interface EditRolePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: Locale }>;
}

export default async function EditRolePage({ params, searchParams }: EditRolePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const lang = resolvedSearchParams.lang || 'en';

  return (
    <AdminGuard lang={lang}>
      <EditRolePageContent roleId={resolvedParams.id} lang={lang} />
    </AdminGuard>
  );
}

async function EditRolePageContent({ roleId, lang }: { roleId: string; lang: Locale }) {
  const dict = await getLocalizedDictionary(lang);
  const supabase = getServiceRoleClient();

  if (!supabase) {
    throw new Error('Service role client is not available');
  }

  // Fetch role
  const { data: role, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (error || !role) {
    notFound();
  }

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
          <h1 className="text-3xl font-bold font-headline">{copy.editRole}</h1>
          <p className="text-muted-foreground mt-1">{role.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.editRole}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <RoleForm role={role as Role} lang={lang} copy={copy} />
        </CardContent>
      </Card>
    </div>
  );
}

