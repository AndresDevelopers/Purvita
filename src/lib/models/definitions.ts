import { z } from 'zod';

const normalizeNullableDateTime = z
  .union([z.string(), z.number(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
      const date = new Date(normalized);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    return null;
  });


const textExtractionKeys = ['text', 'label', 'value', 'title', 'description', 'name'];

const extractStringCandidate = (input: unknown): string | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  for (const key of textExtractionKeys) {
    const candidate = (input as Record<string, unknown>)[key];
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

export const normalizeStringArray = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeStringArray(parsed);
      } catch {
        // Ignore JSON parse errors and treat value as a plain string.
      }
    }

    return [trimmed];
  }

  if (Array.isArray(value)) {
    const results: string[] = [];

    for (const entry of value) {
      if (Array.isArray(entry)) {
        results.push(...normalizeStringArray(entry));
        continue;
      }

      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed) {
          results.push(trimmed);
        }
        continue;
      }

      if (entry && typeof entry === 'object') {
        const items = (entry as { items?: unknown[] }).items;
        if (Array.isArray(items)) {
          results.push(...normalizeStringArray(items));
          continue;
        }

        const extracted = extractStringCandidate(entry);
        if (extracted) {
          results.push(extracted);
        }
        continue;
      }

      if (entry !== null && entry !== undefined) {
        const coerced = String(entry).trim();
        if (coerced) {
          results.push(coerced);
        }
      }
    }

    return results;
  }

  if (typeof value === 'object') {
    const items = (value as { items?: unknown[] }).items;
    if (Array.isArray(items)) {
      return normalizeStringArray(items);
    }

    const extracted = extractStringCandidate(value);
    if (extracted) {
      return [extracted];
    }

    return [];
  }

  const coerced = String(value).trim();
  return coerced ? [coerced] : [];
};

const StringArraySchema = z.preprocess(normalizeStringArray, z.array(z.string()));

export const ProductImageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  hint: z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string()),
  isFeatured: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 't'].includes(normalized);
    }
    return Boolean(value);
  }, z.boolean()).default(false).optional(),
});

export type ProductImage = z.infer<typeof ProductImageSchema>;

const LocaleSchema = z.enum(['en', 'es']);

const generateStableId = () => {
  const cryptoApi =
    typeof globalThis !== 'undefined' && 'crypto' in globalThis
      ? (globalThis.crypto as { randomUUID?: () => string })
      : undefined;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return Math.random().toString(36).slice(2);
};

const ProductExperienceLocaleSchema = z
  .object({
    tagline: z.preprocess((value) => (typeof value === 'string' ? value : undefined), z.string().min(1).optional()),
    heroSupporting: z.preprocess(
      (value) => (typeof value === 'string' ? value : undefined),
      z.string().min(1).optional(),
    ),
    quickHighlights: z
      .preprocess((value) => (Array.isArray(value) ? value : undefined),
        z.array(z.string().min(1)).optional(),
      ),
    usage: z
      .preprocess((value) => (Array.isArray(value) ? value : undefined),
        z.array(z.string().min(1)).optional(),
      ),
    ingredients: z
      .preprocess((value) => (Array.isArray(value) ? value : undefined),
        z.array(z.string().min(1)).optional(),
      ),
    wellness: z
      .preprocess((value) => (Array.isArray(value) ? value : undefined),
        z.array(z.string().min(1)).optional(),
      ),
    insights: z
      .preprocess((value) => (Array.isArray(value) ? value : undefined),
        z.array(z.string().min(1)).optional(),
      ),
  })
  .partial();

export type ProductExperienceLocale = z.infer<typeof ProductExperienceLocaleSchema>;

const ProductReviewSourceSchema = z.enum(['admin', 'member']);

