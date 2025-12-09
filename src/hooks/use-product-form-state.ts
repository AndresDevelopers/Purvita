import { useState, useCallback, useEffect } from 'react';
import type { Product, ProductImage } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';

type ExperienceLocaleState = {
  tagline: string;
  heroSupporting: string;
  quickHighlights: string[];
  usage: string[];
  ingredients: string[];
  wellness: string[];
  insights: string[];
};

type ReviewSource = 'admin' | 'member';

type ReviewState = {
  id: string;
  author: string;
  avatarUrl: string;
  locale: Locale;
  rating: number;
  timeAgo: string;
  comment: string;
  source: ReviewSource;
};

interface ExperienceState {
  locales: Record<Locale, ExperienceLocaleState>;
  rating: {
    average: string;
    count: string;
  };
  reviews: ReviewState[];
}

const supportedLocales: readonly Locale[] = ['en', 'es'] as const;

const createClientId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
};

const emptyLocaleState = (): ExperienceLocaleState => ({
  tagline: '',
  heroSupporting: '',
  quickHighlights: [],
  usage: [],
  ingredients: [],
  wellness: [],
  insights: [],
});

const parseLines = (value: string): string[] => {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const buildInitialExperienceState = (product?: Product): ExperienceState => {
  const locales = supportedLocales.reduce((acc, locale) => {
    const existing = product?.experience?.locales?.[locale] ?? emptyLocaleState();

    acc[locale] = {
      tagline: existing.tagline ?? '',
      heroSupporting: existing.heroSupporting ?? '',
      quickHighlights: [...(existing.quickHighlights ?? [])],
      usage: [...(existing.usage ?? [])],
      ingredients: [...(existing.ingredients ?? [])],
      wellness: [...(existing.wellness ?? [])],
      insights: [...(existing.insights ?? [])],
    };

    return acc;
  }, {} as Record<Locale, ExperienceLocaleState>);

  return {
    locales,
    rating: {
      average:
        product?.experience?.rating?.average !== undefined && product?.experience?.rating?.average !== null
          ? String(product.experience.rating.average)
          : '',
      count:
        product?.experience?.rating?.count !== undefined && product?.experience?.rating?.count !== null
          ? String(product.experience.rating.count)
          : '',
    },
    reviews: (product?.experience?.reviews ?? []).map((review) => ({
      id: review.id ?? createClientId(),
      author: review.author ?? '',
      avatarUrl: review.avatarUrl ?? '',
      locale: (review.locale as Locale | undefined) ?? 'en',
      rating: typeof review.rating === 'number' ? review.rating : 5,
      timeAgo: review.timeAgo ?? '',
      comment: review.comment ?? '',
      source: (review.source as ReviewSource | undefined) ?? 'admin',
    })),
  };
};

const clampRating = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 5);
};

