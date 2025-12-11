'use client';

import { useState, useEffect, use, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Languages } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { Locale } from '@/i18n/config';
import { availableLocales } from '@/i18n/dictionaries';
import type { VideoWithTranslations } from '@/lib/models/video-translations';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface EditVideoPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ lang?: Locale }>;
}

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function EditVideoPage({ params, searchParams }: EditVideoPageProps) {
    const resolvedParams = use(params);
    const search = use(searchParams);
    const lang = search.lang || 'en';
    const router = useRouter();
    const { toast } = useToast();
    const { branding } = useSiteBranding();
    const dict = useMemo(
        () => getDictionary(lang, branding.appName),
        [lang, branding.appName]
    );

    const [formData, setFormData] = useState<{
        youtube_id: string;
        category: string;
        visibility: 'all' | 'subscription' | 'product';
        allowed_levels: number[];
        is_published: boolean;
        order_index: number;
        translations: Record<string, { title: string; description: string }>;
    }>({
        youtube_id: '',
        category: '',
        visibility: 'all',
        allowed_levels: [],
        is_published: true,
        order_index: 0,
        translations: {},
    });
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [activeLocale, setActiveLocale] = useState<string>(lang);
    const [availableLevels, setAvailableLevels] = useState<{ id: string; level: number; name: string }[]>([]);

    // Initialize translations for all available locales
    useEffect(() => {
        const initialTranslations: Record<string, { title: string; description: string }> = {};
        availableLocales.forEach((locale) => {
            initialTranslations[locale] = { title: '', description: '' };
        });
        setFormData((prev) => ({
            ...prev,
            translations: initialTranslations,
        }));
    }, []);

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

    const loadVideo = useCallback(async () => {
        try {
            const response = await fetch(`/api/admin/videos/${resolvedParams.id}?translations=true`);

            if (!response.ok) {
                if (response.status === 404) {
                    toast({
                        title: (dict.admin.videoEdit.toast as any).notFound.title,
                        description: (dict.admin.videoEdit.toast as any).notFound.description,
                        variant: 'destructive',
                    });
                    router.push(`/admin/videos?lang=${lang}`);
                    return;
                }
                throw new Error('Error loading video');
            }

            const video: VideoWithTranslations = await response.json();

            const translationsData: Record<string, { title: string; description: string }> = {};
            availableLocales.forEach((locale) => {
                const translation = video.translations[locale];
                translationsData[locale] = {
                    title: translation?.title || '',
                    description: translation?.description || '',
                };
            });

            setFormData({
                youtube_id: video.youtube_id,
                category: video.category || '',
                visibility: video.visibility || 'all',
                allowed_levels: video.allowed_levels || [],
                is_published: video.is_published,
                order_index: video.order_index,
                translations: translationsData,
            });
        } catch (error) {
            console.error('Error loading video:', error);
            toast({
                title: (dict.admin.videoEdit.toast as any).loadError.title,
                description: (dict.admin.videoEdit.toast as any).loadError.description,
                variant: 'destructive',
            });
        } finally {
            setFetchLoading(false);
        }
    }, [resolvedParams.id, toast, dict.admin.videoEdit.toast, router, lang]);

    useEffect(() => {
        loadVideo();
    }, [loadVideo]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate that at least one translation has a title
        const hasValidTranslation = Object.values(formData.translations).some(
            (t) => t.title.trim().length > 0
        );

        if (!hasValidTranslation || !formData.youtube_id.trim()) {
            toast({
                title: (dict.admin.videoEdit.toast as any).validationError.title,
                description: (dict.admin.videoEdit.toast as any).validationError.description,
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        try {
            const response = await adminApi.put(`/api/admin/videos/${resolvedParams.id}`, formData);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Error updating video' }));
                throw new Error(error.error || error.message || 'Error updating video');
            }

            toast({
                title: (dict.admin.videoEdit.toast as any).updateSuccess.title,
                description: (dict.admin.videoEdit.toast as any).updateSuccess.description,
            });

            router.push(`/admin/videos?lang=${lang}`);
        } catch (error: any) {
            console.error('Error updating video:', error);
            toast({
                title: (dict.admin.videoEdit.toast as any).updateError.title,
                description: error instanceof Error ? error.message : (dict.admin.videoEdit.toast as any).updateError.description,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string, value: unknown) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleTranslationChange = (locale: string, field: 'title' | 'description', value: string) => {
        setFormData((prev) => ({
            ...prev,
            translations: {
                ...prev.translations,
                [locale]: {
                    ...prev.translations[locale],
                    [field]: value,
                },
            },
        }));
    };

    const toggleLevel = (level: number) => {
        setFormData((prev) => {
            const currentLevels = prev.allowed_levels || [];
            if (currentLevels.includes(level)) {
                return { ...prev, allowed_levels: currentLevels.filter((l) => l !== level) };
            } else {
                return { ...prev, allowed_levels: [...currentLevels, level] };
            }
        });
    };

    const getLocaleLabel = (locale: string): string => {
        const labels: Record<string, string> = {
            en: 'English',
            es: 'Español',
        };
        return labels[locale] || locale.toUpperCase();
    };

    if (fetchLoading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>{(dict.admin.videoEdit as any).loading ?? 'Loading...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/videos?lang=${lang}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">{(dict.admin.videoEdit as any).title ?? 'Edit Video'}</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Translations Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Languages className="h-5 w-5" />
                            <CardTitle>{(dict.admin.videoEdit as any).cardTitle}</CardTitle>
                        </div>
                        <CardDescription>
                            {dict.admin.videoEdit.fields.titleRequired} - {dict.admin.videoEdit.fields.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeLocale} onValueChange={setActiveLocale}>
                            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableLocales.length}, 1fr)` }}>
                                {availableLocales.map((locale) => (
                                    <TabsTrigger key={locale} value={locale}>
                                        {getLocaleLabel(locale)}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {availableLocales.map((locale) => (
                                <TabsContent key={locale} value={locale} className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`title-${locale}`}>
                                            {dict.admin.videoEdit.fields.titleRequired}
                                        </Label>
                                        <Input
                                            id={`title-${locale}`}
                                            value={formData.translations[locale]?.title || ''}
                                            onChange={(e) => handleTranslationChange(locale, 'title', e.target.value)}
                                            placeholder={dict.admin.videoEdit.fields.titlePlaceholder}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`description-${locale}`}>
                                            {dict.admin.videoEdit.fields.description}
                                        </Label>
                                        <Textarea
                                            id={`description-${locale}`}
                                            value={formData.translations[locale]?.description || ''}
                                            onChange={(e) => handleTranslationChange(locale, 'description', e.target.value)}
                                            placeholder={dict.admin.videoEdit.fields.descriptionPlaceholder}
                                            rows={3}
                                        />
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Video Settings Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Video Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="youtube_id">{dict.admin.videoEdit.fields.youtubeIdRequired}</Label>
                            <Input
                                id="youtube_id"
                                value={formData.youtube_id}
                                onChange={(e) => handleInputChange('youtube_id', e.target.value)}
                                placeholder={dict.admin.videoEdit.fields.youtubeIdPlaceholder}
                                required
                            />
                            <p className="text-sm text-gray-500">
                                {dict.admin.videoEdit.fields.youtubeIdHelper}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category">{dict.admin.videoEdit.fields.category}</Label>
                            <Input
                                id="category"
                                value={formData.category}
                                onChange={(e) => handleInputChange('category', e.target.value)}
                                placeholder={dict.admin.videoEdit.fields.categoryPlaceholder}
                            />
                            <p className="text-sm text-gray-500">
                                {dict.admin.videoEdit.fields.categoryHelper}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="visibility">{dict.admin.videoEdit.fields.visibilityRequired}</Label>
                            <Select value={formData.visibility} onValueChange={(value) => handleInputChange('visibility', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder={dict.admin.videoEdit.fields.visibilityPlaceholder} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{dict.admin.videoEdit.visibility.all}</SelectItem>
                                    <SelectItem value="subscription">{dict.admin.videoEdit.visibility.subscription}</SelectItem>
                                    <SelectItem value="product">{dict.admin.videoEdit.visibility.product}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-gray-500">
                                {dict.admin.videoEdit.fields.visibilityHelper}
                            </p>
                        </div>

                        {formData.visibility === 'subscription' && (
                            <div className="space-y-2 border p-4 rounded-md bg-slate-50">
                                <Label>Allowed Levels (Optional - leave empty for all levels)</Label>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {availableLevels.map((level) => (
                                        <div key={level.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`level-${level.level}`}
                                                checked={formData.allowed_levels.includes(level.level)}
                                                onCheckedChange={() => toggleLevel(level.level)}
                                            />
                                            <Label htmlFor={`level-${level.level}`} className="cursor-pointer">
                                                Level {level.level} - {level.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="order_index">{dict.admin.videoEdit.fields.order}</Label>
                            <Input
                                id="order_index"
                                type="number"
                                value={formData.order_index}
                                onChange={(e) => handleInputChange('order_index', parseInt(e.target.value) || 0)}
                                placeholder={dict.admin.videoEdit.fields.orderPlaceholder}
                                min="0"
                            />
                            <p className="text-sm text-gray-500">
                                {dict.admin.videoEdit.fields.orderHelper}
                            </p>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_published"
                                checked={formData.is_published}
                                onCheckedChange={(checked) => handleInputChange('is_published', !!checked)}
                            />
                            <Label htmlFor="is_published">{dict.admin.videoEdit.fields.published}</Label>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-4">
                    <Button type="submit" disabled={loading}>
                        <Save className="mr-2 h-4 w-4" />
                        {loading ? (dict.admin.videoEdit.actions as any).saving : (dict.admin.videoEdit.actions as any).save}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                        <Link href={`/admin/videos?lang=${lang}`}>
                            {dict.admin.videoEdit.actions.cancel}
                        </Link>
                    </Button>
                </div>
            </form>
        </div>
    );
}