export const ProductReviewSchema = z
  .object({
    id: z
      .preprocess((value) => {
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
        return generateStableId();
      }, z.string())
      .default(() => generateStableId()),
    user_id: z.string().uuid().optional(),
    author: z.preprocess(
      (value) => (typeof value === 'string' ? value : 'Customer'),
      z.string().min(1),
    ),
    avatarUrl: z
      .preprocess((value) => {
        if (typeof value !== 'string') {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }, z.string().url().optional())
      .optional(),
    locale: LocaleSchema.default('en').optional(),
    rating: z.coerce.number().min(0).max(5).default(5),
    timeAgo: z
      .preprocess((value) => {
        if (typeof value !== 'string') {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }, z.string().optional())
      .optional(),
    comment: z.preprocess(
      (value) => (typeof value === 'string' ? value : ''),
      z.string().min(1),
    ),
    source: ProductReviewSourceSchema.default('member').optional(),
    createdAt: normalizeNullableDateTime.optional(),
  })
  .partial()
  .transform((value) => {
    return {
      id: value.id ?? generateStableId(),
      user_id: value.user_id,
      author: value.author ?? 'Customer',
      avatarUrl: value.avatarUrl,
      locale: value.locale ?? 'en',
      rating: typeof value.rating === 'number' ? value.rating : 5,
      timeAgo: value.timeAgo,
      comment: value.comment ?? '',
      source: value.source ?? 'member',
      createdAt: value.createdAt ?? null,
    };
  });

export type ProductReview = z.infer<typeof ProductReviewSchema>;

const ProductDiscountTypeSchema = z.enum(['amount', 'percentage']);

export type ProductDiscountType = z.infer<typeof ProductDiscountTypeSchema>;

const DiscountVisibilitySiteSchema = z.enum(['main_store', 'affiliate_store', 'mlm_store']);

export type DiscountVisibilitySite = z.infer<typeof DiscountVisibilitySiteSchema>;

export const ALL_DISCOUNT_VISIBILITY_SITES: DiscountVisibilitySite[] = ['main_store', 'affiliate_store', 'mlm_store'];

const normalizeDiscountVisibility = (value: unknown): DiscountVisibilitySite[] => {
  if (!value) {
    return [...ALL_DISCOUNT_VISIBILITY_SITES];
  }

  const validSites = new Set<DiscountVisibilitySite>(['main_store', 'affiliate_store', 'mlm_store']);

  const toSite = (input: unknown): DiscountVisibilitySite | null => {
    if (typeof input !== 'string') {
      return null;
    }

    const normalized = input.trim().toLowerCase() as DiscountVisibilitySite;
    return validSites.has(normalized) ? normalized : null;
  };

  if (Array.isArray(value)) {
    const sites = value
      .map((entry) => toSite(entry))
      .filter((entry): entry is DiscountVisibilitySite => Boolean(entry));
    return sites.length > 0 ? Array.from(new Set(sites)) : [...ALL_DISCOUNT_VISIBILITY_SITES];
  }

  if (typeof value === 'string') {
    const segments = value
      .split(',')
      .map((entry) => toSite(entry))
      .filter((entry): entry is DiscountVisibilitySite => Boolean(entry));
    return segments.length > 0 ? Array.from(new Set(segments)) : [...ALL_DISCOUNT_VISIBILITY_SITES];
  }

  return [...ALL_DISCOUNT_VISIBILITY_SITES];
};

const normalizeCountryCodes = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  const toCode = (input: unknown): string | null => {
    if (typeof input !== 'string') {
      return null;
    }

    const normalized = input.trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    if (!/^[A-Z]{2}$/.test(normalized)) {
      return null;
    }

    return normalized;
  };

  if (Array.isArray(value)) {
    const codes = value
      .map((entry) => toCode(entry))
      .filter((entry): entry is string => Boolean(entry));
    return Array.from(new Set(codes));
  }

  if (typeof value === 'string') {
    const segments = value
      .split(',')
      .map((entry) => toCode(entry))
      .filter((entry): entry is string => Boolean(entry));
    return Array.from(new Set(segments));
  }

  return [];
};

const normalizeProductIds = (value: unknown): string[] => {
  const toId = (input: unknown): string | null => {
    if (typeof input !== 'string') {
      return null;
    }

    const normalized = input.trim();
    if (!normalized) {
      return null;
    }

    return normalized;
  };

  if (Array.isArray(value)) {
    const ids = value
      .map((entry) => toId(entry))
      .filter((entry): entry is string => Boolean(entry));
    return Array.from(new Set(ids));
  }

  if (typeof value === 'string') {
    const segments = value
      .split(',')
      .map((entry) => toId(entry))
      .filter((entry): entry is string => Boolean(entry));
    return Array.from(new Set(segments));
  }

  return [];
};

const ProductExperienceSchema = z
  .object({
    locales: z
      .record(z.string(), ProductExperienceLocaleSchema)
      .optional()
      .default({}),
    rating: z
      .object({
        average: z.coerce.number().min(0).max(5).optional(),
        count: z.coerce.number().int().min(0).optional(),
      })
      .partial()
      .optional()
      .default({}),
    reviews: z.array(ProductReviewSchema).optional().default([]),
    lastEditedBy: z
      .preprocess((value) => (typeof value === 'string' ? value : undefined), z.string().optional())
      .optional(),
  })
  .partial();

export type ProductExperience = z.infer<typeof ProductExperienceSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.coerce.number().positive(),
  discount_type: z
    .preprocess((value) => {
      if (typeof value !== 'string') {
        return null;
      }

      const normalized = value.trim().toLowerCase();
      if (normalized.length === 0) {
        return null;
      }

      if (normalized === 'amount' || normalized === 'percentage') {
        return normalized;
      }

      return null;
    }, ProductDiscountTypeSchema.nullable())
    .optional(),
  discount_value: z
    .preprocess((value) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }

      if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.max(0, value) : null;
      }

      if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
          return null;
        }
        const parsed = Number(normalized);
        if (Number.isNaN(parsed)) {
          return null;
        }
        return Math.max(0, parsed);
      }

      return null;
    }, z.number().nonnegative().nullable())
    .optional(),
  discount_label: z
    .preprocess((value) => {
      if (typeof value !== 'string') {
        return null;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }, z.string().min(1).nullable())
    .optional(),
  discount_visibility: z
    .preprocess((value) => normalizeDiscountVisibility(value), z.array(DiscountVisibilitySiteSchema))
    .default([...ALL_DISCOUNT_VISIBILITY_SITES]),
  stock_quantity: z
    .preprocess((value) => {
      if (value === null || value === undefined || value === '') {
        return 0;
      }
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
          return 0;
        }
        const parsed = Number(normalized);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    }, z.coerce.number().int().min(0)).default(0),
  images: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(ProductImageSchema)),
  is_featured: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
        return false;
      }
    }
    return Boolean(value);
  }, z.boolean()).default(false),
  cart_visibility_countries: z
    .preprocess((value) => normalizeCountryCodes(value), z.array(z.string()))
    .transform((codes) => Array.from(new Set(codes.map((code) => code.trim().toUpperCase()))))
    .default([]),
  related_product_ids: z
    .preprocess((value) => normalizeProductIds(value), z.array(z.string()))
    .transform((ids) => Array.from(new Set(ids.map((id) => id.trim()))))
    .default([]),
  created_at: normalizeNullableDateTime.optional(),
  updated_at: normalizeNullableDateTime.optional(),
  experience: z
    .preprocess((value) => {
      if (!value || typeof value !== 'object') {
        return undefined;
      }
      return value;
    }, ProductExperienceSchema)
    .optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export type ProductCreationInput = Omit<Product, 'id' | 'cart_visibility_countries'> & {
  id: string;
  cart_visibility_countries?: Product['cart_visibility_countries'];
};

