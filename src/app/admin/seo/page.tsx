'use client';

import { use, useEffect, useMemo, useState, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/i18n/config';
import { i18n } from '@/i18n/config';
import { useToast } from '@/hooks/use-toast';
import type { Seo } from '@/lib/models/definitions';
import {
  SEO_PAGE_DEFINITIONS,
  type SeoCategory,
  type SeoPageDefinition,
  type SeoPageId,
} from '@/lib/seo/seo-definitions';
import AdminGuard from '@/components/admin-guard';
import { supabase } from '@/lib/supabase';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useUploadLimits } from '@/modules/upload';

const locales = i18n.locales as Locale[];

const CATEGORY_LABELS: Record<SeoCategory, string> = {
  marketing: 'Marketing y landing',
  auth: 'Autenticación',
  app: 'Área privada',
  system: 'Sistema',
};

const CATEGORY_ORDER: SeoCategory[] = ['marketing', 'auth', 'app'];

const PRIORITY_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: 'Impacto alto',
  medium: 'Impacto medio',
  low: 'Impacto bajo',
};

const PRIORITY_VARIANT: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/40',
  low: 'bg-slate-500/10 text-slate-300 border-slate-500/40',
};

interface SeoFormEntry {
  id?: string;
  title: string;
  description: string;
  keywords: string;
  canonical_url: string;
  robots_index: boolean;
  robots_follow: boolean;
  robots_advanced: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  json_ld: string;
}

type SeoFormState = Record<Locale, Record<SeoPageId, SeoFormEntry>>;

interface SeoUpsertRequest {
  id?: string;
  page: SeoPageId;
  locale: Locale;
  title: string;
  description: string;
  keywords: string;
  canonical_url: string;
  robots_index: boolean;
  robots_follow: boolean;
  robots_advanced: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  json_ld: string;
}

const createEmptyEntry = (): SeoFormEntry => ({
  title: '',
  description: '',
  keywords: '',
  canonical_url: '',
  robots_index: true,
  robots_follow: true,
  robots_advanced: '',
  og_title: '',
  og_description: '',
  og_image: '',
  twitter_title: '',
  twitter_description: '',
  twitter_image: '',
  json_ld: '',
});

const buildInitialState = (settings: Seo[]): SeoFormState => {
  const base = {} as SeoFormState;

  for (const locale of locales) {
    base[locale] = {} as Record<SeoPageId, SeoFormEntry>;

    for (const definition of SEO_PAGE_DEFINITIONS) {
      const match = settings.find((item) => item.locale === locale && item.page === definition.id);
      const entry = { ...createEmptyEntry() };

      if (match) {
        entry.id = match.id;
        entry.title = match.title ?? '';
        entry.description = match.description ?? '';
        entry.keywords = match.keywords ?? '';
        entry.canonical_url = match.canonical_url ?? '';
        entry.robots_index = match.robots_index ?? true;
        entry.robots_follow = match.robots_follow ?? true;
        entry.robots_advanced = match.robots_advanced ?? '';
        entry.og_title = match.og_title ?? '';
        entry.og_description = match.og_description ?? '';
        entry.og_image = match.og_image ?? '';
        entry.twitter_title = match.twitter_title ?? '';
        entry.twitter_description = match.twitter_description ?? '';
        entry.twitter_image = match.twitter_image ?? '';
        entry.json_ld = match.json_ld ?? '';
      }

      base[locale][definition.id] = entry;
    }
  }

  return base;
};

const normalize = (value: string): string => value.trim();

const ensureJsonLd = (json: string, locale: Locale, pageId: SeoPageId) => {
  const trimmed = normalize(json);
  if (!trimmed) {
    return;
  }

  try {
    JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`JSON-LD inválido en ${locale.toUpperCase()} · ${pageId}: ${(error as Error).message}`);
  }
};

