'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search, ShoppingCart, CreditCard, Calendar, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select as _Select, SelectContent as _SelectContent, SelectItem as _SelectItem, SelectTrigger as _SelectTrigger, SelectValue as _SelectValue } from '@/components/ui/select';

interface SalesRecord {
  id: string;
  type: 'order' | 'subscription';
  userId: string;
  userName: string;
  userEmail: string;
  amountCents: number;
  currency: string;
  source: 'main_store' | 'affiliate_store';
  gateway: string;
  status: string;
  createdAt: string;
  metadata?: any;
}

interface SalesHistoryPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function SalesHistoryPage({ searchParams }: SalesHistoryPageProps) {
  const params = use(searchParams);
  const lang = params.lang || 'en';
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const copy = dictionary?.admin?.salesHistory ?? {};

  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'order' | 'subscription'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'main_store' | 'affiliate_store'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/sales-history?lang=${lang}`);
      if (response.ok) {
        const data = await response.json();
        setSales(data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchesSearch =
        sale.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || sale.type === typeFilter;
      const matchesSource = sourceFilter === 'all' || sale.source === sourceFilter;

      // Date filtering
      let matchesDate = true;
      const saleDate = new Date(sale.createdAt);
      const now = new Date();

      if (dateFilter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        matchesDate = saleDate >= today;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = saleDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = saleDate >= monthAgo;
      } else if (dateFilter === 'year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        matchesDate = saleDate >= yearAgo;
      }

      // Custom date range filtering
      if (customStartDate) {
        const startDate = new Date(customStartDate);
        matchesDate = matchesDate && saleDate >= startDate;
      }
      if (customEndDate) {
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        matchesDate = matchesDate && saleDate <= endDate;
      }

      return matchesSearch && matchesType && matchesSource && matchesDate;
    });
  }, [sales, searchTerm, typeFilter, sourceFilter, dateFilter, customStartDate, customEndDate]);

  const stats = useMemo(() => {
    const totalOrders = sales.filter((s) => s.type === 'order').length;
    const totalSubscriptions = sales.filter((s) => s.type === 'subscription').length;
    const mainStoreCount = sales.filter((s) => s.source === 'main_store').length;
    const affiliateStoreCount = sales.filter((s) => s.source === 'affiliate_store').length;
    const totalRevenue = sales.reduce((sum, s) => sum + s.amountCents, 0);

    return {
      totalOrders,
      totalSubscriptions,
      mainStoreCount,
      affiliateStoreCount,
      totalRevenue,
    };
  }, [sales]);

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getSourceBadge = (source: string) => {
    if (source === 'main_store') {
      return <Badge variant="default">{(copy as any).sourceLabels?.mainStore ?? 'Main Store'}</Badge>;
    }
    return <Badge variant="secondary">{(copy as any).sourceLabels?.affiliateStore ?? 'Affiliate Store'}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'order') {
      return (
        <Badge variant="outline" className="gap-1">
          <ShoppingCart className="h-3 w-3" />
          {(copy as any).typeLabels?.order ?? 'Order'}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <CreditCard className="h-3 w-3" />
        {(copy as any).typeLabels?.subscription ?? 'Subscription'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {(copy as any).title ?? 'Sales History'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {(copy as any).description ?? 'View all paid orders and subscriptions from main store and affiliate pages'}
          </p>
        </div>
        <Button variant="outline" onClick={fetchSales} disabled={loading} className="h-11 rounded-full px-5">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {(copy as any).refreshLabel ?? 'Refresh'}
        </Button>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {(copy as any).dateFilters?.title ?? 'Date Range'}
          </CardTitle>
          <CardDescription>{(copy as any).dateFilters?.description ?? 'Filter sales by date range'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-foreground">
                {(copy as any).dateFilters?.quickFilters ?? 'Quick Filters'}
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={dateFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => {
                    setDateFilter('all');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  size="sm"
                >
                  {(copy as any).dateFilters?.all ?? 'All Time'}
                </Button>
                <Button
                  variant={dateFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => {
                    setDateFilter('today');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  size="sm"
                >
                  {(copy as any).dateFilters?.today ?? 'Today'}
                </Button>
                <Button
                  variant={dateFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => {
                    setDateFilter('week');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  size="sm"
                >
                  {(copy as any).dateFilters?.week ?? 'Last 7 Days'}
                </Button>
                <Button
                  variant={dateFilter === 'month' ? 'default' : 'outline'}
                  onClick={() => {
                    setDateFilter('month');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  size="sm"
                >
                  {(copy as any).dateFilters?.month ?? 'Last 30 Days'}
                </Button>
                <Button
                  variant={dateFilter === 'year' ? 'default' : 'outline'}
                  onClick={() => {
                    setDateFilter('year');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  size="sm"
                >
                  {(copy as any).dateFilters?.year ?? 'Last Year'}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <label htmlFor="start-date" className="mb-2 block text-sm font-medium text-foreground">
                {(copy as any).dateFilters?.startDate ?? 'Start Date'}
              </label>
              <Input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setDateFilter('all');
                }}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="end-date" className="mb-2 block text-sm font-medium text-foreground">
                {(copy as any).dateFilters?.endDate ?? 'End Date'}
              </label>
              <Input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setDateFilter('all');
                }}
                className="w-full"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="h-10"
                >
                  <X className="mr-2 h-4 w-4" />
                  {(copy as any).dateFilters?.clear ?? 'Clear'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {(copy as any).stats?.totalRevenue ?? 'Total Revenue'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{formatCurrency(stats.totalRevenue, 'USD')}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {(copy as any).stats?.orders ?? 'Orders'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.totalOrders}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {(copy as any).stats?.subscriptions ?? 'Subscriptions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.totalSubscriptions}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {(copy as any).stats?.mainStore ?? 'Main Store'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.mainStoreCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {(copy as any).stats?.affiliateStore ?? 'Affiliate Store'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold">{stats.affiliateStoreCount}</span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{(copy as any).filtersTitle ?? 'Filters'}</CardTitle>
          <CardDescription>{(copy as any).filtersDescription ?? 'Search and filter sales records'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={(copy as any).searchPlaceholder ?? 'Search by name, email, or ID...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={typeFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setTypeFilter('all')}
                size="sm"
              >
                {(copy as any).filters?.all ?? 'All'}
              </Button>
              <Button
                variant={typeFilter === 'order' ? 'default' : 'outline'}
                onClick={() => setTypeFilter('order')}
                size="sm"
              >
                {(copy as any).filters?.orders ?? 'Orders'}
              </Button>
              <Button
                variant={typeFilter === 'subscription' ? 'default' : 'outline'}
                onClick={() => setTypeFilter('subscription')}
                size="sm"
              >
                {(copy as any).filters?.subscriptions ?? 'Subscriptions'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant={sourceFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setSourceFilter('all')}
                size="sm"
              >
                {(copy as any).filters?.allSources ?? 'All Sources'}
              </Button>
              <Button
                variant={sourceFilter === 'main_store' ? 'default' : 'outline'}
                onClick={() => setSourceFilter('main_store')}
                size="sm"
              >
                {(copy as any).filters?.mainStore ?? 'Main'}
              </Button>
              <Button
                variant={sourceFilter === 'affiliate_store' ? 'default' : 'outline'}
                onClick={() => setSourceFilter('affiliate_store')}
                size="sm"
              >
                {(copy as any).filters?.affiliate ?? 'Affiliate'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="grid gap-4 p-4 md:hidden">
                {filteredSales.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    {(copy as any).noResults ?? 'No sales found'}
                  </div>
                ) : (
                  filteredSales.map((sale) => (
                    <div key={sale.id} className="rounded-lg border bg-card px-4 py-4 shadow-sm">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{sale.userName}</p>
                            <p className="text-xs text-muted-foreground break-all">{sale.userEmail}</p>
                          </div>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(sale.amountCents, sale.currency)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {getTypeBadge(sale.type)}
                          {getSourceBadge(sale.source)}
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {sale.gateway}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(sale.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{(copy as any).table?.type ?? 'Type'}</TableHead>
                      <TableHead>{(copy as any).table?.customer ?? 'Customer'}</TableHead>
                      <TableHead>{(copy as any).table?.amount ?? 'Amount'}</TableHead>
                      <TableHead>{(copy as any).table?.source ?? 'Source'}</TableHead>
                      <TableHead>{(copy as any).table?.gateway ?? 'Gateway'}</TableHead>
                      <TableHead>{(copy as any).table?.date ?? 'Date'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          {(copy as any).noResults ?? 'No sales found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{getTypeBadge(sale.type)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{sale.userName}</span>
                              <span className="text-xs text-muted-foreground">{sale.userEmail}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(sale.amountCents, sale.currency)}
                          </TableCell>
                          <TableCell>{getSourceBadge(sale.source)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {sale.gateway}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(sale.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
