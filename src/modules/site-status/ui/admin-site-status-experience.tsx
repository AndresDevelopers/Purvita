'use client';

import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { Loader2, ShieldAlert, Sparkles, Plus, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { supabase, PAGE_BUCKET } from '@/lib/supabase';
import { ImageUploader } from '@/components/admin/image-uploader';
import { useUploadLimits } from '@/modules/upload';
import {
  createDefaultConfiguration,
  createDefaultComingSoonSettings,
  SITE_MODE_SOCIAL_PLATFORM_LABELS,
  SITE_MODE_SOCIAL_PLATFORMS,
  type SiteModeComingSoonSettings,
  type SiteModeComingSoonBranding,
  type SiteModeConfiguration,
  type SiteModeSeo,
  type SiteModeType,
  resolveSiteModeSocialPlatform,
  type UpdateSiteModeConfigurationInput,
} from '@/modules/site-status/domain/models/site-mode';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { adminApi, getCsrfToken } from '@/lib/utils/admin-csrf-helpers';

interface AdminSiteStatusExperienceProps {
  lang: Locale;
}

type FormField = keyof SiteModeSeo;
type SeoFieldValue = string | Record<string, string> | Record<string, string | null> | null;

const isSupportedLocale = (locale: string): locale is 'en' | 'es' => {
  return locale === 'en' || locale === 'es';
};

const getSeoFieldValue = (field: SeoFieldValue, locale: Locale): string => {
  if (typeof field === 'string') {
    return field;
  }
  if (field && typeof field === 'object' && isSupportedLocale(locale)) {
    return field[locale] ?? '';
  }
  return '';
};

const setSeoFieldValue = (currentValue: SeoFieldValue, locale: Locale, newValue: string): SeoFieldValue => {
  if (typeof currentValue === 'string' || currentValue === null) {
    // Convert to multilingual object
    return {
      en: isSupportedLocale(locale) && locale === 'en' ? newValue : '',
      es: isSupportedLocale(locale) && locale === 'es' ? newValue : '',
    };
  }
  if (typeof currentValue === 'object' && isSupportedLocale(locale)) {
    return {
      ...currentValue,
      [locale]: newValue || null,
    };
  }
  return currentValue;
};

type ModeSummary = {
  id: SiteModeType;
  icon: ReactNode;
  title: string;
  description: string;
};

type SiteModeState = SiteModeConfiguration['modes'][number];
type SocialLink = NonNullable<SiteModeState['appearance']['socialLinks']>[number];

const sanitizeBackgroundImage = (value: any): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeSocialLinks = (
  links: SiteModeState['appearance']['socialLinks'] | null | undefined,
): SocialLink[] => {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link) => {
      if (!link || typeof link !== 'object') {
        return null;
      }

      const candidate = link as { platform?: any; label?: any; url?: unknown };

      const rawPlatform =
        typeof candidate.platform === 'string'
          ? candidate.platform
          : typeof candidate.label === 'string'
            ? candidate.label
            : '';
      const platform = resolveSiteModeSocialPlatform(rawPlatform);
      const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';

      if (!platform || !url) {
        return null;
      }

      return { platform, url } as SocialLink;
    })
    .filter((link): link is SocialLink => link !== null);
};

const DEFAULT_COMING_SOON_SETTINGS = createDefaultComingSoonSettings();
const DEFAULT_COMING_SOON_BRANDING = DEFAULT_COMING_SOON_SETTINGS.branding;

const normalizeHexColour = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  let hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  hex = hex.replace(/[^0-9a-fA-F]/g, '');

  if (!hex) {
    return '';
  }

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char.repeat(2))
      .join('');
  }

  if (hex.length < 6) {
    const last = hex[hex.length - 1] ?? '0';
    hex = hex.padEnd(6, last);
  }

  return `#${hex.slice(0, 6).toLowerCase()}`;
};

const ensureComingSoonBranding = (
  branding?: SiteModeComingSoonBranding | null,
): SiteModeComingSoonBranding => {
  const base = { ...DEFAULT_COMING_SOON_BRANDING };

  if (!branding) {
    return { ...base };
  }

  return {
    ...base,
    ...branding,
    backgroundGradientColors:
      branding.backgroundGradientColors && branding.backgroundGradientColors.length > 0
        ? branding.backgroundGradientColors.map((color) => {
          const normalized = normalizeHexColour(color ?? '');
          return normalized || base.backgroundGradientColors[0];
        })
        : [...base.backgroundGradientColors],
  };
};

const mergeModeState = (defaultMode: SiteModeState, incoming?: SiteModeState): SiteModeState => {
  if (!incoming) {
    return {
      ...defaultMode,
      mailchimpEnabled: defaultMode.mailchimpEnabled ?? false,
      appearance: {
        backgroundImageUrl: sanitizeBackgroundImage(defaultMode.appearance.backgroundImageUrl),
        backgroundOverlayOpacity: defaultMode.appearance.backgroundOverlayOpacity ?? 90,
        socialLinks: sanitizeSocialLinks(defaultMode.appearance.socialLinks),
      },
    };
  }

  const appearance = {
    backgroundImageUrl:
      sanitizeBackgroundImage(incoming.appearance?.backgroundImageUrl) ??
      sanitizeBackgroundImage(defaultMode.appearance.backgroundImageUrl),
    socialLinks: sanitizeSocialLinks(incoming.appearance?.socialLinks),
  };

  const mergedSeo = {
    ...defaultMode.seo,
    ...(incoming.seo ?? {}),
    keywords: incoming.seo?.keywords ?? defaultMode.seo.keywords ?? '',
  } satisfies SiteModeSeo;

  const comingSoonSettings =
    incoming.mode === 'coming_soon'
      ? incoming.comingSoon ?? defaultMode.comingSoon ?? createDefaultComingSoonSettings()
      : incoming.comingSoon ?? defaultMode.comingSoon;

  return {
    ...defaultMode,
    ...incoming,
    mailchimpEnabled: typeof incoming.mailchimpEnabled === 'boolean'
      ? incoming.mailchimpEnabled
      : (defaultMode.mailchimpEnabled ?? false),
    mailchimpAudienceId: normalizeOptionalField(incoming.mailchimpAudienceId ?? '') ?? null,
    mailchimpServerPrefix: normalizeOptionalField(incoming.mailchimpServerPrefix ?? '') ?? null,
    appearance: {
      backgroundImageUrl: appearance.backgroundImageUrl ?? null,
      backgroundOverlayOpacity: incoming.appearance?.backgroundOverlayOpacity ?? defaultMode.appearance.backgroundOverlayOpacity ?? 90,
      socialLinks: appearance.socialLinks,
    },
    comingSoon: comingSoonSettings,
    seo: mergedSeo,
  } satisfies SiteModeState;
};