const toPayload = (state: SeoFormState): SeoUpsertRequest[] => {
  const payload: SeoUpsertRequest[] = [];

  for (const locale of locales) {
    for (const definition of SEO_PAGE_DEFINITIONS) {
      const entry = state[locale][definition.id];
      const title = normalize(entry.title);
      const description = normalize(entry.description);

      if (!title && !description) {
        continue;
      }

      if (!title || !description) {
        throw new Error(`Completa título y descripción para ${locale.toUpperCase()} · ${definition.name}.`);
      }

      ensureJsonLd(entry.json_ld, locale, definition.id);

      payload.push({
        ...(entry.id ? { id: entry.id } : {}),
        page: definition.id,
        locale,
        title,
        description,
        keywords: normalize(entry.keywords),
        canonical_url: normalize(entry.canonical_url),
        robots_index: entry.robots_index,
        robots_follow: entry.robots_follow,
        robots_advanced: normalize(entry.robots_advanced),
        og_title: normalize(entry.og_title),
        og_description: normalize(entry.og_description),
        og_image: normalize(entry.og_image),
        twitter_title: normalize(entry.twitter_title),
        twitter_description: normalize(entry.twitter_description),
        twitter_image: normalize(entry.twitter_image),
        json_ld: normalize(entry.json_ld),
      });
    }
  }

  return payload;
};

const findBestLocale = (preferred?: Locale): Locale => {
  if (preferred && locales.includes(preferred)) {
    return preferred;
  }
  return locales[0];
};

const categoryDefinitions = SEO_PAGE_DEFINITIONS.reduce<Record<SeoCategory, SeoPageDefinition[]>>(
  (acc, definition) => {
    if (!acc[definition.category]) {
      acc[definition.category] = [];
    }
    acc[definition.category].push(definition);
    return acc;
  },
  {
    marketing: [],
    auth: [],
    app: [],
    system: [],
  },
);

interface AdminSeoPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminSeoPage({ searchParams }: AdminSeoPageProps) {
  const params = use(searchParams);
  const initialLocale = findBestLocale(params.lang);

  return (
    <AdminGuard lang={initialLocale} requiredPermission="manage_content">
      <AdminSeoPageContent initialLocale={initialLocale} />
    </AdminGuard>
  );
}