// User Profile Schema
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['member', 'admin']).default('member').optional(), // Legacy field, no longer in database
  role_id: z.string().uuid().nullable().optional(),
  role_name: z.object({ name: z.string() }).nullable().optional(), // Populated from JOIN with roles table
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  pay: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return Boolean(value);
  }, z.boolean()).default(false),
  referral_code: z.string().optional(),
  affiliate_store_slug: z.string().optional(),
  referred_by: z.string().uuid().optional(),
  team_count: z.number().int().min(0).default(0),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  default_payment_provider: z
    .preprocess((value) => {
      if (typeof value !== 'string') {
        return undefined;
      }
      const normalized = value.trim().toLowerCase();
      if (normalized === 'paypal' || normalized === 'stripe' || normalized === 'wallet') {
        return normalized;
      }
      return undefined;
    }, z.enum(['paypal', 'stripe', 'wallet']).optional()),
  avatar_url: z.string().url().optional(),
  commission_rate: z.number().min(0).max(1).default(0.10),
  total_earnings: z.number().min(0).default(0),
  current_phase: z.number().int().min(0).optional(),
  subscription_status: z.enum(['active', 'inactive', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'paused']).optional(),
  subscription_type: z.enum(['mlm', 'affiliate']).optional(),
  show_reviews: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
        return false;
      }
    }
    return Boolean(value);
  }, z.boolean()).default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// Schema for creating/updating user profiles
