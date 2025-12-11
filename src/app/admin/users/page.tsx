import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { UserProfile } from '@/lib/models/definitions';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import { DeleteUserButton } from '@/components/admin/delete-user-button';
import { getUsers } from '@/lib/services/user-service';
import AdminGuard from '@/components/admin-guard';
import { UserFilters } from '@/components/admin/user-filters';
import { createClient } from '@/lib/supabase/server';
import { UserFilters as UserFiltersType } from '@/modules/users/domain/contracts/user-repository';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ lang?: Locale; levels?: string; subscriptionStatus?: string }> }) {
    const params = await searchParams;
    const lang = params.lang || 'en';

    const levels = params.levels ? params.levels.split(',').map(Number) : undefined;
    const subscriptionStatus = params.subscriptionStatus ? params.subscriptionStatus.split(',') : undefined;

    return (
        <AdminGuard lang={lang} requiredPermission="manage_users">
            <AdminUsersPageContent lang={lang} filters={{ levels, subscriptionStatus }} />
        </AdminGuard>
    );
}

async function AdminUsersPageContent({ lang, filters }: { lang: Locale; filters: UserFiltersType }) {
    const dict = await getLocalizedDictionary(lang as Locale);
    let users: UserProfile[] = [];

    try {
        // Call the service directly instead of making an HTTP request
        // This avoids authentication issues with server-side fetch
        users = await getUsers(filters);
    } catch (error) {
        console.error('Error fetching users:', error);
        users = [];
    }

    const supabase = await createClient();
    const { data: phaseLevels } = await supabase
        .from('phase_levels')
        .select('level, name, name_es')
        .order('level', { ascending: true });

    const levelOptions = phaseLevels?.map((l) => ({
        value: l.level,
        label: lang === 'es' ? (l.name_es || l.name) : l.name,
    })) || [];

    const subscriptionStatusOptions = [
        { value: 'active', label: dict.team.statusActive || 'Active' },
        { value: 'inactive', label: dict.team.statusInactive || 'Inactive' },
        { value: 'past_due', label: dict.admin?.common?.pastDue || 'Past Due' },
        { value: 'canceled', label: dict.admin?.common?.canceled || 'Canceled' },
        { value: 'incomplete', label: dict.admin?.common?.incomplete || 'Incomplete' },
        { value: 'trialing', label: dict.admin?.common?.trialing || 'Trialing' },
        { value: 'unpaid', label: dict.admin?.common?.unpaid || 'Unpaid' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold font-headline">{dict.admin.users}</h1>
                <div className="flex items-center gap-2">
                    <Input className="w-full md:max-w-sm" placeholder={(dict.admin as any).filterUsers ?? 'Filter users'} />
                    <UserFilters
                        levels={levelOptions}
                        subscriptionStatuses={subscriptionStatusOptions}
                        dict={dict}
                    />
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>{(dict.admin as any).userManagement ?? 'User Management'}</CardTitle>
                    <CardDescription>{(dict.admin as any).userManagementDesc ?? 'Manage users'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {users.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {(dict.admin as any).noUsersFound ?? 'No users found'}
                        </div>
                    ) : null}

                    {users.length > 0 ? (
                        <div className="grid gap-4 md:hidden">
                            {users.map((user) => (
                                <div key={user.id} className="rounded-lg border bg-card px-4 py-5 shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <Avatar className="h-12 w-12">
                                            <AvatarImage src={user.avatar_url || undefined} />
                                            <AvatarFallback>
                                                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <p className="text-base font-semibold">{user.name || user.email}</p>
                                                <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <Badge variant={user.role_name ? 'default' : 'secondary'}>
                                                    {user.role_name?.name || (dict.admin?.common?.noRole || 'No Role')}
                                                </Badge>
                                                <Badge
                                                    variant={user.status === 'active' ? 'default' : user.status === 'suspended' ? 'destructive' : 'secondary'}
                                                    className={user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : ''}
                                                >
                                                    {user.status === 'active'
                                                        ? dict.team.statusActive
                                                        : user.status === 'inactive'
                                                            ? dict.team.statusInactive
                                                            : (dict.admin?.common?.suspended || 'Suspended')}
                                                </Badge>
                                                {user.subscription_status === 'active' && user.subscription_type ? (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        {user.subscription_type === 'mlm' ? (dict.admin?.common?.mlmSubscription || '🌐 MLM') : (dict.admin?.common?.affiliateSubscription || '🛒 Affiliate')}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        {dict.admin?.common?.noSubscription || 'No subscription'}
                                                    </Badge>
                                                )}
                                                <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                                    {(dict.admin as any).joinDate ?? 'Join Date'}: {new Date(user.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" suppressHydrationWarning>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">{(dict.admin as any).actions ?? 'Actions'}</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/admin/users/edit/${user.id}?lang=${lang}`}>
                                                                {(dict.admin as any).editUser ?? 'Edit User'}
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/admin/users/details/${user.id}?lang=${lang}`}>
                                                                {(dict.admin as any).viewDetails ?? 'View Details'}
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DeleteUserButton
                                                            userId={user.id}
                                                            userName={user.name || user.email || ((dict.admin as any)?.common?.user ?? 'User')}
                                                            deleteLabel={(dict.admin as any).deleteUser ?? 'Delete User'}
                                                            lang={lang}
                                                        />
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <div className="hidden md:block">
                        <Table className="min-w-[720px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{(dict.admin as any).user ?? 'User'}</TableHead>
                                    <TableHead>{(dict.admin as any).role ?? 'Role'}</TableHead>
                                    <TableHead>{(dict.admin as any).status ?? 'Status'}</TableHead>
                                    <TableHead>{dict.admin?.common?.level || 'Level'}</TableHead>
                                    <TableHead>{dict.admin?.common?.subscription || 'Subscription'}</TableHead>
                                    <TableHead>{(dict.admin as any).joinDate ?? 'Join Date'}</TableHead>
                                    <TableHead className="text-right">{(dict.admin as any).actions ?? 'Actions'}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <Avatar>
                                                    <AvatarImage src={user.avatar_url || undefined} />
                                                    <AvatarFallback>{user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.name || user.email}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.role_name ? 'default' : 'secondary'}>
                                                {user.role_name?.name || (dict.admin?.common?.noRole || 'No Role')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={user.status === 'active' ? 'default' : user.status === 'suspended' ? 'destructive' : 'secondary'}
                                                className={user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : ''}
                                            >
                                                {user.status === 'active' ? dict.team.statusActive : user.status === 'inactive' ? dict.team.statusInactive : (dict.admin?.common?.suspended || 'Suspended')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {user.current_phase !== undefined ? (
                                                <Badge variant="outline">{dict.admin?.common?.level || 'Level'} {user.current_phase}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.subscription_status === 'active' && user.subscription_type ? (
                                                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                                    {user.subscription_type === 'mlm' ? (dict.admin?.common?.mlmSubscription || '🌐 MLM') : (dict.admin?.common?.affiliateSubscription || '🛒 Affiliate')}
                                                </Badge>
                                            ) : user.subscription_status ? (
                                                <Badge variant="secondary">
                                                    {user.subscription_status}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">{dict.admin?.common?.noSubscription || 'No subscription'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" suppressHydrationWarning>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/admin/users/edit/${user.id}?lang=${lang}`}>{(dict.admin as any).editUser ?? 'Edit User'}</Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/admin/users/details/${user.id}?lang=${lang}`}>{(dict.admin as any).viewDetails ?? 'View Details'}</Link>
                                                    </DropdownMenuItem>
                                                    <DeleteUserButton
                                                        userId={user.id}
                                                        userName={user.name || user.email || ((dict.admin as any)?.common?.user ?? 'User')}
                                                        deleteLabel={(dict.admin as any).deleteUser ?? 'Delete User'}
                                                        lang={lang}
                                                    />
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                            {(dict.admin as any).noUsersFound ?? 'No users found'}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
