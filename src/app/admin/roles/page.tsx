import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import AdminGuard from '@/components/admin-guard';
import { getServiceRoleClient } from '@/lib/supabase';
import type { RoleWithCount } from '@/lib/models/role';
import { PERMISSION_LABELS } from '@/lib/models/role';
import { DeleteRoleButton } from './delete-role-button';

export const dynamic = 'force-dynamic';

export default async function AdminRolesPage({ searchParams }: { searchParams: Promise<{ lang?: Locale }> }) {
  const params = await searchParams;
  const lang = params.lang || 'en';

  return (
    <AdminGuard lang={lang} requiredPermission="manage_roles">
      <AdminRolesPageContent lang={lang} />
    </AdminGuard>
  );
}

async function AdminRolesPageContent({ lang }: { lang: Locale }) {
  const dict = await getLocalizedDictionary(lang);
  const supabase = getServiceRoleClient();

  let rolesWithCount: RoleWithCount[] = [];

  if (supabase) {
    // Fetch roles with user count
    const { data: roles, error } = await supabase
      .from('roles')
      .select(`
        *,
        profiles(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching roles:', error);
    }

    rolesWithCount = (roles || []).map((role: any) => ({
      ...role,
      user_count: role.profiles?.[0]?.count || 0,
    }));
  }

  const copy = dict.admin.roles;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">{copy.title}</h1>
          <p className="text-muted-foreground mt-1">{copy.description}</p>
        </div>
        <Button asChild>
          <Link href={`/admin/roles/new?lang=${lang}`}>
            <Plus className="mr-2 h-4 w-4" />
            {copy.createRole}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {rolesWithCount.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">{copy.noRoles}</p>
              <p className="text-sm text-muted-foreground mt-1">{copy.noRolesDescription}</p>
              <Button asChild className="mt-4">
                <Link href={`/admin/roles/new?lang=${lang}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  {copy.createRole}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="grid gap-4 md:hidden">
                {rolesWithCount.map((role) => (
                  <div key={role.id} className="rounded-lg border bg-card px-4 py-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold">{role.name}</p>
                          {role.is_system_role && (
                            <Badge variant="secondary" className="text-[10px]">{dict.admin.common?.system || 'System'}</Badge>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{role.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.slice(0, 2).map((permission) => (
                            <Badge key={permission} variant="outline" className="text-[10px]">
                              {PERMISSION_LABELS[permission][lang]}
                            </Badge>
                          ))}
                          {role.permissions.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{role.permissions.length - 2}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{copy.table.users}:</span>
                          <Badge variant="secondary" className="text-[10px]">{role.user_count}</Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" suppressHydrationWarning>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!role.is_system_role ? (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/roles/edit/${role.id}?lang=${lang}`}>
                                  {copy.editRole}
                                </Link>
                              </DropdownMenuItem>
                              <DeleteRoleButton
                                roleId={role.id}
                                roleName={role.name}
                                lang={lang}
                                copy={{
                                  deleteLabel: copy.deleteRole,
                                  dialogTitle: copy.deleteDialog.title,
                                  dialogDescription: copy.deleteDialog.description,
                                  confirmLabel: copy.deleteDialog.confirm,
                                  cancelLabel: copy.deleteDialog.cancel,
                                  successMessage: copy.toast.deleteSuccess,
                                  errorMessage: copy.toast.deleteError,
                                }}
                              />
                            </>
                          ) : (
                            <DropdownMenuItem disabled>
                              {copy.editRole} ({dict.admin.common?.systemRole || 'System Role'})
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.table.name}</TableHead>
                      <TableHead>{copy.table.description}</TableHead>
                      <TableHead>{copy.table.permissions}</TableHead>
                      <TableHead>{copy.table.users}</TableHead>
                      <TableHead className="text-right">{copy.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rolesWithCount.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">
                          {role.name}
                          {role.is_system_role && (
                            <Badge variant="secondary" className="ml-2">
                              {dict.admin.common?.system || 'System'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {role.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.slice(0, 3).map((permission) => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {PERMISSION_LABELS[permission][lang]}
                              </Badge>
                            ))}
                            {role.permissions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{role.permissions.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{role.user_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!role.is_system_role ? (
                                <>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/admin/roles/edit/${role.id}?lang=${lang}`}>
                                      {copy.editRole}
                                    </Link>
                                  </DropdownMenuItem>
                                  <DeleteRoleButton
                                    roleId={role.id}
                                    roleName={role.name}
                                    lang={lang}
                                    copy={{
                                      deleteLabel: copy.deleteRole,
                                      dialogTitle: copy.deleteDialog.title,
                                      dialogDescription: copy.deleteDialog.description,
                                      confirmLabel: copy.deleteDialog.confirm,
                                      cancelLabel: copy.deleteDialog.cancel,
                                      successMessage: copy.toast.deleteSuccess,
                                      errorMessage: copy.toast.deleteError,
                                    }}
                                  />
                                </>
                              ) : (
                                <DropdownMenuItem disabled>
                                  {copy.editRole} ({dict.admin.common?.systemRole || 'System Role'})
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

