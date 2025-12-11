'use client';

import { useState, useEffect, use, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { updateProduct } from '@/lib/services/product-service';
import { ProductSchema } from '@/lib/models/definitions';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductDiscountType, DiscountVisibilitySite } from '@/lib/models/definitions';
import { ALL_DISCOUNT_VISIBILITY_SITES } from '@/lib/models/definitions';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';
import type { CheckedState } from '@radix-ui/react-checkbox';
import AdminGuard from '@/components/admin-guard';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminProductsPage({ searchParams }: { searchParams: Promise<{ lang?: Locale }> }) {
    const params = use(searchParams);
    const lang = params.lang || 'en';

    return (
        <AdminGuard lang={lang} requiredPermission="manage_products">
            <AdminProductsPageContent lang={lang} />
        </AdminGuard>
    );
}

function AdminProductsPageContent({ lang }: { lang: Locale }) {
    const { branding } = useSiteBranding();
    const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
    const { toast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [bulkDiscountType, setBulkDiscountType] = useState<'none' | 'amount' | 'percentage'>('none');
    const [bulkDiscountValue, setBulkDiscountValue] = useState('');
    const [bulkDiscountLabel, setBulkDiscountLabel] = useState('');
    const [bulkDiscountVisibility, setBulkDiscountVisibility] = useState<DiscountVisibilitySite[]>([...ALL_DISCOUNT_VISIBILITY_SITES]);
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadProducts = useCallback(async () => {
        try {
            // Using adminApi.get() for consistency (GET requests don't need CSRF token)
            const response = await adminApi.get('/api/admin/products', { cache: 'no-store' });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const message = body?.error || dict.admin.productsManagement?.errorLoadingProducts || 'Could not load products.';
                throw new Error(message);
            }

            const payload = await response.json();
            const data = ProductSchema.array().parse(payload);
            setProducts(data);
            setSelectedIds(prev => {
                const next = new Set<string>();
                data.forEach((product) => {
                    if (prev.has(product.id)) {
                        next.add(product.id);
                    }
                });
                return next;
            });
        } catch (error) {
            console.error('Error loading products:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: dict.admin.productsManagement?.errorLoadingProducts || 'Could not load products.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [dict.admin.common?.error, dict.admin.productsManagement?.errorLoadingProducts, toast]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const selectedCount = selectedIds.size;
    const isAllSelected = products.length > 0 && selectedCount === products.length;
    const isIndeterminate = selectedCount > 0 && selectedCount < products.length;
    const hasSelection = selectedCount > 0;
    const bulkValuePlaceholder =
        bulkDiscountType === 'percentage'
            ? dict.admin.productDiscountValuePlaceholderPercent ?? '15'
            : dict.admin.productDiscountValuePlaceholderAmount ?? '10.00';
    const isBulkDiscountActive = bulkDiscountType !== 'none';
    const isBulkSubmitDisabled = bulkSubmitting || (isBulkDiscountActive && bulkDiscountValue.trim().length === 0);

    const toggleProductSelection = (productId: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) {
                next.add(productId);
            } else {
                next.delete(productId);
            }
            return next;
        });
    };

    const handleSelectAll = (checked: CheckedState) => {
        if (checked === true) {
            setSelectedIds(new Set(products.map(product => product.id)));
            return;
        }
        setSelectedIds(new Set());
    };

    const handleBulkTypeChange = (value: ProductDiscountType | 'none') => {
        if (value === 'amount' || value === 'percentage') {
            setBulkDiscountType(value);
            return;
        }
        setBulkDiscountType('none');
        setBulkDiscountValue('');
        setBulkDiscountLabel('');
    };

    const resetBulkForm = () => {
        setBulkDiscountType('none');
        setBulkDiscountValue('');
        setBulkDiscountLabel('');
        setBulkDiscountVisibility([...ALL_DISCOUNT_VISIBILITY_SITES]);
    };

    const handleBulkDialogChange = (open: boolean) => {
        setBulkDialogOpen(open);
        if (!open) {
            resetBulkForm();
        }
    };

    const handleApplyBulkDiscount = async () => {
        if (selectedIds.size === 0) {
            return;
        }

        const type: ProductDiscountType | null =
            bulkDiscountType === 'amount' || bulkDiscountType === 'percentage' ? bulkDiscountType : null;
        let normalizedValue: number | null = null;

        if (type) {
            const parsed = Number.parseFloat(bulkDiscountValue.replace(/,/g, '.'));
            if (!Number.isFinite(parsed) || parsed <= 0) {
                toast({
                    title: dict.admin.productDiscountInvalidTitle ?? 'Invalid discount value',
                    description: dict.admin.productDiscountValidation ?? 'Provide a discount greater than zero.',
                    variant: 'destructive',
                });
                return;
            }
            if (type === 'amount') {
                normalizedValue = Number(Math.max(0, parsed).toFixed(2));
            } else {
                normalizedValue = Number(Math.min(100, Math.max(0, parsed)).toFixed(2));
            }
        }

        const trimmedLabel = bulkDiscountLabel.trim();
        const resolvedLabel = type && trimmedLabel.length > 0 ? trimmedLabel : null;

        setBulkSubmitting(true);
        try {
            const ids = Array.from(selectedIds);
            for (const productId of ids) {
                const product = products.find((item) => item.id === productId);
                const payload: Partial<Omit<Product, 'id'>> = {
                    discount_type: type,
                    discount_label: resolvedLabel,
                    discount_value: null,
                    discount_visibility: type ? bulkDiscountVisibility : [...ALL_DISCOUNT_VISIBILITY_SITES],
                };

                if (type === 'amount' && normalizedValue !== null) {
                    const priceReference = product ? product.price : normalizedValue;
                    payload.discount_value = Number(Math.min(priceReference, normalizedValue).toFixed(2));
                } else if (type === 'percentage' && normalizedValue !== null) {
                    payload.discount_value = normalizedValue;
                }

                await updateProduct(productId, payload);
            }

            await loadProducts();
            toast({
                title: dict.admin.productDiscountBulkSuccessTitle ?? 'Discount updated',
                description: (dict.admin.productDiscountBulkSuccess ?? '{{count}} products updated').replace(
                    '{{count}}',
                    ids.length.toString(),
                ),
            });
            setBulkDialogOpen(false);
            resetBulkForm();
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Error applying bulk discount:', error);
            toast({
                title: dict.admin.productDiscountBulkErrorTitle ?? 'Unable to update discounts',
                description:
                    dict.admin.productDiscountBulkError ?? 'We could not update the selected products. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setBulkSubmitting(false);
        }
    };

    const handleDelete = async (productId: string) => {
        if (!confirm(dict.admin.common?.confirmDeleteProduct || 'Are you sure you want to delete this product?')) {
            return;
        }

        try {
            // ✅ SECURITY: Use adminApi.delete() to automatically include CSRF token
            const response = await adminApi.delete(`/api/admin/products/${productId}`);

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const message = body?.error || dict.admin.productsManagement?.errorDeletingProduct || 'Could not delete the product.';
                throw new Error(message);
            }

            setProducts(prev => prev.filter(p => p.id !== productId));
            setSelectedIds(prev => {
                if (!prev.has(productId)) {
                    return prev;
                }
                const next = new Set(prev);
                next.delete(productId);
                return next;
            });
            toast({
                title: dict.admin.productsManagement?.productDeleted || 'Product deleted',
                description: dict.admin.productsManagement?.productDeletedDesc || 'The product has been deleted successfully.',
            });
        } catch (error) {
            console.error('Error deleting product:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: error instanceof Error ? error.message : (dict.admin.productsManagement?.errorDeletingProduct || 'Could not delete the product.'),
                variant: 'destructive',
            });
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            return;
        }

        setIsDeleting(true);
        try {
            const ids = Array.from(selectedIds);
            let successCount = 0;
            let errorCount = 0;

            for (const productId of ids) {
                try {
                    // ✅ SECURITY: Use adminApi.delete() to automatically include CSRF token
                    const response = await adminApi.delete(`/api/admin/products/${productId}`);

                    if (!response.ok) {
                        throw new Error('Failed to delete product');
                    }
                    successCount++;
                } catch (error) {
                    console.error(`Error deleting product ${productId}:`, error);
                    errorCount++;
                }
            }

            // Recargar productos después de eliminar
            await loadProducts();

            if (errorCount === 0) {
                toast({
                    title: dict.admin.productsManagement?.bulkDeleteSuccess || 'Products deleted',
                    description: (dict.admin.productsManagement?.bulkDeleteSuccessDesc || '{{count}} products deleted successfully.').replace('{{count}}', successCount.toString()),
                });
            } else {
                toast({
                    title: dict.admin.productsManagement?.bulkDeletePartial || 'Partial error',
                    description: (dict.admin.productsManagement?.bulkDeletePartialDesc || '{{success}} products deleted, but {{error}} failed.').replace('{{success}}', successCount.toString()).replace('{{error}}', errorCount.toString()),
                    variant: errorCount > successCount ? 'destructive' : 'default',
                });
            }

            setDeleteDialogOpen(false);
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Error in bulk delete:', error);
            toast({
                title: dict.admin.common?.error || 'Error',
                description: dict.admin.productsManagement?.bulkDeleteError || 'Could not delete the products.',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold font-headline">{dict.admin.products}</h1>
                    {hasSelection ? (
                        <p className="text-sm text-muted-foreground">
                            {(dict.admin.productSelectionLabel ?? '{{count}} products selected').replace(
                                '{{count}}',
                                selectedCount.toString(),
                            )}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => handleBulkDialogChange(true)}
                        disabled={!hasSelection}
                    >
                        {dict.admin.productDiscountBulkAction}
                    </Button>
                    {hasSelection ? (
                        <>
                            <Button
                                type="button"
                                variant="destructive"
                                className="w-full sm:w-auto"
                                onClick={() => setDeleteDialogOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {dict.admin.productBulkDelete}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full sm:w-auto"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                {dict.admin.productSelectionClear}
                            </Button>
                        </>
                    ) : null}
                    <Button asChild className="w-full sm:w-auto">
                        <Link href={`/admin/products/new?lang=${lang}`}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {dict.admin.addProduct}
                        </Link>
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>{dict.admin.productManagement}</CardTitle>
                    <CardDescription>
                        {dict.admin.productManagementDesc}
                        {loading ? '' : ` - Total: ${products.length}`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {dict.admin.productsManagement?.loadingProducts || 'Loading products...'}
                        </div>
                    ) : products.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {dict.admin.productsManagement?.noProducts || 'No products'}
                        </div>
                    ) : null}

                    {!loading && products.length > 0 ? (
                        <div className="grid gap-4 md:hidden">
                            {products.map((product) => {
                                const pricing = getDiscountedUnitPrice(product);
                                const hasDiscount = pricing.discountAmount > 0;

                                return (
                                    <div key={product.id} className="rounded-lg border bg-card p-4 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                aria-label={(dict.admin.productSelectAria ?? 'Select {{name}}').replace(
                                                    '{{name}}',
                                                    product.name,
                                                )}
                                                checked={selectedIds.has(product.id)}
                                                onCheckedChange={(checked) =>
                                                    toggleProductSelection(product.id, checked === true)
                                                }
                                                className="mt-1"
                                            />
                                            <Image
                                                src={product.images[0]?.url || '/placeholder-image.svg'}
                                                alt={product.name}
                                                width={64}
                                                height={64}
                                                className="h-16 w-16 rounded-md object-cover"
                                                data-ai-hint={product.images[0]?.hint || product.name}
                                            />
                                            <div className="flex-1 space-y-2">
                                                <div>
                                                    <p className="text-base font-semibold leading-tight">{product.name}</p>
                                                    <p className="text-xs text-muted-foreground">SKU: {product.slug}</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                                    <span className="font-medium text-primary">
                                                        ${pricing.finalUnitPrice.toFixed(2)}
                                                    </span>
                                                    {hasDiscount ? (
                                                        <span className="text-xs text-muted-foreground line-through">
                                                            ${pricing.unitPrice.toFixed(2)}
                                                        </span>
                                                    ) : null}
                                                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                                        {dict.admin.stockQuantity}: {product.stock_quantity.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 text-xs text-muted-foreground">
                                                    {hasDiscount ? (
                                                        <>
                                                            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                {pricing.discount?.label ?? dict.admin.productDiscountActiveFallback}
                                                            </p>
                                                            <p>
                                                                {pricing.discount?.type === 'amount'
                                                                    ? (dict.admin.productDiscountAmountSummary ?? '-${{amount}} off').replace(
                                                                        '{{amount}}',
                                                                        pricing.discount?.amount.toFixed(2) ?? '0',
                                                                    )
                                                                    : (dict.admin.productDiscountPercentSummary ?? '-{{percent}}% off').replace(
                                                                        '{{percent}}',
                                                                        pricing.discount?.value.toFixed(1) ?? '0',
                                                                    )}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <p>{dict.admin.productDiscountNone}</p>
                                                    )}
                                                    <p className="flex flex-wrap gap-2">
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${product.is_featured
                                                                ? 'bg-primary/10 text-primary'
                                                                : 'bg-muted text-muted-foreground'
                                                                }`}
                                                        >
                                                            {product.is_featured ? dict.admin.featuredYes : dict.admin.featuredNo}
                                                        </span>
                                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                                            {dict.admin.statusActive}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" suppressHydrationWarning>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">{(dict.admin as any).actions ?? 'Actions'}</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/admin/products/edit/${product.slug}?lang=${lang}`}>
                                                            {(dict.admin as any).editProduct ?? 'Edit Product'}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(product.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {dict.admin.deleteProduct}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}

                    <div className="hidden md:block">
                        <Table className="min-w-[960px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            aria-label={dict.admin.productSelectAllLabel ?? 'Select all products'}
                                            checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>{(dict.admin as any).product ?? 'Product'}</TableHead>
                                    <TableHead>{(dict.admin as any).price ?? 'Price'}</TableHead>
                                    <TableHead>{(dict.admin as any).productDiscountColumn ?? 'Discount'}</TableHead>
                                    <TableHead>{(dict.admin as any).stockQuantity ?? 'Stock'}</TableHead>
                                    <TableHead>{(dict.admin as any).featuredColumn ?? 'Featured'}</TableHead>
                                    <TableHead>{(dict.admin as any).status ?? 'Status'}</TableHead>
                                    <TableHead className="text-right">{(dict.admin as any).actions ?? 'Actions'}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading || products.length === 0
                                    ? null
                                    : products.map((product) => {
                                        const pricing = getDiscountedUnitPrice(product);
                                        const hasDiscount = pricing.discountAmount > 0;

                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        aria-label={(dict.admin.productSelectAria ?? 'Select {{name}}').replace(
                                                            '{{name}}',
                                                            product.name,
                                                        )}
                                                        checked={selectedIds.has(product.id)}
                                                        onCheckedChange={(checked) =>
                                                            toggleProductSelection(product.id, Boolean(checked))
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-4">
                                                        <Image
                                                            src={product.images[0]?.url || '/placeholder-image.svg'}
                                                            alt={product.name}
                                                            width={40}
                                                            height={40}
                                                            className="rounded-md object-cover"
                                                            data-ai-hint={product.images[0]?.hint || product.name}
                                                        />
                                                        <p className="font-medium">{product.name}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-primary">
                                                            ${pricing.finalUnitPrice.toFixed(2)}
                                                        </span>
                                                        {hasDiscount ? (
                                                            <span className="text-xs text-muted-foreground line-through">
                                                                ${pricing.unitPrice.toFixed(2)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {hasDiscount ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                                {pricing.discount?.label ?? dict.admin.productDiscountActiveFallback}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {pricing.discount?.type === 'amount'
                                                                    ? (dict.admin.productDiscountAmountSummary ?? '-${{amount}} off').replace(
                                                                        '{{amount}}',
                                                                        pricing.discount?.amount.toFixed(2) ?? '0',
                                                                    )
                                                                    : (dict.admin.productDiscountPercentSummary ?? '-{{percent}}% off').replace(
                                                                        '{{percent}}',
                                                                        pricing.discount?.value.toFixed(1) ?? '0',
                                                                    )}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">
                                                            {dict.admin.productDiscountNone}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{product.stock_quantity.toLocaleString()}</TableCell>
                                                <TableCell>{product.is_featured ? dict.admin.featuredYes : dict.admin.featuredNo}</TableCell>
                                                <TableCell>{dict.admin.statusActive}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" suppressHydrationWarning>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/admin/products/edit/${product.slug}?lang=${lang}`}>{dict.admin.editProduct}</Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-red-600"
                                                                onClick={() => handleDelete(product.id)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                {dict.admin.deleteProduct}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                                            {dict.admin.productsManagement?.loadingProducts || 'Loading products...'}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {!loading && products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                                            {dict.admin.productsManagement?.noProducts || 'No products'}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            <Dialog open={bulkDialogOpen} onOpenChange={handleBulkDialogChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{dict.admin.productDiscountBulkTitle}</DialogTitle>
                        <DialogDescription>
                            {(dict.admin.productDiscountBulkDescription ?? 'Update the discount for {{count}} selected products.').replace(
                                '{{count}}',
                                selectedCount.toString(),
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="bulk-discount-type">{dict.admin.productDiscountTypeLabel}</Label>
                            <Select value={bulkDiscountType} onValueChange={handleBulkTypeChange}>
                                <SelectTrigger id="bulk-discount-type">
                                    <SelectValue placeholder={dict.admin.productDiscountTypeNone} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{dict.admin.productDiscountTypeNone}</SelectItem>
                                    <SelectItem value="amount">{dict.admin.productDiscountTypeAmount}</SelectItem>
                                    <SelectItem value="percentage">{dict.admin.productDiscountTypePercentage}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{dict.admin.productDiscountTypeHelper}</p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bulk-discount-value">{dict.admin.productDiscountValueLabel}</Label>
                            <Input
                                id="bulk-discount-value"
                                type="number"
                                step={bulkDiscountType === 'percentage' ? '0.1' : '0.01'}
                                min={0}
                                max={bulkDiscountType === 'percentage' ? 100 : undefined}
                                value={bulkDiscountValue}
                                onChange={(event) => setBulkDiscountValue(event.target.value)}
                                placeholder={bulkValuePlaceholder}
                                disabled={!isBulkDiscountActive || bulkSubmitting}
                            />
                            <p className="text-xs text-muted-foreground">{dict.admin.productDiscountValueHint}</p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bulk-discount-label">{dict.admin.productDiscountLabel}</Label>
                            <Input
                                id="bulk-discount-label"
                                value={bulkDiscountLabel}
                                onChange={(event) => setBulkDiscountLabel(event.target.value)}
                                placeholder={dict.admin.productDiscountLabelPlaceholder}
                                disabled={!isBulkDiscountActive || bulkSubmitting}
                            />
                            <p className="text-xs text-muted-foreground">{dict.admin.productDiscountInlineHint}</p>
                        </div>
                        <div className="grid gap-2">
                            <Label>{dict.admin.productDiscountVisibilityLabel ?? 'Discount visibility'}</Label>
                            <p className="text-xs text-muted-foreground">
                                {dict.admin.productDiscountVisibilityHint ?? 'Select where this discount should be visible and applied.'}
                            </p>
                            <div className="flex flex-wrap gap-4 pt-1">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="bulk-visibility-main"
                                        checked={bulkDiscountVisibility.includes('main_store')}
                                        onCheckedChange={(checked) => {
                                            setBulkDiscountVisibility((prev) =>
                                                checked
                                                    ? [...prev, 'main_store']
                                                    : prev.filter((site) => site !== 'main_store')
                                            );
                                        }}
                                        disabled={!isBulkDiscountActive || bulkSubmitting}
                                    />
                                    <Label htmlFor="bulk-visibility-main" className="text-sm font-normal cursor-pointer">
                                        {dict.admin.productDiscountVisibilityMainStore ?? 'Main store'}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="bulk-visibility-affiliate"
                                        checked={bulkDiscountVisibility.includes('affiliate_store')}
                                        onCheckedChange={(checked) => {
                                            setBulkDiscountVisibility((prev) =>
                                                checked
                                                    ? [...prev, 'affiliate_store']
                                                    : prev.filter((site) => site !== 'affiliate_store')
                                            );
                                        }}
                                        disabled={!isBulkDiscountActive || bulkSubmitting}
                                    />
                                    <Label htmlFor="bulk-visibility-affiliate" className="text-sm font-normal cursor-pointer">
                                        {dict.admin.productDiscountVisibilityAffiliateStore ?? 'Affiliate store'}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="bulk-visibility-mlm"
                                        checked={bulkDiscountVisibility.includes('mlm_store')}
                                        onCheckedChange={(checked) => {
                                            setBulkDiscountVisibility((prev) =>
                                                checked
                                                    ? [...prev, 'mlm_store']
                                                    : prev.filter((site) => site !== 'mlm_store')
                                            );
                                        }}
                                        disabled={!isBulkDiscountActive || bulkSubmitting}
                                    />
                                    <Label htmlFor="bulk-visibility-mlm" className="text-sm font-normal cursor-pointer">
                                        {dict.admin.productDiscountVisibilityMlmStore ?? 'MLM store'}
                                    </Label>
                                </div>
                            </div>
                            {isBulkDiscountActive && bulkDiscountVisibility.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    {dict.admin.productDiscountVisibilityWarning ?? 'Select at least one store to apply the discount.'}
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleBulkDialogChange(false)}
                            disabled={bulkSubmitting}
                        >
                            {dict.admin.productDiscountBulkCancel ?? 'Cancel'}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleApplyBulkDiscount}
                            disabled={isBulkSubmitDisabled}
                        >
                            {bulkSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {dict.admin.productDiscountBulkSubmit}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {dict.admin.productBulkDeleteConfirmTitle?.replace('{{count}}', selectedCount.toString()) ||
                                '¿Eliminar productos seleccionados?'}
                        </DialogTitle>
                        <DialogDescription>
                            {dict.admin.productBulkDeleteConfirmDescription?.replace('{{count}}', selectedCount.toString()) ||
                                `Estás a punto de eliminar ${selectedCount} productos. Esta acción no se puede deshacer.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            {dict.admin.productDiscountBulkCancel ?? 'Cancelar'}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            {isDeleting ? 'Eliminando...' : (dict.admin.productBulkDelete || 'Eliminar seleccionados')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