const normalizeConfiguration = (
  incoming: SiteModeConfiguration | null | undefined,
): SiteModeConfiguration => {
  const defaults = createDefaultConfiguration();

  if (!incoming) {
    return defaults;
  }

  const incomingMap = new Map<SiteModeType, SiteModeState>(
    (incoming.modes ?? []).map((mode) => [mode.mode, mode] as const),
  );

  const mergedModes = defaults.modes.map((mode) => mergeModeState(mode, incomingMap.get(mode.mode)));
  const requestedMode = incoming.activeMode ?? defaults.activeMode;
  const fallbackMode = mergedModes.some((mode) => mode.mode === requestedMode)
    ? requestedMode
    : defaults.activeMode;

  return {
    activeMode: fallbackMode,
    modes: mergedModes.map((mode) => ({
      ...mode,
      isActive: mode.mode === fallbackMode,
    })),
  } satisfies SiteModeConfiguration;
};

const normalizeOptionalField = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const toDateTimeLocalValue = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offsetInMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetInMinutes * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const parseCountdownNumericValue = (value: string): number | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.floor(parsed));
};

export function AdminSiteStatusExperience({ lang }: AdminSiteStatusExperienceProps) {
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const { toast } = useToast();
  const { validateImageSize, getImageLimitText: _getImageLimitText } = useUploadLimits();

  const [configuration, setConfiguration] = useState<SiteModeConfiguration>(() => normalizeConfiguration(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSeoLocale, setSelectedSeoLocale] = useState<Locale>('en');
  const [, setUploadingLogo] = useState(false);
  const [, setUploadingBackgroundImage] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);
  const [uploadingTwitterImage, setUploadingTwitterImage] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const backgroundImageFileInputRef = useRef<HTMLInputElement>(null);

  const summary = useMemo<ModeSummary[]>(() => {
    const copy = dict?.admin?.siteStatus;
    return [
      {
        id: 'maintenance',
        icon: <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />,
        title: copy?.maintenance?.title ?? 'Maintenance mode',
        description: copy?.maintenance?.description ?? 'Temporarily hide the site while you perform updates.',
      },
      {
        id: 'coming_soon',
        icon: <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />,
        title: copy?.comingSoon?.title ?? 'Coming soon',
        description: copy?.comingSoon?.description ?? 'Announce an upcoming launch and collect early interest.',
      },
    ];
  }, [dict]);

  const activeModeSettings = useMemo(() => {
    return configuration.activeMode && configuration.activeMode !== 'none'
      ? configuration.modes.find((mode) => mode.mode === configuration.activeMode)
      : null;
  }, [configuration]);

  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const response = await adminApi.get('/api/admin/site-status', { cache: 'no-store' });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || 'Unable to load configuration.';
        throw new Error(message);
      }

      const data = (await response.json()) as SiteModeConfiguration;
      setConfiguration(normalizeConfiguration(data));
    } catch (error) {
      console.error('[AdminSiteStatus] Failed to load configuration', error);
      setErrorMessage(dict?.admin?.siteStatus?.loadError ?? 'Could not load the current configuration.');
    } finally {
      setLoading(false);
    }
  }, [dict]);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const handleModeChange = useCallback((value: string) => {
    const mode = value as SiteModeType;
    setConfiguration((prev) => ({
      activeMode: mode,
      modes: prev.modes.map((item) => ({
        ...item,
        isActive: item.mode === mode,
      })),
    }));
  }, []);

  const handleSeoFieldChange = useCallback((field: FormField, value: string) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        const nextSeo: SiteModeSeo = { ...item.seo };
        const locale = selectedSeoLocale;

        switch (field) {
          case 'title':
            nextSeo.title = setSeoFieldValue(item.seo.title, locale, value) as any;
            break;
          case 'description':
            nextSeo.description = setSeoFieldValue(item.seo.description, locale, value) as any;
            break;
          case 'keywords':
            nextSeo.keywords = setSeoFieldValue(item.seo.keywords, locale, value) as any;
            break;
          case 'ogTitle':
            nextSeo.ogTitle = setSeoFieldValue(item.seo.ogTitle, locale, normalizeOptionalField(value) ?? '') as any;
            break;
          case 'ogDescription':
            nextSeo.ogDescription = setSeoFieldValue(item.seo.ogDescription, locale, normalizeOptionalField(value) ?? '') as any;
            break;
          case 'ogImage':
            nextSeo.ogImage = setSeoFieldValue(item.seo.ogImage, locale, normalizeOptionalField(value) ?? '') as any;
            break;
          case 'twitterTitle':
            nextSeo.twitterTitle = setSeoFieldValue(item.seo.twitterTitle, locale, normalizeOptionalField(value) ?? '') as any;
            break;
          case 'twitterDescription':
            nextSeo.twitterDescription = setSeoFieldValue(item.seo.twitterDescription, locale, normalizeOptionalField(value) ?? '') as any;
            break;
          case 'twitterImage':
            nextSeo.twitterImage = setSeoFieldValue(item.seo.twitterImage, locale, normalizeOptionalField(value) ?? '') as any;
            break;
          default:
            break;
        }

        return {
          ...item,
          seo: nextSeo,
        };
      }),
    }));
  }, [selectedSeoLocale]);

  const updateComingSoonSettings = useCallback((
    updater: (current: SiteModeComingSoonSettings) => SiteModeComingSoonSettings,
  ) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== 'coming_soon') {
          return item;
        }

        const current = item.comingSoon ?? createDefaultComingSoonSettings();

        return {
          ...item,
          comingSoon: updater(current),
        };
      }),
    }));
  }, []);

  const updateComingSoonBranding = useCallback((
    updater: (branding: SiteModeComingSoonBranding) => SiteModeComingSoonBranding,
  ) => {
    updateComingSoonSettings((current) => ({
      ...current,
      branding: updater(ensureComingSoonBranding(current.branding)),
    }));
  }, [updateComingSoonSettings]);

  const handleCountdownEnabledChange = useCallback((enabled: boolean) => {
    updateComingSoonSettings((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        isEnabled: enabled,
      },
    }));
  }, [updateComingSoonSettings]);

  const _handleCountdownStyleChange = useCallback((value: string) => {
    updateComingSoonSettings((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        style: value === 'numeric' ? 'numeric' : 'date',
      },
    }));
  }, [updateComingSoonSettings]);

  const handleCountdownDateChange = useCallback((value: string) => {
    updateComingSoonSettings((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        targetDate: fromDateTimeLocalValue(value),
      },
    }));
  }, [updateComingSoonSettings]);

  const _handleCountdownNumericChange = useCallback((value: string) => {
    updateComingSoonSettings((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        numericValue: parseCountdownNumericValue(value),
      },
    }));
  }, [updateComingSoonSettings]);

  const _handleCountdownLabelChange = useCallback((value: string) => {
    updateComingSoonSettings((current) => ({
      ...current,
      countdown: {
        ...current.countdown,
        label: normalizeOptionalField(value),
      },
    }));
  }, [updateComingSoonSettings]);

  const handleComingSoonLogoChange = useCallback((value: string) => {
    updateComingSoonBranding((branding) => ({
      ...branding,
      logoUrl: normalizeOptionalField(value),
    }));
  }, [updateComingSoonBranding]);

  const handleComingSoonBackgroundModeChange = useCallback((value: string) => {
    updateComingSoonBranding((branding) => {
      const nextMode: SiteModeComingSoonBranding['backgroundMode'] =
        value === 'gradient' ? 'gradient' : 'image';
      const gradientColours = ensureComingSoonBranding(branding).backgroundGradientColors;

      return {
        ...branding,
        backgroundMode: nextMode,
        backgroundGradientColors: gradientColours.map((colour) => normalizeHexColour(colour)),
      };
    });
  }, [updateComingSoonBranding]);

  const handleComingSoonBackgroundImageChange = useCallback((value: string) => {
    updateComingSoonBranding((branding) => ({
      ...branding,
      backgroundImageUrl: normalizeOptionalField(value),
    }));
  }, [updateComingSoonBranding]);

  const uploadImageToPageBucket = useCallback(async (file: File, prefix: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `coming-soon/${prefix}-${Date.now()}.${fileExt}`;

    const { data: _data, error } = await supabase.storage
      .from(PAGE_BUCKET)
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(PAGE_BUCKET)
      .getPublicUrl(fileName);

    return publicUrl;
  }, []);

  const _handleLogoFileChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select a valid image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    const validation = validateImageSize(file);
    if (!validation.valid) {
      toast({
        title: 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const publicUrl = await uploadImageToPageBucket(file, 'logo');
      handleComingSoonLogoChange(publicUrl);
      toast({
        title: 'Success',
        description: 'Logo uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading logo', error);
      toast({
        title: 'Error uploading logo',
        description: 'Could not upload the image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  }, [handleComingSoonLogoChange, toast, uploadImageToPageBucket, validateImageSize]);

  const _handleBackgroundImageFileChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select a valid image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    const validation = validateImageSize(file);
    if (!validation.valid) {
      toast({
        title: 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploadingBackgroundImage(true);
    try {
      const publicUrl = await uploadImageToPageBucket(file, 'background');
      handleComingSoonBackgroundImageChange(publicUrl);
      toast({
        title: 'Success',
        description: 'Background image uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading background image', error);
      toast({
        title: 'Error uploading background image',
        description: 'Could not upload the image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingBackgroundImage(false);
      if (backgroundImageFileInputRef.current) {
        backgroundImageFileInputRef.current.value = '';
      }
    }
  }, [handleComingSoonBackgroundImageChange, toast, uploadImageToPageBucket, validateImageSize]);

  // Handle OG Image file upload
  const handleOgImageFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const validation = validateImageSize(file);
    if (!validation.valid) {
      toast({
        title: 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploadingOgImage(true);
    try {
      const publicUrl = await uploadImageToPageBucket(file, 'og-image');
      handleSeoFieldChange('ogImage', publicUrl);
      toast({
        title: 'Success',
        description: 'OG image uploaded successfully.',
      });
    } catch (_err) {
      console.error('Error uploading OG image', _err);
      toast({
        title: 'Error',
        description: 'Failed to upload OG image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingOgImage(false);
      event.target.value = '';
    }
  }, [handleSeoFieldChange, toast, uploadImageToPageBucket, validateImageSize]);

  // Handle Twitter Image file upload
  const handleTwitterImageFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const validation = validateImageSize(file);
    if (!validation.valid) {
      toast({
        title: 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploadingTwitterImage(true);
    try {
      const publicUrl = await uploadImageToPageBucket(file, 'twitter-image');
      handleSeoFieldChange('twitterImage', publicUrl);
      toast({
        title: 'Success',
        description: 'Twitter image uploaded successfully.',
      });
    } catch (_err) {
      console.error('Error uploading Twitter image', _err);
      toast({
        title: 'Error',
        description: 'Failed to upload Twitter image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingTwitterImage(false);
      event.target.value = '';
    }
  }, [handleSeoFieldChange, toast, uploadImageToPageBucket, validateImageSize]);

  const handleComingSoonGradientColourChange = (index: number, value: string) => {
    updateComingSoonBranding((branding) => {
      const colours = [...ensureComingSoonBranding(branding).backgroundGradientColors];
      const normalized = normalizeHexColour(value);
      colours[index] =
        normalized || DEFAULT_COMING_SOON_BRANDING.backgroundGradientColors[index] || colours[0];

      return {
        ...branding,
        backgroundGradientColors: colours,
      };
    });
  };

  const handleAddGradientColour = () => {
    updateComingSoonBranding((branding) => {
      const colours = [...ensureComingSoonBranding(branding).backgroundGradientColors];

      if (colours.length >= 5) {
        return branding;
      }

      const nextColour = colours[colours.length - 1] ?? DEFAULT_COMING_SOON_BRANDING.backgroundGradientColors[0];
      colours.push(nextColour);

      return {
        ...branding,
        backgroundGradientColors: colours,
      };
    });
  };

  const handleRemoveGradientColour = (index: number) => {
    updateComingSoonBranding((branding) => {
      const colours = [...ensureComingSoonBranding(branding).backgroundGradientColors];

      if (colours.length <= 2) {
        return branding;
      }

      colours.splice(index, 1);

      if (colours.length < 2) {
        colours.push(DEFAULT_COMING_SOON_BRANDING.backgroundGradientColors[0]);
      }

      return {
        ...branding,
        backgroundGradientColors: colours,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      // Helper to normalize SEO field values
      const normalizeSeoField = (value: SeoFieldValue): string | Partial<Record<'en' | 'es', string>> => {
        if (!value) return '';

        if (typeof value === 'string') {
          return value.trim() || '';
        }

        if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, string | null>;
          const en = obj.en?.trim() || '';
          const es = obj.es?.trim() || '';

          // If both are empty, return empty string
          if (!en && !es) return '';

          // If both are the same, return as string
          if (en === es) return en;

          // Return as multilingual object
          return { en, es };
        }

        return '';
      };

      const normalizeOptionalSeoField = (value: SeoFieldValue): string | Partial<Record<'en' | 'es', string>> | null => {
        if (!value) return null;

        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed || null;
        }

        if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, string | null>;
          const en = obj.en?.trim() || null;
          const es = obj.es?.trim() || null;

          // If both are empty, return null
          if (!en && !es) return null;

          // If both are the same, return as string
          if (en === es) return en;

          // Return as multilingual object with only non-null values
          const result: Partial<Record<'en' | 'es', string>> = {};
          if (en) result.en = en;
          if (es) result.es = es;
          return result;
        }

        return null;
      };

      const payload: UpdateSiteModeConfigurationInput = {
        activeMode: configuration.activeMode,
        modes: configuration.modes.map((mode) => ({
          mode: mode.mode,
          appearance: {
            backgroundImageUrl: mode.appearance.backgroundImageUrl,
            backgroundOverlayOpacity: mode.appearance.backgroundOverlayOpacity ?? 90,
            socialLinks: mode.appearance.socialLinks ?? [],
          },
          mailchimpEnabled: mode.mailchimpEnabled ?? false,
          mailchimpAudienceId: mode.mailchimpAudienceId,
          mailchimpServerPrefix: mode.mailchimpServerPrefix,
          comingSoon: mode.comingSoon,
          seo: {
            title: normalizeSeoField(mode.seo.title),
            description: normalizeSeoField(mode.seo.description),
            keywords: normalizeSeoField(mode.seo.keywords),
            ogTitle: normalizeOptionalSeoField(mode.seo.ogTitle),
            ogDescription: normalizeOptionalSeoField(mode.seo.ogDescription),
            ogImage: normalizeOptionalSeoField(mode.seo.ogImage),
            twitterTitle: normalizeOptionalSeoField(mode.seo.twitterTitle),
            twitterDescription: normalizeOptionalSeoField(mode.seo.twitterDescription),
            twitterImage: normalizeOptionalSeoField(mode.seo.twitterImage),
          },
        })),
      };

      // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
      const response = await adminApi.put('/api/admin/site-status', payload);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        console.error('[AdminSiteStatus] Server error response:', body);
        const message = body?.error || 'Unable to save configuration.';
        if (body?.details) {
          console.error('[AdminSiteStatus] Validation details:', body.details);
        }
        throw new Error(message);
      }

      const data = (await response.json()) as SiteModeConfiguration;
      setConfiguration(normalizeConfiguration(data));

      toast({
        title: dict?.admin?.siteStatus?.successTitle ?? 'Site status updated',
        description: dict?.admin?.siteStatus?.successDescription ?? 'The configuration was saved successfully.',
      });
    } catch (error) {
      console.error('[AdminSiteStatus] Failed to save configuration', error);
      setErrorMessage(dict?.admin?.siteStatus?.saveError ?? 'We could not save your changes.');
      toast({
        title: dict?.admin?.siteStatus?.errorTitle ?? 'Update failed',
        description: dict?.admin?.siteStatus?.errorDescription ?? 'Please review the information and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateMode = async () => {
    if (!configuration.activeMode || configuration.activeMode === 'none') return;

    setSaving(true);
    setErrorMessage(null);

    try {
      // Get CSRF token
      const csrfToken = await getCsrfToken();

      const response = await fetch(`/api/admin/site-status/deactivate/${configuration.activeMode}`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || 'Unable to deactivate mode.';
        throw new Error(message);
      }

      const data = (await response.json()) as SiteModeConfiguration;
      setConfiguration(normalizeConfiguration(data));

      const deactivateCopy = dict?.admin?.siteStatus?.deactivateFeedback;

      toast({
        title: deactivateCopy?.successTitle ?? 'Mode deactivated',
        description: deactivateCopy?.successDescription ?? 'The site is now in normal mode.',
      });
    } catch (error) {
      console.error('[AdminSiteStatus] Failed to deactivate mode', error);
      const deactivateCopy = dict?.admin?.siteStatus?.deactivateFeedback;
      setErrorMessage(deactivateCopy?.errorMessage ?? 'We could not deactivate the mode.');
      toast({
        title: deactivateCopy?.errorTitle ?? 'Deactivation failed',
        description: deactivateCopy?.errorDescription ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const activeCopy = dict?.admin?.siteStatus?.seoSection;
  const appearanceCopy = (dict as any)?.admin?.siteStatus?.appearanceSection;
  const comingSoonCopy = (dict as any)?.admin?.siteStatus?.comingSoonSettings;
  const overviewCopy = (dict as any)?.admin?.siteStatus?.overviewSection ?? {};
  const connectionsCopy = (dict as any)?.admin?.siteStatus?.connectionsSection ?? {};
  const connectionsSocialCopy = connectionsCopy?.social ?? appearanceCopy?.social ?? {};
  const mailchimpCopy = connectionsCopy?.mailchimp ?? {};
  const socialPlatformOverrides = connectionsSocialCopy?.platforms ?? null;
  const socialPlatformLabels = useMemo(
    () =>
      SITE_MODE_SOCIAL_PLATFORMS.reduce<Record<SocialLink['platform'], string>>((acc, platform) => {
        const override = socialPlatformOverrides?.[platform];
        const fallback = SITE_MODE_SOCIAL_PLATFORM_LABELS[platform];
        acc[platform] =
          typeof override === 'string' && override.trim().length > 0
            ? override
            : fallback;
        return acc;
      }, {} as Record<SocialLink['platform'], string>),
    [socialPlatformOverrides],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {dict?.admin?.siteStatus?.loading ?? 'Loading current configuration...'}
          </p>
        </div>
      </div>
    );
  }
  const activeComingSoonSettings =
    activeModeSettings?.comingSoon ?? createDefaultComingSoonSettings();
  const countdownCopy = comingSoonCopy?.countdown ?? {};
  const comingSoonBrandingCopy = comingSoonCopy?.branding ?? {};
  const _countdownStyle = activeComingSoonSettings.countdown.style;
  const countdownEnabled = activeComingSoonSettings.countdown.isEnabled;
  const countdownDateValue = toDateTimeLocalValue(activeComingSoonSettings.countdown.targetDate);
  const _countdownNumericValue =
    typeof activeComingSoonSettings.countdown.numericValue === 'number'
      ? String(activeComingSoonSettings.countdown.numericValue)
      : '';
  const _countdownLabelValue = activeComingSoonSettings.countdown.label ?? '';
  const activeComingSoonBranding = ensureComingSoonBranding(activeComingSoonSettings.branding);

  const handleAppearanceBackgroundChange = (value: string) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        return {
          ...item,
          appearance: {
            ...item.appearance,
            backgroundImageUrl: normalizeOptionalField(value),
            socialLinks: item.appearance.socialLinks ?? [],
          },
        };
      }),
    }));
  };

  const handleAppearanceOverlayChange = (value: number) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        return {
          ...item,
          appearance: {
            ...item.appearance,
            backgroundOverlayOpacity: Math.max(0, Math.min(100, value)),
          },
        };
      }),
    }));
  };

  const handleSocialLinkChange = (index: number, field: 'platform' | 'url', value: string) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        const links = item.appearance.socialLinks ? [...item.appearance.socialLinks] : [];

        if (!links[index]) {
          links[index] = { platform: SITE_MODE_SOCIAL_PLATFORMS[0], url: '' };
        }

        if (field === 'platform') {
          const resolved = resolveSiteModeSocialPlatform(value);
          if (!resolved) {
            return item;
          }

          links[index] = {
            ...links[index],
            platform: resolved,
          };
        } else {
          links[index] = {
            ...links[index],
            url: value,
          };
        }

        return {
          ...item,
          appearance: {
            ...item.appearance,
            socialLinks: links,
          },
        };
      }),
    }));
  };

  const handleAddSocialLink = () => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        const links = item.appearance.socialLinks ? [...item.appearance.socialLinks] : [];
        links.push({ platform: SITE_MODE_SOCIAL_PLATFORMS[0], url: '' });

        return {
          ...item,
          appearance: {
            ...item.appearance,
            socialLinks: links,
          },
        };
      }),
    }));
  };

  const handleRemoveSocialLink = (index: number) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        const links = item.appearance.socialLinks ? [...item.appearance.socialLinks] : [];
        links.splice(index, 1);

        return {
          ...item,
          appearance: {
            ...item.appearance,
            socialLinks: links,
          },
        };
      }),
    }));
  };

  const handleMailchimpFieldChange = (
    field: 'mailchimpAudienceId' | 'mailchimpServerPrefix',
    value: string,
  ) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        return {
          ...item,
          [field]: normalizeOptionalField(value),
        };
      }),
    }));
  };

  const handleMailchimpEnabledChange = (enabled: boolean) => {
    setConfiguration((prev) => ({
      ...prev,
      modes: prev.modes.map((item) => {
        if (item.mode !== prev.activeMode) {
          return item;
        }

        return {
          ...item,
          mailchimpEnabled: enabled,
        };
      }),
    }));
  };

  const activeModeSummary = summary.find((item) => item.id === configuration.activeMode);
  const filledSocialLinksCount =
    activeModeSettings?.appearance.socialLinks?.filter((link) => link.platform && link.url).length ?? 0;
  const isMailchimpConfigured = Boolean(
    activeModeSettings?.mailchimpAudienceId && activeModeSettings?.mailchimpServerPrefix,
  );
  const hasActiveMode = Boolean(configuration.activeMode && configuration.activeMode !== 'none');

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-headline text-3xl font-bold">
          {dict?.admin?.siteStatus?.title ?? 'Site visibility modes'}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {dict?.admin?.siteStatus?.description ??
            'Switch the public state of your platform and customise its SEO metadata for each mode.'}
        </p>
      </div>

      {errorMessage && (
        <Alert variant="destructive" role="status">
          <AlertTitle>{dict?.admin?.siteStatus?.alertTitle ?? 'We detected an issue'}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-sm">
            <span>{errorMessage}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => void loadConfiguration()}
            >
              {dict?.admin?.siteStatus?.retry ?? 'Retry'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <CardTitle>{dict?.admin?.siteStatus?.modeSelectorTitle ?? 'Choose a mode'}</CardTitle>
                <CardDescription>
                  {dict?.admin?.siteStatus?.modeSelectorDescription ??
                    'Select the experience visitors should see when they reach your site.'}
                </CardDescription>
              </div>
              {hasActiveMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleDeactivateMode()}
                  className="w-full gap-2 md:w-auto"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {dict?.admin?.siteStatus?.deactivating ?? 'Deactivating...'}
                    </span>
                  ) : (
                    dict?.admin?.siteStatus?.deactivate ?? 'Deactivate mode'
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={configuration.activeMode}
                onValueChange={handleModeChange}
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                {summary.map((item) => (
                  <Label
                    key={item.id}
                    htmlFor={`mode-${item.id}`}
                    className={`relative flex cursor-pointer flex-col gap-4 rounded-2xl border p-5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${configuration.activeMode === item.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background-light'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-full bg-primary/10 p-2">{item.icon}</span>
                      <div className="space-y-1">
                        <p className="text-base font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <RadioGroupItem
                      id={`mode-${item.id}`}
                      value={item.id}
                      className="sr-only"
                      aria-label={item.title}
                    />
                    {configuration.activeMode === item.id && (
                      <span className="absolute right-4 top-4 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase text-primary-foreground">
                        {dict?.admin?.siteStatus?.activeBadge ?? 'Active'}
                      </span>
                    )}
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {activeModeSettings && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle>{activeCopy?.title ?? 'SEO metadata'}</CardTitle>
                  <CardDescription>
                    {activeCopy?.description ??
                      'Customise the metadata visitors and search engines will see for the selected mode.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs value={selectedSeoLocale} onValueChange={(value) => setSelectedSeoLocale(value as Locale)}>
                    <TabsList className="grid w-full max-w-xs grid-cols-2">
                      <TabsTrigger value="en">🇺🇸 English</TabsTrigger>
                      <TabsTrigger value="es">🇪🇸 Español</TabsTrigger>
                    </TabsList>

                    <TabsContent value={selectedSeoLocale} className="space-y-6 pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="seo-title">
                            {activeCopy?.fields?.title ?? 'Page title'}
                            <span className="ml-1 text-xs text-muted-foreground">(Optional)</span>
                          </Label>
                          <Input
                            id="seo-title"
                            name="title"
                            value={getSeoFieldValue(activeModeSettings?.seo.title, selectedSeoLocale)}
                            onChange={(event) => handleSeoFieldChange('title', event.target.value)}
                            placeholder="Leave empty to use default"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="seo-description">
                            {activeCopy?.fields?.description ?? 'Meta description'}
                            <span className="ml-1 text-xs text-muted-foreground">(Optional)</span>
                          </Label>
                          <Textarea
                            id="seo-description"
                            name="description"
                            value={getSeoFieldValue(activeModeSettings?.seo.description, selectedSeoLocale)}
                            onChange={(event) => handleSeoFieldChange('description', event.target.value)}
                            rows={4}
                            placeholder="Leave empty to use default"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="seo-keywords">
                            {activeCopy?.fields?.keywords ?? 'Keywords'}
                            <span className="ml-1 text-xs text-muted-foreground">(Optional)</span>
                          </Label>
                          <Input
                            id="seo-keywords"
                            name="keywords"
                            value={getSeoFieldValue(activeModeSettings?.seo.keywords, selectedSeoLocale)}
                            onChange={(event) => handleSeoFieldChange('keywords', event.target.value)}
                            placeholder="wellness, health, launch"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="seo-og-title">{activeCopy?.fields?.ogTitle ?? 'Open Graph title'}</Label>
                          <Input
                            id="seo-og-title"
                            name="og_title"
                            value={getSeoFieldValue(activeModeSettings?.seo.ogTitle, selectedSeoLocale)}
                            onChange={(event) => handleSeoFieldChange('ogTitle', event.target.value)}
                            placeholder={activeCopy?.placeholders?.optional ?? 'Optional'}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seo-og-description">{activeCopy?.fields?.ogDescription ?? 'Open Graph description'}</Label>
                          <Textarea
                            id="seo-og-description"
                            name="og_description"
                            value={getSeoFieldValue(activeModeSettings?.seo.ogDescription, selectedSeoLocale)}
                            onChange={(event) => handleSeoFieldChange('ogDescription', event.target.value)}
                            placeholder={activeCopy?.placeholders?.optional ?? 'Optional'}
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seo-og-image">{activeCopy?.fields?.ogImage ?? 'Open Graph image'}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleOgImageFileChange}
                              disabled={uploadingOgImage}
                              className="hidden"
                              id="seo-og-image-file"
                            />
                            <Label htmlFor="seo-og-image-file" className="cursor-pointer">
                              <Button type="button" variant="outline" size="sm" disabled={uploadingOgImage} asChild>
                                <span>
                                  {uploadingOgImage ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                  )}
                                  {uploadingOgImage ? 'Uploading...' : 'Upload'}
                                </span>
                              </Button>
                            </Label>
                            <Input
                              id="seo-og-image"
                              name="og_image"
                              className="flex-1"
                              value={getSeoFieldValue(activeModeSettings?.seo.ogImage, selectedSeoLocale)}
                              onChange={(event) => handleSeoFieldChange('ogImage', event.target.value)}
                              placeholder="https://example.com/preview.png"
                              disabled={uploadingOgImage}
                            />
                            {getSeoFieldValue(activeModeSettings?.seo.ogImage, selectedSeoLocale) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSeoFieldChange('ogImage', '')}
                                disabled={uploadingOgImage}
                                title="Clear image"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seo-twitter-title">{activeCopy?.fields?.twitterTitle ?? 'Twitter title'}</Label>
                          <Input
                            id="seo-twitter-title"
                            name="twitter_title"
                            value={getSeoFieldValue(activeModeSettings?.seo.twitterTitle, selectedSeoLocale)}
                            onChange={(event) => handleSeoFieldChange('twitterTitle', event.target.value)}
                            placeholder={activeCopy?.placeholders?.optional ?? 'Optional'}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seo-twitter-description">
                            {activeCopy?.fields?.twitterDescription ?? 'Twitter description'}
                          </Label>
                          <Textarea
                            id="seo-twitter-description"
                            name="twitter_description"
                            value={getSeoFieldValue(activeModeSettings?.seo.twitterDescription, selectedSeoLocale)}
                            onChange={(event) => handleSeoFieldChange('twitterDescription', event.target.value)}
                            placeholder={activeCopy?.placeholders?.optional ?? 'Optional'}
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="seo-twitter-image">{activeCopy?.fields?.twitterImage ?? 'Twitter image'}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleTwitterImageFileChange}
                              disabled={uploadingTwitterImage}
                              className="hidden"
                              id="seo-twitter-image-file"
                            />
                            <Label htmlFor="seo-twitter-image-file" className="cursor-pointer">
                              <Button type="button" variant="outline" size="sm" disabled={uploadingTwitterImage} asChild>
                                <span>
                                  {uploadingTwitterImage ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                  )}
                                  {uploadingTwitterImage ? 'Uploading...' : 'Upload'}
                                </span>
                              </Button>
                            </Label>
                            <Input
                              id="seo-twitter-image"
                              name="twitter_image"
                              className="flex-1"
                              value={getSeoFieldValue(activeModeSettings?.seo.twitterImage, selectedSeoLocale)}
                              onChange={(event) => handleSeoFieldChange('twitterImage', event.target.value)}
                              placeholder="https://example.com/social.png"
                              disabled={uploadingTwitterImage}
                            />
                            {getSeoFieldValue(activeModeSettings?.seo.twitterImage, selectedSeoLocale) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSeoFieldChange('twitterImage', '')}
                                disabled={uploadingTwitterImage}
                                title="Clear image"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {activeModeSettings.mode !== 'coming_soon' && (
                <Card>
                  <CardHeader>
                    <CardTitle>{appearanceCopy?.title ?? 'Background'}</CardTitle>
                    <CardDescription>
                      {appearanceCopy?.description ??
                        'Customize the visual appearance while this mode is active.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="background-image">
                        {appearanceCopy?.fields?.backgroundImage ?? 'Background image URL'}
                      </Label>
                      <Input
                        id="background-image"
                        name="backgroundImageUrl"
                        placeholder={appearanceCopy?.placeholders?.backgroundImage ?? 'https://example.com/cover.jpg'}
                        value={activeModeSettings?.appearance.backgroundImageUrl ?? ''}
                        onChange={(event) => handleAppearanceBackgroundChange(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {appearanceCopy?.backgroundHelper ??
                          'Provide an image to personalise the public maintenance or coming soon page.'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="background-overlay">
                        {appearanceCopy?.fields?.backgroundOverlay ?? 'Background overlay opacity'}
                      </Label>
                      <div className="flex items-center gap-4">
                        <input
                          id="background-overlay"
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={activeModeSettings?.appearance.backgroundOverlayOpacity ?? 90}
                          onChange={(event) => handleAppearanceOverlayChange(Number(event.target.value))}
                          className="flex-1"
                          aria-label="Background overlay opacity"
                        />
                        <span className="min-w-[3rem] text-sm font-medium">
                          {activeModeSettings?.appearance.backgroundOverlayOpacity ?? 90}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {appearanceCopy?.overlayHelper ??
                          'Control the darkness of the overlay on top of the background image (0% = transparent, 100% = opaque).'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>{connectionsCopy?.title ?? 'Audience & community'}</CardTitle>
                  <CardDescription>
                    {connectionsCopy?.description ??
                      'Configure your waitlist integration and keep social profiles up to date from here.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Only show Mailchimp section for Coming Soon mode */}
                  {activeModeSettings?.mode === 'coming_soon' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {mailchimpCopy?.title ?? 'Mailchimp integration'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {mailchimpCopy?.description ??
                              'Provide the Mailchimp details used for the coming soon waitlist.'}
                          </p>
                        </div>
                        <Switch
                          id="mailchimp-enabled"
                          checked={activeModeSettings.mailchimpEnabled ?? false}
                          onCheckedChange={handleMailchimpEnabledChange}
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="mailchimp-audience">
                            {comingSoonCopy?.fields?.mailchimpAudienceId ?? 'Mailchimp audience ID'}
                          </Label>
                          <Input
                            id="mailchimp-audience"
                            name="mailchimpAudienceId"
                            value={activeModeSettings.mailchimpAudienceId ?? ''}
                            onChange={(event) => handleMailchimpFieldChange('mailchimpAudienceId', event.target.value)}
                            placeholder={comingSoonCopy?.placeholders?.mailchimpAudienceId ?? 'a1b2c3d4e5'}
                            disabled={!activeModeSettings.mailchimpEnabled}
                          />
                          <p className="text-xs text-muted-foreground">
                            {comingSoonCopy?.helperText?.mailchimpAudienceId ??
                              'Find this value in your Mailchimp audience settings.'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="mailchimp-server">
                            {comingSoonCopy?.fields?.mailchimpServerPrefix ?? 'Mailchimp server prefix'}
                          </Label>
                          <Input
                            id="mailchimp-server"
                            name="mailchimpServerPrefix"
                            value={activeModeSettings.mailchimpServerPrefix ?? ''}
                            onChange={(event) => handleMailchimpFieldChange('mailchimpServerPrefix', event.target.value)}
                            placeholder={comingSoonCopy?.placeholders?.mailchimpServerPrefix ?? 'us21'}
                            disabled={!activeModeSettings.mailchimpEnabled}
                          />
                          <p className="text-xs text-muted-foreground">
                            {comingSoonCopy?.helperText?.mailchimpServerPrefix ??
                              'The code before .api.mailchimp.com (for example, us21).'}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {activeModeSettings.mode === 'coming_soon'
                          ? mailchimpCopy?.helperActive ??
                          'Subscribers will sync automatically while the coming soon experience is live.'
                          : mailchimpCopy?.helperInactive ??
                          'These settings are stored for when you activate the coming soon experience.'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {connectionsSocialCopy?.title ?? 'Social networks'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {connectionsSocialCopy?.description ??
                          'Share the destinations where your community can follow the project.'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {(activeModeSettings?.appearance.socialLinks ?? []).map((link, index) => (
                        <div
                          key={`social-${index}`}
                          className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 md:flex-row md:items-end"
                        >
                          <div className="space-y-2 md:w-56">
                            <Label
                              htmlFor={`social-platform-${index}`}
                              className="text-xs uppercase tracking-wide text-muted-foreground"
                            >
                              {connectionsSocialCopy?.platform ?? 'Platform'}
                            </Label>
                            <Select
                              value={link.platform}
                              onValueChange={(next) => handleSocialLinkChange(index, 'platform', next)}
                            >
                              <SelectTrigger id={`social-platform-${index}`}>
                                <SelectValue
                                  placeholder={
                                    connectionsSocialCopy?.platformPlaceholder ?? 'Select a platform'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {SITE_MODE_SOCIAL_PLATFORMS.map((platform) => (
                                  <SelectItem key={`${platform}-${index}`} value={platform}>
                                    {socialPlatformLabels[platform]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label
                              htmlFor={`social-url-${index}`}
                              className="text-xs uppercase tracking-wide text-muted-foreground"
                            >
                              {connectionsSocialCopy?.url ?? 'Profile URL'}
                            </Label>
                            <Input
                              id={`social-url-${index}`}
                              value={link.url}
                              onChange={(event) => handleSocialLinkChange(index, 'url', event.target.value)}
                              placeholder={
                                connectionsSocialCopy?.urlPlaceholder ?? 'https://instagram.com/yourbrand'
                              }
                              type="url"
                              inputMode="url"
                              required
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="self-start text-destructive hover:text-destructive"
                            onClick={() => handleRemoveSocialLink(index)}
                            aria-label={connectionsSocialCopy?.remove ?? 'Remove social link'}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddSocialLink}
                        className="flex w-full items-center justify-center gap-2"
                        disabled={(activeModeSettings?.appearance.socialLinks?.length ?? 0) >= 10}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {connectionsSocialCopy?.add ?? 'Add social link'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {activeModeSettings?.mode === 'coming_soon' && (
                <Card>
                  <CardHeader>
                    <CardTitle>{comingSoonCopy?.title ?? 'Coming soon settings'}</CardTitle>
                    <CardDescription>
                      {comingSoonCopy?.description ??
                        'Fine-tune the countdown and admin bypass for your teaser page.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ImageUploader
                      label={comingSoonBrandingCopy?.logoLabel ?? 'Coming soon logo URL'}
                      value={activeComingSoonBranding.logoUrl ?? ''}
                      onChange={handleComingSoonLogoChange}
                      filePrefix="coming-soon-logo"
                      placeholder={comingSoonBrandingCopy?.logoPlaceholder ?? 'https://example.com/logo.svg'}
                      showPreview={true}
                    />
                    <p className="text-xs text-muted-foreground">
                      {comingSoonBrandingCopy?.logoHelper ??
                        'Optional override used instead of the default site logo on the coming soon page. You can enter a URL or upload an image.'}
                    </p>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        {comingSoonBrandingCopy?.backgroundModeLabel ?? 'Background style'}
                      </Label>
                      <RadioGroup
                        value={activeComingSoonBranding.backgroundMode}
                        onValueChange={handleComingSoonBackgroundModeChange}
                        className="grid gap-2 sm:grid-cols-2"
                      >
                        <div className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
                          <RadioGroupItem value="image" id="coming-soon-background-image" />
                          <Label htmlFor="coming-soon-background-image" className="cursor-pointer text-sm font-medium">
                            {comingSoonBrandingCopy?.backgroundModeOptions?.image ?? 'Image'}
                          </Label>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
                          <RadioGroupItem value="gradient" id="coming-soon-background-gradient" />
                          <Label
                            htmlFor="coming-soon-background-gradient"
                            className="cursor-pointer text-sm font-medium"
                          >
                            {comingSoonBrandingCopy?.backgroundModeOptions?.gradient ?? 'Gradient'}
                          </Label>
                        </div>
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        {comingSoonBrandingCopy?.backgroundModeHelper ??
                          'Choose between using an image or a gradient background on the public page.'}
                      </p>
                    </div>

                    {activeComingSoonBranding.backgroundMode === 'image' ? (
                      <div className="space-y-4">
                        <ImageUploader
                          label={comingSoonBrandingCopy?.backgroundImageLabel ?? 'Background image override'}
                          value={activeComingSoonBranding.backgroundImageUrl ?? ''}
                          onChange={handleComingSoonBackgroundImageChange}
                          filePrefix="coming-soon-background"
                          placeholder={comingSoonBrandingCopy?.backgroundImagePlaceholder ?? 'https://example.com/background.jpg'}
                          showPreview={true}
                        />
                        <p className="text-xs text-muted-foreground">
                          {comingSoonBrandingCopy?.backgroundImageHelper ??
                            'Optional image used instead of the global background when coming soon mode is active. You can enter a URL or upload an image.'}
                        </p>
                        {!activeComingSoonBranding.backgroundImageUrl && !activeModeSettings?.appearance.backgroundImageUrl && (
                          <p className="text-xs text-amber-600 dark:text-amber-500">
                            ⚠️ No background image configured. Either provide a URL here or configure a global background image in the Appearance section above.
                          </p>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="coming-soon-overlay">
                            {comingSoonBrandingCopy?.overlayLabel ?? 'Background overlay opacity'}
                          </Label>
                          <div className="flex items-center gap-4">
                            <input
                              id="coming-soon-overlay"
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={activeModeSettings?.appearance.backgroundOverlayOpacity ?? 90}
                              onChange={(event) => handleAppearanceOverlayChange(Number(event.target.value))}
                              className="flex-1"
                              aria-label="Background overlay opacity"
                            />
                            <span className="min-w-[3rem] text-sm font-medium">
                              {activeModeSettings?.appearance.backgroundOverlayOpacity ?? 90}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {comingSoonBrandingCopy?.overlayHelper ??
                              'Control the darkness of the overlay applied on top of the background image (0% = transparent, 100% = opaque).'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1 text-left">
                          <Label className="text-sm font-medium">
                            {comingSoonBrandingCopy?.gradientLabel ?? 'Gradient colours'}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {comingSoonBrandingCopy?.gradientHelper ??
                              'Select at least two colours to recreate the teaser gradient.'}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {activeComingSoonBranding.backgroundGradientColors.map((colour, index) => (
                            <div
                              key={`coming-soon-gradient-${index}`}
                              className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center"
                            >
                              <input
                                type="color"
                                value={colour}
                                onChange={(event) =>
                                  handleComingSoonGradientColourChange(index, event.target.value)
                                }
                                className="h-12 w-full rounded-md border border-border/60 bg-background sm:h-12 sm:w-16"
                                aria-label={(comingSoonBrandingCopy?.gradientColorLabel ?? 'Gradient colour') + ` ${index + 1}`}
                              />
                              <Input
                                value={colour}
                                onChange={(event) => handleComingSoonGradientColourChange(index, event.target.value)}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveGradientColour(index)}
                                disabled={activeComingSoonBranding.backgroundGradientColors.length <= 2}
                                aria-label={comingSoonBrandingCopy?.removeColor ?? 'Remove colour stop'}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddGradientColour}
                            disabled={activeComingSoonBranding.backgroundGradientColors.length >= 5}
                            className="flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {comingSoonBrandingCopy?.addColor ?? 'Add colour'}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            {comingSoonBrandingCopy?.gradientLimit ?? 'You can define up to five colour stops.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 border-t border-border/40 pt-6 mt-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          {countdownCopy?.title ?? 'Countdown display'}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {countdownCopy?.description ??
                            'Display a countdown on the coming soon page to reinforce your launch date.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Switch
                          id="coming-soon-countdown-toggle"
                          checked={countdownEnabled}
                          onCheckedChange={handleCountdownEnabledChange}
                        />
                        <div>
                          <Label htmlFor="coming-soon-countdown-toggle" className="text-sm font-medium">
                            {countdownCopy?.enableLabel ?? 'Show countdown'}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {countdownCopy?.enableHelper ??
                              'Enable to display the countdown block on the public page.'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="coming-soon-countdown-date">
                          {countdownCopy?.dateLabel ?? 'Launch date'}
                        </Label>
                        <Input
                          id="coming-soon-countdown-date"
                          type="datetime-local"
                          value={countdownDateValue}
                          onChange={(event) => handleCountdownDateChange(event.target.value)}
                          disabled={!countdownEnabled}
                        />
                        <p className="text-xs text-muted-foreground">
                          {countdownCopy?.dateHelper ??
                            'Use your local timezone. Visitors will see a live countdown until this date.'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-2xl border border-dashed border-border/60 bg-background-light/60 p-4 sm:flex sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground sm:max-w-lg">
                  {dict?.admin?.siteStatus?.modeHint ??
                    'Changes affect only the selected mode. Switch modes to configure their SEO independently.'}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row">
                  <Button type="submit" disabled={saving} className="min-w-[10rem]">
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {dict?.admin?.siteStatus?.saving ?? 'Saving...'}
                      </span>
                    ) : (
                      dict?.admin?.siteStatus?.save ?? 'Save changes'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{overviewCopy?.title ?? 'Current experience'}</CardTitle>
              <CardDescription>
                {overviewCopy?.description ??
                  'Keep an eye on the active mode and quick integration details.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasActiveMode && activeModeSummary ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="rounded-full bg-primary/10 p-2">{activeModeSummary.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{activeModeSummary.title}</p>
                      <p className="text-xs text-muted-foreground">{activeModeSummary.description}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                      <span className="text-muted-foreground">
                        {overviewCopy?.statusLabel ?? 'Status'}
                      </span>
                      <span className="font-medium text-foreground">
                        {overviewCopy?.active ?? 'Active'}
                      </span>
                    </div>

                    {/* Only show Mailchimp status for Coming Soon mode */}
                    {activeModeSettings?.mode === 'coming_soon' && (
                      <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                        <span className="text-muted-foreground">
                          {overviewCopy?.mailchimpLabel ?? 'Mailchimp'}
                        </span>
                        <span className={`font-medium ${activeModeSettings?.mailchimpEnabled && isMailchimpConfigured ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {activeModeSettings?.mailchimpEnabled
                            ? isMailchimpConfigured
                              ? overviewCopy?.mailchimpConfigured ?? 'Enabled'
                              : overviewCopy?.mailchimpMissing ?? 'Enabled (incomplete)'
                            : overviewCopy?.mailchimpDisabled ?? 'Disabled'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                      <span className="text-muted-foreground">
                        {overviewCopy?.socialLabel ?? 'Social links'}
                      </span>
                      <span className="font-medium text-foreground">
                        {filledSocialLinksCount > 0
                          ? `${filledSocialLinksCount}`
                          : overviewCopy?.socialEmpty ?? 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{overviewCopy?.empty ?? 'No mode is currently active.'}</p>
                  <p>{overviewCopy?.emptyHelper ?? 'Choose a mode to publish a dedicated experience for visitors.'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
