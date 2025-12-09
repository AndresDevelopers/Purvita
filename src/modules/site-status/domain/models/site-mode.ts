import { z } from 'zod';

export const SITE_MODE_OPTIONS = ['none', 'maintenance', 'coming_soon'] as const;
export const PERSISTED_SITE_MODE_OPTIONS = ['maintenance', 'coming_soon'] as const;

export const SiteModeTypeSchema = z.enum(SITE_MODE_OPTIONS);

export const SITE_MODE_SOCIAL_PLATFORMS = ['facebook', 'instagram', 'youtube', 'x', 'whatsapp'] as const;
export const SiteModeSocialPlatformSchema = z.enum(SITE_MODE_SOCIAL_PLATFORMS);
export type SiteModeSocialPlatform = z.infer<typeof SiteModeSocialPlatformSchema>;

export const SITE_MODE_SOCIAL_PLATFORM_LABELS: Record<SiteModeSocialPlatform, string> = Object.freeze({
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  whatsapp: 'WhatsApp',
});

const SOCIAL_PLATFORM_ALIASES: Record<SiteModeSocialPlatform, string[]> = Object.freeze({
  facebook: ['facebook', 'fb', 'meta'],
  instagram: ['instagram', 'ig'],
  youtube: ['youtube', 'yt'],
  x: ['x', 'twitter', 'xtwitter', 'twitterx'],
  whatsapp: ['whatsapp', 'wa', 'whatsap'],
});

const normalizePlatformCandidate = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

export const resolveSiteModeSocialPlatform = (
  value: string | null | undefined,
): SiteModeSocialPlatform | null => {
  if (!value) {
    return null;
  }

  const candidate = normalizePlatformCandidate(value);

  if (!candidate) {
    return null;
  }

  for (const platform of SITE_MODE_SOCIAL_PLATFORMS) {
    const aliases = SOCIAL_PLATFORM_ALIASES[platform] ?? [];
    if (normalizePlatformCandidate(platform) === candidate) {
      return platform;
    }

    if (aliases.some((alias) => normalizePlatformCandidate(alias) === candidate)) {
      return platform;
    }
  }

  return null;
};

const nullableString = z
  .preprocess((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z.string().max(300).nullable());

const nullableIsoDatetime = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (!trimmed) {
        return null;
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    return null;
  },
  z.string().datetime({ offset: true }).nullable(),
);

const nullableUrlLikeString = z
  .preprocess((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z
    .string()
    .max(500)
    .refine(
      (val) => {
        if (!val) return true;
        if (val.startsWith('/')) {
          return true;
        }

        try {
          // Allow valid URLs
           
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Please provide a valid URL or relative path' },
    )
    .nullable());

const _keywordsSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  },
  z.string().max(320).default(''),
);

const countdownDisplayModeSchema = z.enum(['numeric', 'date']);
type CountdownDisplayMode = z.infer<typeof countdownDisplayModeSchema>;

const hexColorSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
    'Please provide a valid hex colour (for example, #6A11CB).',
  )
  .transform((value) => {
    const trimmed = value.startsWith('#') ? value.slice(1) : value;

    if (!trimmed) {
      return '#000000';
    }

    if (trimmed.length === 3) {
      const [r, g, b] = trimmed;
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }

    return `#${trimmed.slice(0, 6)}`.toLowerCase();
  });

const defaultGradientColours = Object.freeze(['#9fc4ff', '#d3b4ff']);

export const SiteModeComingSoonBrandingSchema = z
  .object({
    logoUrl: nullableUrlLikeString,
    backgroundMode: z.enum(['image', 'gradient']).default('gradient'),
    backgroundImageUrl: nullableUrlLikeString,
    backgroundGradientColors: z.array(hexColorSchema).max(5).default([...defaultGradientColours]),
  })
  .default({
    logoUrl: null,
    backgroundMode: 'gradient',
    backgroundImageUrl: null,
    backgroundGradientColors: [...defaultGradientColours],
  });

const countdownNumericValueSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return null;
      }

      return Math.max(0, Math.floor(parsed));
    }

    return null;
  },
  z.number().int().min(0).max(999999).nullable(),
);

const defaultComingSoonCountdown = Object.freeze({
  isEnabled: false,
  style: 'date' as CountdownDisplayMode,
  label: null as string | null,
  numericValue: null as number | null,
  targetDate: null as string | null,
});

const defaultComingSoonBranding = Object.freeze(
  SiteModeComingSoonBrandingSchema.parse(undefined),
);

const defaultComingSoonSettings = Object.freeze({
  headline: null as string | null,
  subheadline: null as string | null,
  countdown: defaultComingSoonCountdown,
  branding: defaultComingSoonBranding,
});

export const SiteModeComingSoonCountdownSchema = z
  .object({
    isEnabled: z.boolean().default(false),
    style: countdownDisplayModeSchema.default('date'),
    label: nullableString,
    numericValue: countdownNumericValueSchema,
    targetDate: nullableIsoDatetime,
  })
  .default(defaultComingSoonCountdown);

export const SiteModeComingSoonSettingsSchema = z
  .object({
    headline: nullableString,
    subheadline: nullableString,
    countdown: SiteModeComingSoonCountdownSchema,
    branding: SiteModeComingSoonBrandingSchema,
  })
  .default(defaultComingSoonSettings);

// Schema for multilingual SEO fields
const MultilingualStringSchema = z.record(z.enum(['en', 'es']), z.string());
const OptionalMultilingualStringSchema = z.record(z.enum(['en', 'es']), z.string().nullable()).nullable();

