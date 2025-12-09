'use client';

import { use, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash2, Eye, EyeOff, Star, StarOff } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { ClassVideo } from '@/lib/models/definitions';
import { useAdminVideos } from '@/hooks/use-admin-videos';
import { adminVideosTranslations } from '@/i18n/dictionaries/admin-videos';
import { Checkbox } from '@/components/ui/checkbox';
import AdminGuard from '@/components/admin-guard';
import { VideoFilters } from '@/components/admin/video-filters';
import { Badge } from '@/components/ui/badge';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminVideosPage({ searchParams }: { searchParams: Promise<{ lang?: Locale; visibility?: string }> }) {
    const params = use(searchParams);
    const lang = params.lang || 'en';
    const visibility = params.visibility ? params.visibility.split(',') : undefined;

    return (
        <AdminGuard lang={lang} requiredPermission="manage_content">
            <AdminVideosPageContent lang={lang} filters={{ visibility }} />
        </AdminGuard>
    );
}

function AdminVideosPageContent({ lang, filters }: { lang: Locale; filters?: { visibility?: string[]; levels?: number[] } }) {
    const { toast } = useToast();
    const t = adminVideosTranslations[lang];
    const [availableLevels, setAvailableLevels] = useState<{ id: string; level: number; name: string }[]>([]);

    useEffect(() => {
        const fetchLevels = async () => {
            try {
                const response = await fetch('/api/admin/phase-levels');
                if (response.ok) {
                    const data = await response.json();
                    setAvailableLevels(data.phaseLevels || []);
                }
            } catch (error) {
                console.error('Failed to fetch phase levels:', error);
            }
        };
        fetchLevels();
    }, []);

    const {
        videos,
        loading,
        deleteVideo,
        togglePublish,
        toggleFeatured,
        selectedVideos,
        toggleSelection,
        toggleSelectAll,
        clearSelection,
        deleteSelectedVideos,
        toggleFeaturedForSelected,
    } = useAdminVideos({
        locale: lang,
        filters,
        onError: (message) => {
            toast({
                title: 'Error',
                description: message,
                variant: 'destructive',
            });
        },
        onSuccess: (message) => {
            toast({
                title: t.messages.publishSuccess.replace('{{action}}', ''),
                description: message,
            });
        },
    });

    const handleDelete = async (videoId: string) => {
        if (!confirm(t.messages.deleteConfirm)) {
            return;
        }

        try {
            await deleteVideo(videoId);
        } catch (_error) {
            // Error already handled by hook
        }
    };

    const handleTogglePublish = async (video: ClassVideo) => {
        try {
            await togglePublish(video);
        } catch (_error) {
            // Error already handled by hook
        }
    };

    const handleToggleFeatured = async (video: ClassVideo) => {
        try {
            await toggleFeatured(video);
        } catch (_error) {
            // Error already handled by hook
        }
    };

    const handleDeleteSelected = async () => {
        if (!confirm(t.messages.deleteSelectedConfirm.replace('{{count}}', String(selectedVideos.size)))) {
            return;
        }

        try {
            await deleteSelectedVideos();
        } catch (_error) {
            // Error already handled by hook
        }
    };

    const handleFeatureSelected = async () => {
        try {
            await toggleFeaturedForSelected(true);
        } catch (_error) {
            // Error already handled by hook
        }
    };

    const handleUnfeatureSelected = async () => {
        try {
            await toggleFeaturedForSelected(false);
        } catch (_error) {
            // Error already handled by hook
        }
    };

    const isAllSelected = videos.length > 0 && selectedVideos.size === videos.length;
    const isSomeSelected = selectedVideos.size > 0;

    const visibilityOptions = [
        { value: 'all', label: t.visibility?.all || 'All' },
        { value: 'subscription', label: t.visibility?.subscription || 'Subscription' },
        { value: 'product', label: t.visibility?.product || 'Product' },
    ];

    const levelOptions = availableLevels.map((level) => ({
        value: level.level,
        label: `Level ${level.level} - ${level.name}`,
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-3xl font-bold font-headline">{t.title}</h1>
                <div className="flex items-center gap-2">
                    <VideoFilters
                        visibilityOptions={visibilityOptions}
                        levelOptions={levelOptions}
                        dict={t}
                    />
                    <Button asChild className="w-full md:w-auto">
                        <Link href={`/admin/videos/new?lang=${lang}`}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {t.newVideo}
                        </Link>
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <CardTitle>{t.management.title}</CardTitle>
                            <CardDescription>
                                {t.management.description}
                                {loading ? '' : ` - ${t.management.totalCount.replace('{{count}}', String(videos.length))}`}
                            </CardDescription>
                        </div>
                        {isSomeSelected && (
                            <div className="flex flex-wrap gap-2">
                                <span className="text-sm text-muted-foreground self-center">
                                    {t.bulkActions.selected.replace('{{count}}', String(selectedVideos.size))}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleFeatureSelected}
                                >
                                    <Star className="mr-2 h-4 w-4" />
                                    {t.actions.featureSelected}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleUnfeatureSelected}
                                >
                                    <StarOff className="mr-2 h-4 w-4" />
                                    {t.actions.unfeatureSelected}
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteSelected}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t.actions.deleteSelected}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSelection}
                                >
                                    {t.actions.deselectAll}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {t.messages.loading}
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            {t.messages.noVideos}
                        </div>
                    ) : null}

                    {!loading && videos.length > 0 ? (
                        <div className="grid gap-4 md:hidden">
                            {videos.map((video) => (
                                <div key={video.id} className="rounded-lg border bg-card px-4 py-5 shadow-sm">
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                checked={selectedVideos.has(video.id)}
                                                onCheckedChange={() => toggleSelection(video.id)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-base font-semibold">{video.title}</p>
                                                {video.description ? (
                                                    <p className="text-xs text-muted-foreground break-words">{video.description}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <code className="rounded bg-muted px-2 py-1 text-[11px]">{video.youtube_id}</code>
                                            <Badge variant="outline" className="text-[11px]">
                                                {t.visibility?.[video.visibility as keyof typeof t.visibility] || video.visibility}
                                            </Badge>
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${video.is_published
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {video.is_published ? t.status.published : t.status.hidden}
                                            </span>
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${video.is_featured
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {video.is_featured ? `⭐ ${t.status.featured}` : t.status.normal}
                                            </span>
                                            <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                                #{video.order_index}
                                            </span>
                                        </div>
                                        <div className="flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" suppressHydrationWarning>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">{t.table.actions}</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleTogglePublish(video)}>
                                                        {video.is_published ? (
                                                            <>
                                                                <EyeOff className="mr-2 h-4 w-4" />
                                                                {t.actions.hide}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                {t.actions.publish}
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggleFeatured(video)}>
                                                        <Star className={`mr-2 h-4 w-4 ${video.is_featured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                                        {video.is_featured ? t.actions.removeFeatured : t.actions.markFeatured}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/admin/videos/edit/${video.id}?lang=${lang}`}>
                                                            {t.actions.edit}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(video.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {t.actions.delete}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={isAllSelected}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>{t.table.video}</TableHead>
                                    <TableHead>{t.table.youtubeId}</TableHead>
                                    <TableHead>{t.visibility?.title || 'Visibility'}</TableHead>
                                    <TableHead>{t.table.published}</TableHead>
                                    <TableHead>{t.table.featured}</TableHead>
                                    <TableHead>{t.table.order}</TableHead>
                                    <TableHead className="text-right">{t.table.actions}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading || videos.length === 0
                                    ? null
                                    : videos.map((video) => (
                                        <TableRow key={video.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedVideos.has(video.id)}
                                                    onCheckedChange={() => toggleSelection(video.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{video.title}</span>
                                                    {video.description && (
                                                        <span className="text-sm text-gray-500 truncate max-w-xs">
                                                            {video.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                                    {video.youtube_id}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {t.visibility?.[video.visibility as keyof typeof t.visibility] || video.visibility}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${video.is_published
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {video.is_published ? t.status.published : t.status.hidden}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${video.is_featured
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {video.is_featured ? `⭐ ${t.status.featured}` : t.status.normal}
                                                </span>
                                            </TableCell>
                                            <TableCell>{video.order_index}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" suppressHydrationWarning>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleTogglePublish(video)}>
                                                            {video.is_published ? (
                                                                <>
                                                                    <EyeOff className="mr-2 h-4 w-4" />
                                                                    {t.actions.hide}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    {t.actions.publish}
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleToggleFeatured(video)}>
                                                            <Star className={`mr-2 h-4 w-4 ${video.is_featured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                                            {video.is_featured ? t.actions.removeFeatured : t.actions.markFeatured}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/admin/videos/edit/${video.id}?lang=${lang}`}>
                                                                {t.actions.edit}
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-600"
                                                            onClick={() => handleDelete(video.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            {t.actions.delete}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                                            {t.messages.loading}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {!loading && videos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                                            {t.messages.noVideos}
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