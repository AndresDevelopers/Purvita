'use client';

import { useState, use, useMemo, useEffect } from 'react';
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
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function NewVideoPage({ searchParams }: { searchParams: Promise<{ lang?: Locale }> }) {
    const params = use(searchParams);
    const lang = params.lang || 'en';
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
    }>(() => {
        const initialTranslations: Record<string, { title: string; description: string }> = {};
        availableLocales.forEach((locale) => {
            initialTranslations[locale] = { title: '', description: '' };
        });
        return {
            youtube_id: '',
            category: '',
            visibility: 'all',
            allowed_levels: [],
            is_published: true,
            order_index: 0,
            translations: initialTranslations,
        };
    });
    const [loading, setLoading] = useState(false);
    const [activeLocale, setActiveLocale] = useState<string>(lang);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate that at least one translation has a title
        const hasValidTranslation = Object.values(formData.translations).some(
            (t) => t.title.trim().length > 0
        );

        if (!hasValidTranslation || !formData.youtube_id.trim()) {
            toast({
                title: dict.admin.videoEdit.toast.validationError.title,
                description: dict.admin.videoEdit.toast.validationError.description,
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        try {
            // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
            const response = await adminApi.post('/api/admin/videos', formData);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error creating video');
            }

            toast({
                title: 'Video creado',
                description: 'El video se ha creado correctamente.',
            });

            router.push(`/admin/videos?lang=${lang}`);
        } catch (error: any) {
            console.error('Error creating video:', error);
            toast({
                title: 'Error',
                description: error.message || 'No se pudo crear el video.',
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

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/videos?lang=${lang}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Nuevo Video</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Translations Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Languages className="h-5 w-5" />
                            <CardTitle>Crear Nuevo Video de Clase</CardTitle>
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
                        {loading ? 'Creando...' : 'Crear Video'}
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