function AdminSeoPageContent({ initialLocale }: { initialLocale: Locale }) {
  const { toast } = useToast();
  const { limits: _limits, validateImageSize, getImageLimitText } = useUploadLimits();

  const [state, setState] = useState<SeoFormState>(() => buildInitialState([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<Locale>(initialLocale);
  const [selectedPageId, setSelectedPageId] = useState<SeoPageId>('global');
  const [uploadingOg, setUploadingOg] = useState(false);
  const [uploadingTwitter, setUploadingTwitter] = useState(false);
  const ogFileInputRef = useRef<HTMLInputElement>(null);
  const twitterFileInputRef = useRef<HTMLInputElement>(null);

  const selectedDefinition = useMemo(
    () => SEO_PAGE_DEFINITIONS.find((definition) => definition.id === selectedPageId)!,
    [selectedPageId],
  );

  const currentEntry = state[selectedLocale]?.[selectedPageId];

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/admin/seo', { cache: 'no-store' });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message = body?.error || 'No se pudieron cargar los ajustes de SEO.';
          throw new Error(message);
        }

        const data: { settings?: Seo[] } = await response.json();
        setState(buildInitialState(data.settings ?? []));
      } catch (error) {
        console.error('Error loading SEO settings:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'No se pudieron cargar los ajustes de SEO.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [toast]);

  useEffect(() => {
    if (!state[selectedLocale]) {
      setSelectedLocale(locales[0]);
    }
  }, [selectedLocale, state]);

  const updateField = (locale: Locale, pageId: SeoPageId, field: keyof SeoFormEntry, value: string | boolean) => {
    setState((prev) => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [pageId]: {
          ...prev[locale]?.[pageId],
          [field]: value,
        },
      },
    }));
  };

  const uploadImageToSeo = async (file: File, type: 'og' | 'twitter'): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `seo/${type}-${selectedPageId}-${selectedLocale}-${timestamp}-${random}.${fileExt}`;

    const { data: _data, error } = await supabase.storage
      .from('page')
      .upload(fileName, file, {
        cacheControl: '31536000', // 1 año
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('page')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleOgImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamaño usando límites dinámicos
    const validation = validateImageSize(file);
    if (!validation.valid) {
      toast({
        title: 'Imagen muy grande',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido',
        description: 'Solo se permiten imágenes.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingOg(true);
    try {
      const publicUrl = await uploadImageToSeo(file, 'og');
      updateField(selectedLocale, selectedPageId, 'og_image', publicUrl);
      toast({
        title: 'Imagen OG subida',
        description: 'La imagen se ha subido correctamente.',
      });
    } catch (error) {
      console.error('Error uploading OG image:', error);
      toast({
        title: 'Error al subir imagen',
        description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setUploadingOg(false);
      if (ogFileInputRef.current) {
        ogFileInputRef.current.value = '';
      }
    }
  };

  const handleTwitterImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamaño usando límites dinámicos
    const validation = validateImageSize(file);
    if (!validation.valid) {
      toast({
        title: 'Imagen muy grande',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido',
        description: 'Solo se permiten imágenes.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingTwitter(true);
    try {
      const publicUrl = await uploadImageToSeo(file, 'twitter');
      updateField(selectedLocale, selectedPageId, 'twitter_image', publicUrl);
      toast({
        title: 'Imagen Twitter subida',
        description: 'La imagen se ha subido correctamente.',
      });
    } catch (error) {
      console.error('Error uploading Twitter image:', error);
      toast({
        title: 'Error al subir imagen',
        description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setUploadingTwitter(false);
      if (twitterFileInputRef.current) {
        twitterFileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = toPayload(state);

      if (payload.length === 0) {
        throw new Error('Configura al menos el bloque global antes de guardar.');
      }

      const missingGlobalLocales = locales.filter(
        (locale) => !payload.some((item) => item.locale === locale && item.page === 'global'),
      );

      if (missingGlobalLocales.length > 0) {
        throw new Error(
          `Completa la sección global para: ${missingGlobalLocales.map((locale) => locale.toUpperCase()).join(', ')}.`,
        );
      }

      // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
      const { adminApi } = await import('@/lib/utils/admin-csrf-helpers');
      const response = await adminApi.put('/api/admin/seo', { settings: payload });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || 'No se pudieron guardar los ajustes de SEO.';
        throw new Error(message);
      }

      const updated: { settings?: Seo[] } = await response.json();
      setState(buildInitialState(updated.settings ?? []));

      toast({
        title: 'SEO actualizado',
        description: 'Los ajustes de SEO se guardaron correctamente para todas las páginas seleccionadas.',
      });
    } catch (error) {
      console.error('Error saving SEO settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudieron guardar los ajustes de SEO.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
          <p className="mt-2 text-sm text-muted-foreground">Loading SEO settings...</p>
        </div>
      </div>
    );
  }

  if (!currentEntry) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold">Panel SEO centralizado</h1>
        <p className="text-muted-foreground">
          Define títulos, descripciones, etiquetas sociales y datos estructurados para cada página importante desde un solo lugar.
        </p>
      </div>

      <Alert>
        <AlertTitle>Buenas prácticas SEO según Google</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            <li>Limita los títulos a 50-60 caracteres y las descripciones a 150-160 caracteres para maximizar el CTR.</li>
            <li>Incluye palabras clave relevantes sin caer en “keyword stuffing” y mantén un tono humano.</li>
            <li>Usa URLs canónicas absolutas para evitar contenido duplicado y activa/desactiva la indexación por página.</li>
            <li>Completa Open Graph y Twitter Cards para controlar la vista previa en redes sociales.</li>
            <li>Añade JSON-LD válido (schema.org) para enriquecer resultados en Google con rich snippets.</li>
          </ul>
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración multilingüe</CardTitle>
            <CardDescription>
              Selecciona un idioma y una página para editar sus metadatos. Si una página queda vacía, se utilizará el fallback global.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={selectedLocale} onValueChange={(value) => setSelectedLocale(value as Locale)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    {locales.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        {locale.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Página</Label>
                <Select value={selectedPageId} onValueChange={(value) => setSelectedPageId(value as SeoPageId)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una página" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Global</SelectLabel>
                      <SelectItem value="global">Global · fallback del sitio</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    {CATEGORY_ORDER.map((category) => {
                      const entries = categoryDefinitions[category].filter((definition) => definition.id !== 'global');
                      if (entries.length === 0) {
                        return null;
                      }
                      return (
                        <SelectGroup key={category}>
                          <SelectLabel>{CATEGORY_LABELS[category]}</SelectLabel>
                          {entries.map((definition) => (
                            <SelectItem key={definition.id} value={definition.id}>
                              {definition.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">{selectedDefinition.name}</CardTitle>
              <Badge variant="outline" className={PRIORITY_VARIANT[selectedDefinition.priority]}>
                {PRIORITY_LABEL[selectedDefinition.priority]}
              </Badge>
              <Badge variant="secondary">{CATEGORY_LABELS[selectedDefinition.category]}</Badge>
            </div>
            <CardDescription>{selectedDefinition.description}</CardDescription>
            {selectedDefinition.routeExamples.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {selectedDefinition.routeExamples.map((route) => (
                  <code key={route} className="rounded bg-muted px-2 py-1 font-mono">
                    {route}
                  </code>
                ))}
              </div>
            ) : null}
            {selectedDefinition.recommendedStructuredData ? (
              <p className="text-xs text-muted-foreground">
                Estructura sugerida: {selectedDefinition.recommendedStructuredData}
              </p>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={currentEntry.title}
                  onChange={(event) => updateField(selectedLocale, selectedPageId, 'title', event.target.value)}
                  placeholder="Ej. Vive saludable con PūrVita"
                  required={selectedPageId === 'global'}
                />
                <p className="text-xs text-muted-foreground">50-60 caracteres recomendados.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">Palabras clave</Label>
                <Input
                  id="keywords"
                  value={currentEntry.keywords}
                  onChange={(event) => updateField(selectedLocale, selectedPageId, 'keywords', event.target.value)}
                  placeholder="palabra 1, palabra 2, palabra 3"
                />
                <p className="text-xs text-muted-foreground">Separa por comas. Usa términos naturales.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={currentEntry.description}
                onChange={(event) => updateField(selectedLocale, selectedPageId, 'description', event.target.value)}
                rows={4}
                placeholder="Resume el beneficio principal en 160 caracteres"
                required={selectedPageId === 'global'}
              />
              <p className="text-xs text-muted-foreground">Máximo recomendable: 150-160 caracteres.</p>
            </div>

            <Separator />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="canonical_url">URL canónica</Label>
                <Input
                  id="canonical_url"
                  value={currentEntry.canonical_url}
                  onChange={(event) => updateField(selectedLocale, selectedPageId, 'canonical_url', event.target.value)}
                  placeholder="https://tusitio.com/ruta"
                />
                <p className="text-xs text-muted-foreground">Usa una URL absoluta para evitar duplicados.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="robots_advanced">Directivas avanzadas para robots</Label>
                <Input
                  id="robots_advanced"
                  value={currentEntry.robots_advanced}
                  onChange={(event) => updateField(selectedLocale, selectedPageId, 'robots_advanced', event.target.value)}
                  placeholder="max-snippet:-1, max-image-preview:large"
                />
                <p className="text-xs text-muted-foreground">Opcional. Se agrega a la etiqueta de robots.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="robots_index" className="font-medium">
                    Indexar en buscadores
                  </Label>
                  <p className="text-xs text-muted-foreground">Desactiva solo para páginas privadas o temporales.</p>
                </div>
                <Switch
                  id="robots_index"
                  checked={currentEntry.robots_index}
                  onCheckedChange={(value) => updateField(selectedLocale, selectedPageId, 'robots_index', value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="robots_follow" className="font-medium">
                    Seguir enlaces
                  </Label>
                  <p className="text-xs text-muted-foreground">Permite que Google siga los enlaces salientes.</p>
                </div>
                <Switch
                  id="robots_follow"
                  checked={currentEntry.robots_follow}
                  onCheckedChange={(value) => updateField(selectedLocale, selectedPageId, 'robots_follow', value)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Open Graph (Facebook, LinkedIn)</h3>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="og_title">Título OG</Label>
                  <Input
                    id="og_title"
                    value={currentEntry.og_title}
                    onChange={(event) => updateField(selectedLocale, selectedPageId, 'og_title', event.target.value)}
                    placeholder="Título para compartir"
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="og_description">Descripción OG</Label>
                  <Textarea
                    id="og_description"
                    value={currentEntry.og_description}
                    onChange={(event) => updateField(selectedLocale, selectedPageId, 'og_description', event.target.value)}
                    rows={3}
                    placeholder="Descripción para redes sociales"
                  />
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label htmlFor="og_image">Imagen OG</Label>
                  <div className="flex gap-2">
                    <Input
                      id="og_image"
                      value={currentEntry.og_image}
                      onChange={(event) => updateField(selectedLocale, selectedPageId, 'og_image', event.target.value)}
                      placeholder="https://tusitio.com/imagen.jpg"
                      className="flex-1"
                    />
                    <input
                      ref={ogFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleOgImageUpload}
                      className="hidden"
                      aria-label="Upload Open Graph image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => ogFileInputRef.current?.click()}
                      disabled={uploadingOg}
                      className="shrink-0"
                    >
                      {uploadingOg ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir
                        </>
                      )}
                    </Button>
                    {currentEntry.og_image && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateField(selectedLocale, selectedPageId, 'og_image', '')}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {currentEntry.og_image && (
                    <div className="relative mt-2 aspect-[1200/630] w-full max-w-md overflow-hidden rounded-lg border">
                      <Image
                        src={currentEntry.og_image}
                        alt="OG Preview"
                        width={1200}
                        height={630}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Ideal 1200x630 px, {getImageLimitText()}. Puedes pegar URL o subir archivo.</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Twitter Cards</h3>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="twitter_title">Título Twitter</Label>
                  <Input
                    id="twitter_title"
                    value={currentEntry.twitter_title}
                    onChange={(event) => updateField(selectedLocale, selectedPageId, 'twitter_title', event.target.value)}
                    placeholder="Título corto"
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="twitter_description">Descripción Twitter</Label>
                  <Textarea
                    id="twitter_description"
                    value={currentEntry.twitter_description}
                    onChange={(event) => updateField(selectedLocale, selectedPageId, 'twitter_description', event.target.value)}
                    rows={3}
                    placeholder="Descripción concisa para X/Twitter"
                  />
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label htmlFor="twitter_image">Imagen Twitter</Label>
                  <div className="flex gap-2">
                    <Input
                      id="twitter_image"
                      value={currentEntry.twitter_image}
                      onChange={(event) => updateField(selectedLocale, selectedPageId, 'twitter_image', event.target.value)}
                      placeholder="https://tusitio.com/imagen-twitter.jpg"
                      className="flex-1"
                    />
                    <input
                      ref={twitterFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleTwitterImageUpload}
                      className="hidden"
                      aria-label="Upload Twitter card image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => twitterFileInputRef.current?.click()}
                      disabled={uploadingTwitter}
                      className="shrink-0"
                    >
                      {uploadingTwitter ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir
                        </>
                      )}
                    </Button>
                    {currentEntry.twitter_image && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateField(selectedLocale, selectedPageId, 'twitter_image', '')}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {currentEntry.twitter_image && (
                    <div className="relative mt-2 aspect-[1200/600] w-full max-w-md overflow-hidden rounded-lg border">
                      <Image
                        src={currentEntry.twitter_image}
                        alt="Twitter Preview"
                        width={1200}
                        height={600}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Ideal 1200x600 px, {getImageLimitText()}. Puedes pegar URL o subir archivo.</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="json_ld">Datos estructurados (JSON-LD)</Label>
              <Textarea
                id="json_ld"
                value={currentEntry.json_ld}
                onChange={(event) => updateField(selectedLocale, selectedPageId, 'json_ld', event.target.value)}
                rows={6}
                placeholder='Ej. {"@context":"https://schema.org","@type":"Organization",...}'
              />
              <p className="text-xs text-muted-foreground">Pega un objeto JSON válido. Google recomienda schema.org.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando cambios...' : 'Guardar todos los cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