export function useProductFormState(product?: Product, lang: Locale = 'en') {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>(product?.images || []);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [experienceState, setExperienceState] = useState<ExperienceState>(() =>
    buildInitialExperienceState(product)
  );

  useEffect(() => {
    setExperienceState(buildInitialExperienceState(product));
    setExistingImages(product?.images || []);
    setIsFeatured(product?.is_featured ?? false);
  }, [product]);

  // Image management
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeExistingImage = useCallback((index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setFeaturedImage = useCallback((index: number) => {
    setExistingImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        isFeatured: i === index,
      }))
    );
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  // Experience state management
  const updateLocaleStringField = useCallback(
    (locale: Locale, field: keyof ExperienceLocaleState, value: string) => {
      setExperienceState((prev) => {
        const nextLocales = { ...prev.locales };
        const current = nextLocales[locale] ?? emptyLocaleState();

        nextLocales[locale] = {
          ...current,
          [field]: value,
        };

        return {
          ...prev,
          locales: nextLocales,
        };
      });
    },
    []
  );

  const updateLocaleListField = useCallback(
    (locale: Locale, field: keyof ExperienceLocaleState, value: string) => {
      setExperienceState((prev) => {
        const nextLocales = { ...prev.locales };
        const current = nextLocales[locale] ?? emptyLocaleState();

        nextLocales[locale] = {
          ...current,
          [field]: parseLines(value),
        };

        return {
          ...prev,
          locales: nextLocales,
        };
      });
    },
    []
  );

  const updateRatingField = useCallback((field: 'average' | 'count', value: string) => {
    setExperienceState((prev) => ({
      ...prev,
      rating: {
        ...prev.rating,
        [field]: value,
      },
    }));
  }, []);

  const handleAddReview = useCallback(() => {
    setExperienceState((prev) => ({
      ...prev,
      reviews: [
        ...prev.reviews,
        {
          id: createClientId(),
          author: '',
          avatarUrl: '',
          locale: lang,
          rating: 5,
          timeAgo: '',
          comment: '',
          source: 'admin',
        },
      ],
    }));
  }, [lang]);

  const handleReviewChange = useCallback(
    (index: number, field: keyof ReviewState, value: string | number | Locale | ReviewSource) => {
      setExperienceState((prev) => {
        if (!prev.reviews[index]) {
          return prev;
        }

        const reviews = [...prev.reviews];
        const current = { ...reviews[index] };

        switch (field) {
          case 'rating':
            current.rating = typeof value === 'number' ? value : Number(value);
            break;
          case 'locale':
            current.locale = value as Locale;
            break;
          case 'source':
            current.source = value as ReviewSource;
            break;
          case 'author':
          case 'avatarUrl':
          case 'timeAgo':
          case 'comment':
            current[field] = typeof value === 'string' ? value : String(value ?? '');
            break;
          default:
            break;
        }

        reviews[index] = current;
        return {
          ...prev,
          reviews,
        };
      });
    },
    []
  );

  const handleRemoveReview = useCallback((index: number) => {
    setExperienceState((prev) => ({
      ...prev,
      reviews: prev.reviews.filter((_, idx) => idx !== index),
    }));
  }, []);

  const buildExperiencePayload = useCallback(() => {
    const localePayload = supportedLocales.reduce((acc, locale) => {
      const current = experienceState.locales[locale] ?? emptyLocaleState();
      const normalized: Partial<ExperienceLocaleState> = {};

      if (current.tagline.trim()) {
        normalized.tagline = current.tagline.trim();
      }
      if (current.heroSupporting.trim()) {
        normalized.heroSupporting = current.heroSupporting.trim();
      }

      const normalizeList = (values: string[]) =>
        values.map((value) => value.trim()).filter((value) => value.length > 0);

      const quickHighlights = normalizeList(current.quickHighlights);
      if (quickHighlights.length > 0) {
        normalized.quickHighlights = quickHighlights;
      }

      const usage = normalizeList(current.usage);
      if (usage.length > 0) {
        normalized.usage = usage;
      }

      const ingredients = normalizeList(current.ingredients);
      if (ingredients.length > 0) {
        normalized.ingredients = ingredients;
      }

      const wellness = normalizeList(current.wellness);
      if (wellness.length > 0) {
        normalized.wellness = wellness;
      }

      const insights = normalizeList(current.insights);
      if (insights.length > 0) {
        normalized.insights = insights;
      }

      if (Object.keys(normalized).length > 0) {
        acc[locale] = normalized;
      }

      return acc;
    }, {} as Partial<Record<Locale, Partial<ExperienceLocaleState>>>);

    const averageValue = Number(experienceState.rating.average);
    const countValue = Number(experienceState.rating.count);

    const ratingPayload: { average?: number; count?: number } = {};

    if (experienceState.rating.average.trim()) {
      ratingPayload.average = Number(clampRating(averageValue).toFixed(2));
    }

    if (experienceState.rating.count.trim()) {
      ratingPayload.count = Math.max(0, Math.round(countValue));
    }

    const reviewsPayload = experienceState.reviews
      .filter((review) => review.author.trim().length > 0 && review.comment.trim().length > 0)
      .map((review) => {
        const sanitizedAvatar = review.avatarUrl.trim();
        const sanitizedTimeAgo = review.timeAgo.trim();

        return {
          id: review.id ?? createClientId(),
          author: review.author.trim(),
          avatarUrl: sanitizedAvatar.length > 0 ? sanitizedAvatar : undefined,
          locale: review.locale,
          rating: Number(clampRating(review.rating).toFixed(2)),
          timeAgo: sanitizedTimeAgo.length > 0 ? sanitizedTimeAgo : undefined,
          comment: review.comment.trim(),
          source: review.source ?? 'admin',
          createdAt: null,
        };
      });

    return {
      locales: localePayload,
      rating: ratingPayload,
      reviews: reviewsPayload,
      lastEditedBy: 'admin-console',
    };
  }, [experienceState]);

  return {
    // Image state
    selectedFiles,
    existingImages,
    handleFileSelect,
    removeFile,
    removeExistingImage,
    setFeaturedImage,
    clearFiles,

    // Featured state
    isFeatured,
    setIsFeatured,

    // Experience state
    experienceState,
    updateLocaleStringField,
    updateLocaleListField,
    updateRatingField,
    handleAddReview,
    handleReviewChange,
    handleRemoveReview,
    buildExperiencePayload,
  };
}