// Preprocessor to handle empty strings and convert them to defaults
const optionalSeoString = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  },
  z.union([z.string(), MultilingualStringSchema]).default(''),
);

const optionalSeoNullableString = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  },
  z.union([nullableString, OptionalMultilingualStringSchema]).nullable().default(null),
);

export const SiteModeSeoSchema = z.object({
  title: optionalSeoString,
  description: optionalSeoString,
  keywords: optionalSeoString,
  ogTitle: optionalSeoNullableString,
  ogDescription: optionalSeoNullableString,
  ogImage: optionalSeoNullableString,
  twitterTitle: optionalSeoNullableString,
  twitterDescription: optionalSeoNullableString,
  twitterImage: optionalSeoNullableString,
});

const socialUrlSchema = z
  .string()
  .trim()
  .max(500, 'URL is too long')
  .refine((val) => {
    try {
       
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'A valid URL is required');

export const SiteModeSocialLinkSchema = z.object({
  platform: SiteModeSocialPlatformSchema,
  url: socialUrlSchema,
});

export const SiteModeAppearanceSchema = z.object({
  backgroundImageUrl: nullableUrlLikeString,
  backgroundOverlayOpacity: z.number().min(0).max(100).default(90),
  socialLinks: z
    .array(SiteModeSocialLinkSchema)
    .max(10)
    .default([]),
});

export const SiteModeSettingsSchema = z.object({
  mode: SiteModeTypeSchema,
  isActive: z.boolean().default(false),
  seo: SiteModeSeoSchema,
  appearance: SiteModeAppearanceSchema,
  mailchimpEnabled: z.boolean().default(false),
  mailchimpAudienceId: nullableString,
  mailchimpServerPrefix: nullableString,
  comingSoon: SiteModeComingSoonSettingsSchema,
  updatedAt: z
    .preprocess((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
          return null;
        }

        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }

      return null;
    }, z.string().datetime().nullable())
    .optional(),
});

export const SiteModeConfigurationSchema = z.object({
  activeMode: SiteModeTypeSchema,
  modes: z.array(SiteModeSettingsSchema),
});

export const SiteModeUpsertInputSchema = SiteModeSettingsSchema.pick({
  mode: true,
  seo: true,
  appearance: true,
  mailchimpEnabled: true,
  mailchimpAudienceId: true,
  mailchimpServerPrefix: true,
  comingSoon: true,
}).extend({
  isActive: z.boolean().optional(),
});

export const UpdateSiteModeConfigurationSchema = z.object({
  activeMode: SiteModeTypeSchema,
  modes: z.array(SiteModeUpsertInputSchema),
});

export type SiteModeType = z.infer<typeof SiteModeTypeSchema>;
export type SiteModeSeo = z.infer<typeof SiteModeSeoSchema>;
export type SiteModeAppearance = z.infer<typeof SiteModeAppearanceSchema>;
export type SiteModeSocialLink = SiteModeAppearance['socialLinks'][number];
export type SiteModeComingSoonCountdown = z.infer<typeof SiteModeComingSoonCountdownSchema>;
export type SiteModeComingSoonBranding = z.infer<typeof SiteModeComingSoonBrandingSchema>;
export type SiteModeComingSoonSettings = z.infer<typeof SiteModeComingSoonSettingsSchema>;
export type SiteModeSettings = z.infer<typeof SiteModeSettingsSchema>;
export type SiteModeConfiguration = z.infer<typeof SiteModeConfigurationSchema>;
export type SiteModeUpsertInput = z.infer<typeof SiteModeUpsertInputSchema>;
export type UpdateSiteModeConfigurationInput = z.infer<typeof UpdateSiteModeConfigurationSchema>;

export const createDefaultSeoSettings = (mode: SiteModeType): SiteModeSeo => {
  if (mode === 'none') {
    return {
      title: 'PūrVita Network',
      description: 'Discover wellness products, plans, and resources tailored to your journey.',
      keywords: '',
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      twitterTitle: null,
      twitterDescription: null,
      twitterImage: null,
    };
  }

  return {
    title: mode === 'maintenance' ? 'Site under maintenance' : 'We are launching soon',
    description:
      mode === 'maintenance'
        ? 'We are currently performing scheduled maintenance. Please check back shortly.'
        : 'A new experience is coming soon. Leave your email to be the first to know when we launch.',
    keywords: '',
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    twitterTitle: null,
    twitterDescription: null,
    twitterImage: null,
  };
};

export const createDefaultAppearance = (): SiteModeAppearance => ({
  backgroundImageUrl: null,
  backgroundOverlayOpacity: 90,
  socialLinks: [],
});

export const createDefaultComingSoonSettings = (): SiteModeComingSoonSettings => ({
  headline: null,
  subheadline: null,
  countdown: {
    isEnabled: false,
    style: 'date',
    label: null,
    numericValue: null,
    targetDate: null,
  },
  branding: SiteModeComingSoonBrandingSchema.parse(undefined),
});

export const createDefaultConfiguration = (): SiteModeConfiguration => ({
  activeMode: 'none',
  modes: SITE_MODE_OPTIONS.map((mode) => ({
    mode,
    isActive: mode === 'none',
    seo: createDefaultSeoSettings(mode),
    appearance: createDefaultAppearance(),
    mailchimpEnabled: false,
    mailchimpAudienceId: null,
    mailchimpServerPrefix: null,
    comingSoon: createDefaultComingSoonSettings(),
  })),
});