// team_count is omitted as it's auto-maintained by database triggers
export const CreateUserProfileSchema = UserProfileSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  team_count: true,
});

export const UpdateUserProfileSchema = CreateUserProfileSchema.partial();

export type CreateUserProfile = z.infer<typeof CreateUserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;


export const ClassVideoVisibilitySchema = z.enum(['subscription', 'product', 'all']);

export type ClassVideoVisibility = z.infer<typeof ClassVideoVisibilitySchema>;

export const ClassVideoSchema = z
  .object({
    id: z.preprocess((value) => value || '00000000-0000-0000-0000-000000000000', z.string().uuid()),
    title: z.preprocess((value) => value || 'Untitled', z.string().min(1)),
    description: z.preprocess((value) => value ?? '', z.string()),
    youtube_id: z.preprocess((value) => value || 'invalid-youtube-id', z.string().min(1)),
    category: z.preprocess((value) => value ?? undefined, z.string().optional()),
    visibility: z.preprocess((value) => {
      if (typeof value === 'string' && ['subscription', 'product', 'all'].includes(value)) {
        return value;
      }
      return undefined;
    }, ClassVideoVisibilitySchema.optional()),
    allowed_levels: z.preprocess((value) => {
      if (Array.isArray(value)) {
        return value.map(Number).filter((n) => !isNaN(n));
      }
      return null;
    }, z.array(z.number().int()).nullable().optional()),
    is_published: z.preprocess((value) => {
      if (value === null || value === undefined) {
        return true;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
          return true;
        }
        if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
          return false;
        }
      }
      if (typeof value === 'number') {
        return value === 1;
      }
      return Boolean(value);
    }, z.boolean()).default(true),
    is_featured: z.preprocess((value) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
          return true;
        }
        if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
          return false;
        }
      }
      if (typeof value === 'number') {
        return value === 1;
      }
      return Boolean(value);
    }, z.boolean()).default(false),
    order_index: z.preprocess((value) => value ?? 0, z.coerce.number().int().min(0)),
    created_at: normalizeNullableDateTime.optional(),
    updated_at: normalizeNullableDateTime.optional(),
  })
  .transform((value) => ({
    id: value.id,
    title: value.title,
    description: value.description ?? '',
    youtube_id: value.youtube_id,
    category: value.category,
    visibility: value.visibility ?? 'all',
    allowed_levels: value.allowed_levels ?? null,
    is_published: value.is_published ?? true,
    is_featured: value.is_featured ?? false,
    order_index: value.order_index ?? 0,
    created_at: value.created_at,
    updated_at: value.updated_at,
  }));

export type ClassVideo = z.infer<typeof ClassVideoSchema>;
export type Locale = 'en' | 'es';

