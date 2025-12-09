'use client';

import { useState, useEffect, use, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash2, Check, ArrowUp, ArrowDown, Star } from 'lucide-react';
import Link from 'next/link';
import { PlanSchema } from '@/lib/models/definitions';
import { useToast } from '@/hooks/use-toast';
import type { Plan } from '@/lib/models/definitions';
import { useSiteBranding } from '@/contexts/site-branding-context';
import AdminGuard from '@/components/admin-guard';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminPlansPage({ searchParams }: { searchParams: Promise<{ lang?: Locale }> }) {
    const params = use(searchParams);
    const lang = params.lang || 'en';

    return (
        <AdminGuard lang={lang} requiredPermission="manage_plans">
            <AdminPlansPageContent lang={lang} />
        </AdminGuard>
    );
}

function AdminPlansPageContent({ lang }: { lang: Locale }) {
    const { branding } = useSiteBranding();
    const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
    const { toast } = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    const loadPlans = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/plans', { cache: 'no-store' });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const message = body?.error || dict.admin.plansManagement?.errorLoadingPlans || 'Could not load plans.';
                throw new Error(message);
            }

            const payload = await response.json();
            const data = PlanSchema.array().parse(payload);
            setPlans(data);
        } catch (error) {
            console.error('Error loading plans:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: dict.admin.plansManagement?.errorLoadingPlans || 'Could not load plans.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [dict.admin.common?.error, dict.admin.plansManagement?.errorLoadingPlans, toast]);

    useEffect(() => {
        loadPlans();
    }, [loadPlans]);

    const handleDelete = async (planId: string) => {
        if (!confirm(dict.admin.common?.confirmDeletePlan || 'Are you sure you want to delete this plan?')) {
            return;
        }

        try {
            // ✅ SECURITY: Use adminApi.delete() to automatically include CSRF token
            const response = await adminApi.delete(`/api/admin/plans/${planId}`);

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const message = body?.error || dict.admin.plansManagement?.errorDeletingPlan || 'Could not delete the plan.';
                throw new Error(message);
            }

            setPlans(prev => prev.filter(p => p.id !== planId));
            toast({
                title: dict.admin.plansManagement?.planDeleted || 'Plan deleted',
                description: dict.admin.plansManagement?.planDeletedDesc || 'The plan has been deleted successfully.',
            });
        } catch (error) {
            console.error('Error deleting plan:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: dict.admin.plansManagement?.errorDeletingPlan || 'Could not delete the plan.',
                variant: 'destructive',
            });
        }
    };

    const handleSetDefault = async (planId: string) => {
        try {
            // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
            const response = await adminApi.post(`/api/admin/plans/${planId}/set-default`);

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const message = body?.error || dict.admin.plansManagement?.errorSettingDefault || 'Could not set the plan as default.';
                throw new Error(message);
            }

            await loadPlans();
            toast({
                title: dict.admin.plansManagement?.planUpdated || 'Plan updated',
                description: dict.admin.plansManagement?.planUpdatedDesc || 'The plan has been set as default.',
            });
        } catch (error) {
            console.error('Error setting default plan:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: dict.admin.plansManagement?.errorSettingDefault || 'Could not set the plan as default.',
                variant: 'destructive',
            });
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;

        const newPlans = [...plans];
        const temp = newPlans[index - 1];
        newPlans[index - 1] = newPlans[index];
        newPlans[index] = temp;

        // Update display_order for both plans
        const updates = newPlans.map((plan, idx) => ({
            id: plan.id,
            display_order: idx,
        }));

        try {
            // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
            const response = await adminApi.post('/api/admin/plans/reorder', { orders: updates });

            if (!response.ok) {
                throw new Error(dict.admin.plansManagement?.errorUpdatingOrder || 'Could not update the order.');
            }

            setPlans(newPlans);
            toast({
                title: dict.admin.plansManagement?.orderUpdated || 'Order updated',
                description: dict.admin.plansManagement?.orderUpdatedDesc || 'The plan order has been updated.',
            });
        } catch (error) {
            console.error('Error updating order:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: dict.admin.plansManagement?.errorUpdatingOrder || 'Could not update the order.',
                variant: 'destructive',
            });
        }
    };

    const handleMoveDown = async (index: number) => {
        if (index === plans.length - 1) return;

        const newPlans = [...plans];
        const temp = newPlans[index + 1];
        newPlans[index + 1] = newPlans[index];
        newPlans[index] = temp;

        // Update display_order for both plans
        const updates = newPlans.map((plan, idx) => ({
            id: plan.id,
            display_order: idx,
        }));

        try {
            // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
            const response = await adminApi.post('/api/admin/plans/reorder', { orders: updates });

            if (!response.ok) {
                throw new Error(dict.admin.plansManagement?.errorUpdatingOrder || 'Could not update the order.');
            }

            setPlans(newPlans);
            toast({
                title: dict.admin.plansManagement?.orderUpdated || 'Order updated',
                description: dict.admin.plansManagement?.orderUpdatedDesc || 'The plan order has been updated.',
            });
        } catch (error) {
            console.error('Error updating order:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: dict.admin.plansManagement?.errorUpdatingOrder || 'Could not update the order.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold font-headline">{dict.admin.plans}</h1>
                <Button asChild className="w-full md:w-auto">
                    <Link href={`/admin/plans/new?lang=${lang}`}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {dict.admin.plansManagement?.addPlan || 'Add plan'}
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>{dict.admin.plansManagement?.title || 'Plan Management'}</CardTitle>
                    <CardDescription>
                        {dict.admin.plansManagement?.description || 'Manage available subscription plans'}
                        {loading ? '' : ` - Total: ${plans.length}`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {dict.admin.plansManagement?.loadingPlans || 'Loading plans...'}
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {dict.admin.plansManagement?.noPlans || 'No plans'}
                        </div>
                    ) : null}

                    {!loading && plans.length > 0 ? (
                        <div className="grid gap-4 md:hidden">
                            {plans.map((plan) => {
                                const features = (plan.features_en || plan.features || []).slice(0, 3);
                                return (
                                    <div
                                        key={plan.id}
                                        className="rounded-lg border bg-card px-4 py-5 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-lg font-semibold">{plan.name_en || plan.name_es || plan.name}</p>
                                                <p className="text-xs text-muted-foreground">{plan.slug}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                                <span className="font-medium text-primary">${plan.price.toFixed(2)}</span>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                        plan.is_active
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}
                                                >
                                                    {plan.is_active ? (dict.admin.common?.active || 'Active') : (dict.admin.common?.inactive || 'Inactive')}
                                                </span>
                                            </div>
                                            {features.length > 0 ? (
                                                <ul className="space-y-1 text-sm text-muted-foreground">
                                                    {features.map((feature, index) => (
                                                        <li key={index} className="flex items-start gap-2">
                                                            <Check className="mt-0.5 h-3 w-3 text-green-500" />
                                                            <span>{feature}</span>
                                                        </li>
                                                    ))}
                                                    {(plan.features_en || plan.features || []).length > features.length ? (
                                                        <li className="text-xs text-muted-foreground">
                                                            +{(plan.features_en || plan.features || []).length - features.length} {dict.admin.common?.more || 'more'}...
                                                        </li>
                                                    ) : null}
                                                </ul>
                                            ) : null}
                                            <div className="flex justify-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" suppressHydrationWarning>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">{dict.admin.common?.planActions || 'Plan actions'}</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/admin/plans/edit/${plan.id}?lang=${lang}`}>
                                                                {dict.admin.common?.edit || 'Edit'}
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-600"
                                                            onClick={() => handleDelete(plan.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            {dict.admin.common?.delete || 'Delete'}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}

                    <div className="hidden md:block">
                        <Table className="min-w-[720px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">{dict.admin.common?.order || 'Order'}</TableHead>
                                    <TableHead>{dict.admin.plans}</TableHead>
                                    <TableHead>{dict.admin.common?.price || 'Price'}</TableHead>
                                    <TableHead>{dict.admin.common?.features || 'Features'}</TableHead>
                                <TableHead>{dict.admin.common?.status || 'Status'}</TableHead>
                                <TableHead className="text-right">{dict.admin.common?.actions || 'Actions'}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading || plans.length === 0
                                ? null
                                : plans.map((plan, index) => (
                                    <TableRow key={plan.id}>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => handleMoveUp(index)}
                                                    disabled={index === 0}
                                                >
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => handleMoveDown(index)}
                                                    disabled={index === plans.length - 1}
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {plan.is_default && (
                                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                )}
                                                <div>
                                                    <p className="font-medium">{plan.name_en || plan.name_es || plan.name}</p>
                                                    <p className="text-sm text-muted-foreground">{plan.slug}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>${plan.price.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <div className="max-w-xs">
                                                <ul className="text-sm text-muted-foreground">
                                                    {(plan.features_en || plan.features || []).slice(0, 2).map((feature, index) => (
                                                        <li key={index} className="flex items-center gap-1">
                                                            <Check className="h-3 w-3 text-green-500" />
                                                            <span className="truncate">{feature}</span>
                                                        </li>
                                                    ))}
                                                    {((plan.features_en || plan.features || []).length > 2) && (
                                                        <li className="text-xs text-muted-foreground">
                                                            +{(plan.features_en || plan.features || []).length - 2} {dict.admin.common?.more || 'more'}...
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                plan.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {plan.is_active ? (dict.admin.common?.active || 'Active') : (dict.admin.common?.inactive || 'Inactive')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" suppressHydrationWarning>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                      <Link href={`/admin/plans/edit/${plan.id}?lang=${lang}`}>{dict.admin.common?.edit || 'Edit'}</Link>
                                                    </DropdownMenuItem>
                                                    {!plan.is_default && (
                                                        <DropdownMenuItem onClick={() => handleSetDefault(plan.id)}>
                                                            <Star className="mr-2 h-4 w-4" />
                                                            {dict.admin.common?.setAsDefault || 'Set as default'}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(plan.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {dict.admin.common?.delete || 'Delete'}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                        {dict.admin.plansManagement?.loadingPlans || 'Loading plans...'}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {!loading && plans.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                        {dict.admin.plansManagement?.noPlans || 'No plans'}
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