// Plan Schema
export const PlanSchema = z.object({
  id: z.string(),
  slug: z.string(),
  // Legacy fields for backward compatibility
  name: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  description: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  features: StringArraySchema.optional(),
  // Internationalized fields
  name_en: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  name_es: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  description_en: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  description_es: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  features_en: StringArraySchema.optional(),
  features_es: StringArraySchema.optional(),
  price: z.coerce.number().positive(),
  is_active: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
        return false;
      }
    }
    return Boolean(value);
  }, z.boolean()).default(true),
  is_affiliate_plan: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
        return false;
      }
    }
    return Boolean(value);
  }, z.boolean()).default(false),
  is_mlm_plan: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
        return false;
      }
    }
    return Boolean(value);
  }, z.boolean()).default(true),
  is_default: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
        return false;
      }
    }
    return Boolean(value);
  }, z.boolean()).default(false),
  display_order: z.preprocess((value) => value ?? 0, z.coerce.number().int().min(0)).default(0),
  created_at: normalizeNullableDateTime.optional(),
  updated_at: normalizeNullableDateTime.optional(),
});

export type Plan = z.infer<typeof PlanSchema>;

// Schema for plan form validation (requires internationalized fields)
export const PlanFormSchema = z.object({
  slug: z.string().min(1),
  name_en: z.string().min(1),
  name_es: z.string().min(1),
  description_en: z.string().min(1),
  description_es: z.string().min(1),
  features_en: z.array(z.string().min(1)).min(1),
  features_es: z.array(z.string().min(1)).min(1),
  price: z.coerce.number().positive(),
  is_active: z.boolean().default(true),
  is_affiliate_plan: z.boolean().default(false),
  is_mlm_plan: z.boolean().default(true),
  is_default: z.boolean().default(false),
  display_order: z.coerce.number().int().min(0).default(0),
});

export type PlanFormData = z.infer<typeof PlanFormSchema>;

// SEO Schema
export const SeoSchema = z.object({
  id: z.string().uuid(),
  page: z.string().min(1),
  locale: z.string().min(2),
  title: z.string().min(1),
  description: z.string().min(1),
  keywords: z.string().default(''),
  canonical_url: z.string().url().nullable().optional(),
  robots_index: z.boolean().default(true),
  robots_follow: z.boolean().default(true),
  robots_advanced: z.string().nullable().optional(),
  og_title: z.string().nullable().optional(),
  og_description: z.string().nullable().optional(),
  og_image: z.string().nullable().optional(),
  twitter_title: z.string().nullable().optional(),
  twitter_description: z.string().nullable().optional(),
  twitter_image: z.string().nullable().optional(),
  json_ld: z.string().nullable().optional(),
  created_at: normalizeNullableDateTime.optional(),
  updated_at: normalizeNullableDateTime.optional(),
});

export const SeoUpsertSchema = SeoSchema.pick({
  id: true,
  page: true,
  locale: true,
  title: true,
  description: true,
  keywords: true,
  canonical_url: true,
  robots_index: true,
  robots_follow: true,
  robots_advanced: true,
  og_title: true,
  og_description: true,
  og_image: true,
  twitter_title: true,
  twitter_description: true,
  twitter_image: true,
  json_ld: true,
}).extend({
  id: z.string().uuid().optional(),
  keywords: z.string().optional(),
  canonical_url: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  robots_index: z.boolean().optional(),
  robots_follow: z.boolean().optional(),
  robots_advanced: z.union([z.string(), z.literal('')]).optional().nullable(),
  og_title: z.union([z.string(), z.literal('')]).optional().nullable(),
  og_description: z.union([z.string(), z.literal('')]).optional().nullable(),
  og_image: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  twitter_title: z.union([z.string(), z.literal('')]).optional().nullable(),
  twitter_description: z.union([z.string(), z.literal('')]).optional().nullable(),
  twitter_image: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  json_ld: z.union([z.string(), z.literal('')]).optional().nullable(),
});

export const SeoCollectionPayloadSchema = z.object({
  settings: z.array(SeoUpsertSchema),
});

export type Seo = z.infer<typeof SeoSchema>;
export type SeoUpsertInput = z.infer<typeof SeoUpsertSchema>;

