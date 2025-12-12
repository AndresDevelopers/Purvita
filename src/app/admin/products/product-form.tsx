'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import type { Product, ProductDiscountType, ProductImage, DiscountVisibilitySite } from '@/lib/models/definitions';
import { ALL_DISCOUNT_VISIBILITY_SITES } from '@/lib/models/definitions';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadProductImages, createProduct, updateProduct } from '@/lib/services/product-service';
import { useToast } from '@/hooks/use-toast';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { PlusCircle, Trash2, Star } from 'lucide-react';
import Image from 'next/image';
import { ProductCountrySelector } from '@/modules/products/ui/product-country-selector';
import { RelatedProductsSelector } from '@/modules/products/ui/related-products-selector';

interface ProductFormProps {
  lang: Locale;
  product?: Product;
  onSuccess?: () => void;
}

const supportedLocales: readonly Locale[] = ['en', 'es'] as const;

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

interface ReviewState {
  id: string;
  user_id: string;
  author: string;
  avatarUrl: string;
  locale: Locale;
  rating: number;
  timeAgo: string;
  comment: string;
  source: ReviewSource;
  createdAt?: string;
};

interface ExperienceState {
  locales: Record<Locale, ExperienceLocaleState>;
  rating: {
    average: string;
    count: string;
  };
  reviews: ReviewState[];
}

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
      user_id: review.user_id,
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

export function ProductForm({ lang, product, onSuccess }: ProductFormProps) {
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const { toast } = useToast();
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>(product?.images || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [experienceState, setExperienceState] = useState<ExperienceState>(() => buildInitialExperienceState(product));
  const [discountType, setDiscountType] = useState<'amount' | 'percentage' | 'none'>(() => {
    if (product?.discount_type === 'amount' || product?.discount_type === 'percentage') {
      return product.discount_type;
    }
    return 'none';
  });
  const [discountValue, setDiscountValue] = useState(() => {
    if (typeof product?.discount_value === 'number' && Number.isFinite(product.discount_value)) {
      return product.discount_value.toString();
    }
    return '';
  });
  const [discountLabel, setDiscountLabel] = useState(product?.discount_label ?? '');
  const [discountVisibility, setDiscountVisibility] = useState<DiscountVisibilitySite[]>(
    () => product?.discount_visibility ?? [...ALL_DISCOUNT_VISIBILITY_SITES],
  );
  const [cartCountries, setCartCountries] = useState<string[]>(
    () => product?.cart_visibility_countries ?? [],
  );
  const [relatedProductIds, setRelatedProductIds] = useState<string[]>(
    () => product?.related_product_ids ?? [],
  );

  useEffect(() => {
    setExperienceState(buildInitialExperienceState(product));
    setExistingImages(product?.images || []);
    if (product?.discount_type === 'amount' || product?.discount_type === 'percentage') {
      setDiscountType(product.discount_type);
    } else {
      setDiscountType('none');
    }
    if (typeof product?.discount_value === 'number' && Number.isFinite(product.discount_value)) {
      setDiscountValue(product.discount_value.toString());
    } else {
      setDiscountValue('');
    }
    setDiscountLabel(product?.discount_label ?? '');
    setDiscountVisibility(product?.discount_visibility ?? [...ALL_DISCOUNT_VISIBILITY_SITES]);
    setCartCountries(product?.cart_visibility_countries ?? []);
    setRelatedProductIds(product?.related_product_ids ?? []);
  }, [product]);

  const handleDiscountTypeChange = (value: string) => {
    if (value === 'amount' || value === 'percentage') {
      setDiscountType(value);
      return;
    }

    setDiscountType('none');
    setDiscountValue('');
    setDiscountLabel('');
  };

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
    [],
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
    [],
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
          user_id: '',
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
    [],
  );

  const handleRemoveReview = useCallback((index: number) => {
    setExperienceState((prev) => ({
      ...prev,
      reviews: prev.reviews.filter((_, idx) => idx !== index),
    }));
  }, []);

  const buildExperiencePayload = useCallback(() => {
    const normalizedLocales = supportedLocales.reduce((acc, locale) => {
      const current = experienceState.locales[locale] ?? emptyLocaleState();
      const normalized: Partial<ExperienceLocaleState> = {};

      if (current.tagline.trim()) {
        normalized.tagline = current.tagline.trim();
      }
      if (current.heroSupporting.trim()) {
        normalized.heroSupporting = current.heroSupporting.trim();
      }

      const normalizeList = (values: string[]) => values.map((value) => value.trim()).filter((value) => value.length > 0);

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

      acc[locale] = normalized;

      return acc;
    }, {} as Record<Locale, Partial<ExperienceLocaleState>>);

    const hasAnyLocaleContent = supportedLocales.some((locale) => Object.keys(normalizedLocales[locale]).length > 0);

    const localePayload: Record<Locale, Partial<ExperienceLocaleState>> | undefined = hasAnyLocaleContent
      ? {
          en: normalizedLocales.en ?? {},
          es: normalizedLocales.es ?? {},
        }
      : undefined;

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
          user_id: review.user_id || '',
          author: review.author.trim(),
          avatarUrl: sanitizedAvatar.length > 0 ? sanitizedAvatar : undefined,
          locale: review.locale,
          rating: Number(clampRating(review.rating).toFixed(2)),
          timeAgo: sanitizedTimeAgo.length > 0 ? sanitizedTimeAgo : undefined,
          comment: review.comment.trim(),
          source: review.source ?? 'admin',
          createdAt: review.createdAt || new Date().toISOString(),
        };
      });

    return {
      locales: localePayload,
      rating: ratingPayload,
      reviews: reviewsPayload,
      lastEditedBy: 'admin-console',
    };
  }, [experienceState]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const setFeaturedImage = (index: number) => {
    setExistingImages(prev => prev.map((img, i) => ({
      ...img,
      isFeatured: i === index,
    })));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const name = formData.get('name') as string;
      const slug = formData.get('slug') as string;
      const description = formData.get('description') as string;
      const price = parseFloat(formData.get('price') as string);
      const stockQuantity = Math.max(0, Number.parseInt(formData.get('stock_quantity') as string, 10) || 0);
      const isFeaturedValue = formData.get('is_featured') === 'true';
      const rawDiscountType = (formData.get('discount_type') as string | null) ?? 'none';
      const normalizedDiscountType: ProductDiscountType | null =
        rawDiscountType === 'amount' || rawDiscountType === 'percentage' ? rawDiscountType : null;

      let resolvedDiscountValue: number | null = null;
      const rawDiscountValue = (formData.get('discount_value') as string | null) ?? '';
      if (normalizedDiscountType) {
        const parsedValue = Number.parseFloat(rawDiscountValue.replace(/,/g, '.'));
        if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
          throw new Error(dict.admin.productDiscountValidation ?? 'Provide a discount greater than zero.');
        }

        if (normalizedDiscountType === 'amount') {
          resolvedDiscountValue = Number(Math.min(price, Math.max(0, parsedValue)).toFixed(2));
        } else {
          resolvedDiscountValue = Number(Math.min(100, Math.max(0, parsedValue)).toFixed(2));
        }
      }

      const rawDiscountLabel = ((formData.get('discount_label') as string | null) ?? '').trim();
      const resolvedDiscountLabel = normalizedDiscountType && rawDiscountLabel.length > 0 ? rawDiscountLabel : null;

      // Generate ID for new product
      const id = product?.id || createClientId();

      // Start with existing images (which may have been filtered by user)
      let images: ProductImage[] = [...existingImages];

      // Upload new images if any
      if (selectedFiles.length > 0) {
        const uploadedImages = await uploadProductImages(selectedFiles, id);
        images = [...images, ...uploadedImages];
      }

      // Ensure at least one image is featured (default to first if none selected)
      if (images.length > 0) {
        const hasFeatured = images.some(img => img.isFeatured);
        if (!hasFeatured) {
          images[0] = { ...images[0], isFeatured: true };
        }
      }

      const experiencePayload = buildExperiencePayload();

      const productDraft: Omit<Product, 'id'> = {
        slug,
        name,
        description,
        price,
        discount_type: normalizedDiscountType,
        discount_value: resolvedDiscountValue,
        discount_label: resolvedDiscountLabel,
        discount_visibility: normalizedDiscountType ? discountVisibility : [...ALL_DISCOUNT_VISIBILITY_SITES],
        stock_quantity: stockQuantity,
        images,
        is_featured: isFeaturedValue,
        cart_visibility_countries: Array.from(
          new Set(cartCountries.map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code))),
        ),
        related_product_ids: Array.from(
          new Set(relatedProductIds.map((id) => id.trim()).filter((id) => id.length > 0)),
        ),
        experience: experiencePayload,
      };

      if (product) {
        await updateProduct(product.id, productDraft);
        toast({
          title: 'Producto actualizado',
          description: 'El producto se ha actualizado correctamente.',
        });
      } else {
        await createProduct({ ...productDraft, id });
        toast({
          title: 'Producto creado',
          description: 'El producto se ha creado correctamente.',
        });
      }

      // Reset form
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      (event.target as HTMLFormElement).reset();

      onSuccess?.();

      // Navigate back to products list
      router.push(`/admin/products?lang=${lang}`);
    } catch (error) {
      console.error('Error saving product:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Hubo un error al guardar el producto.';

      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/admin/products?lang=${lang}`);
  };

  const discountValuePlaceholder =
    discountType === 'percentage'
      ? dict.admin.productDiscountValuePlaceholderPercent ?? '15'
      : dict.admin.productDiscountValuePlaceholderAmount ?? '10.00';
  const isDiscountActive = discountType !== 'none';

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">{dict.admin.productName}</Label>
          <Input
            id="name"
            name="name"
            defaultValue={product?.name}
            placeholder="Quantum Elixir"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">{dict.admin.productSlug}</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={product?.slug}
            placeholder="quantum-elixir"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">{dict.admin.productDescription}</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={product?.description}
          placeholder={dict.admin.productDescriptionPlaceholder}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">{(dict.admin as any).price ?? 'Price'}</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            defaultValue={product?.price}
            placeholder="99.99"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock_quantity">{(dict.admin as any).stockQuantity ?? 'Stock Quantity'}</Label>
          <Input
            id="stock_quantity"
            name="stock_quantity"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={product?.stock_quantity ?? 0}
            placeholder="120"
            required
          />
        </div>
      </div>

      <ProductCountrySelector
        selected={cartCountries}
        onChange={setCartCountries}
        locale={lang}
        copy={{
          sectionTitle: dict.admin.productCountrySectionTitle ?? 'Purchase availability',
          sectionDescription:
            dict.admin.productCountrySectionDescription ??
            'Choose the countries where the add to cart button should be available.',
          manageButton: dict.admin.productCountryManageButton ?? 'Manage countries',
          dialogTitle: dict.admin.productCountryDialogTitle ?? 'Select eligible countries',
          dialogDescription:
            dict.admin.productCountryDialogDescription ??
            'Members outside of the selected countries will not see purchase actions.',
          searchPlaceholder: dict.admin.productCountrySearchPlaceholder ?? 'Search country…',
          noResults: dict.admin.productCountryNoResults ?? 'No countries match your search.',
          helper:
            dict.admin.productCountryHelper ??
            'Select at least one country to enable cart visibility.',
          emptySummary:
            dict.admin.productCountryEmptySummary ??
            'Cart access is disabled for every country.',
          summaryTemplate:
            dict.admin.productCountrySummaryTemplate ??
            '{{count}} countries can access the cart.',
          badgeA11y: dict.admin.productCountryBadgeA11y,
          clearAction: dict.admin.productCountryClear ?? 'Clear selection',
          closeAction: dict.admin.productCountryClose ?? 'Done',
        }}
      />

      <RelatedProductsSelector
        currentProductId={product?.id}
        selected={relatedProductIds}
        onChange={setRelatedProductIds}
        copy={{
          sectionTitle: 'Productos relacionados',
          sectionDescription: 'Selecciona los productos que se mostrarán como relacionados en la página de detalles.',
          manageButton: 'Gestionar productos',
          dialogTitle: 'Seleccionar productos relacionados',
          dialogDescription: 'Elige los productos que quieres mostrar como relacionados. Solo se mostrarán si están disponibles en el país del usuario.',
          searchPlaceholder: 'Buscar producto...',
          noResults: 'No se encontraron productos.',
          emptySummary: 'No hay productos relacionados seleccionados.',
          summaryTemplate: '{{count}} productos relacionados seleccionados.',
          clearAction: 'Limpiar selección',
          closeAction: 'Cerrar',
        }}
      />

      <div className="space-y-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold">{dict.admin.productDiscountSectionTitle}</h3>
          <p className="text-sm text-muted-foreground">{dict.admin.productDiscountSectionDescription}</p>
        </div>

        <input type="hidden" name="discount_type" value={discountType} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="discount_type_select">{dict.admin.productDiscountTypeLabel}</Label>
            <Select value={discountType} onValueChange={handleDiscountTypeChange}>
              <SelectTrigger id="discount_type_select">
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

          <div className="space-y-2">
            <Label htmlFor="discount_value">{dict.admin.productDiscountValueLabel}</Label>
            <Input
              id="discount_value"
              name="discount_value"
              type="number"
              step={discountType === 'percentage' ? '0.1' : '0.01'}
              min={0}
              max={discountType === 'percentage' ? 100 : undefined}
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              placeholder={discountValuePlaceholder}
              disabled={!isDiscountActive || isSubmitting}
            />
            <p className="text-xs text-muted-foreground">{dict.admin.productDiscountValueHint}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="discount_label">{dict.admin.productDiscountLabel}</Label>
          <Input
            id="discount_label"
            name="discount_label"
            value={discountLabel}
            onChange={(event) => setDiscountLabel(event.target.value)}
            placeholder={dict.admin.productDiscountLabelPlaceholder}
            disabled={!isDiscountActive || isSubmitting}
          />
          <p className="text-xs text-muted-foreground">{dict.admin.productDiscountInlineHint}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{dict.admin.productDiscountVisibilityLabel ?? 'Discount visibility'}</Label>
            <p className="text-xs text-muted-foreground">
              {dict.admin.productDiscountVisibilityHint ?? 'Select where this discount should be visible and applied.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="visibility-main"
                checked={discountVisibility.includes('main_store')}
                onCheckedChange={(checked) => {
                  setDiscountVisibility((prev) =>
                    checked
                      ? [...prev, 'main_store']
                      : prev.filter((site) => site !== 'main_store')
                  );
                }}
                disabled={!isDiscountActive || isSubmitting}
              />
              <Label htmlFor="visibility-main" className="text-sm font-normal cursor-pointer">
                {dict.admin.productDiscountVisibilityMainStore ?? 'Main store'}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="visibility-affiliate"
                checked={discountVisibility.includes('affiliate_store')}
                onCheckedChange={(checked) => {
                  setDiscountVisibility((prev) =>
                    checked
                      ? [...prev, 'affiliate_store']
                      : prev.filter((site) => site !== 'affiliate_store')
                  );
                }}
                disabled={!isDiscountActive || isSubmitting}
              />
              <Label htmlFor="visibility-affiliate" className="text-sm font-normal cursor-pointer">
                {dict.admin.productDiscountVisibilityAffiliateStore ?? 'Affiliate store'}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="visibility-mlm"
                checked={discountVisibility.includes('mlm_store')}
                onCheckedChange={(checked) => {
                  setDiscountVisibility((prev) =>
                    checked
                      ? [...prev, 'mlm_store']
                      : prev.filter((site) => site !== 'mlm_store')
                  );
                }}
                disabled={!isDiscountActive || isSubmitting}
              />
              <Label htmlFor="visibility-mlm" className="text-sm font-normal cursor-pointer">
                {dict.admin.productDiscountVisibilityMlmStore ?? 'MLM store'}
              </Label>
            </div>
          </div>
          {isDiscountActive && discountVisibility.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {dict.admin.productDiscountVisibilityWarning ?? 'Select at least one store to apply the discount.'}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor="is_featured" className="font-medium">{(dict.admin as any).productFeatured ?? 'Featured Product'}</Label>
          <p className="text-sm text-muted-foreground">{(dict.admin as any).productFeaturedDescription ?? 'Show this product prominently'}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="hidden" name="is_featured" value={isFeatured ? 'true' : 'false'} />
          <Switch
            id="is_featured"
            checked={isFeatured}
            onCheckedChange={(checked) => {
              setIsFeatured(checked);
            }}
          />
          <span className="text-sm font-medium">{isFeatured ? dict.admin.featuredYes : dict.admin.featuredNo}</span>
        </div>
      </div>

      {/* Images Section */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label className="text-base font-semibold">Imágenes del producto</Label>
          <p className="text-sm text-muted-foreground">
            {product ? 'Agrega nuevas imágenes o visualiza las existentes. Las nuevas imágenes se agregarán al guardar.' : 'Selecciona las imágenes para el producto.'}
          </p>
        </div>

        {/* Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="flex-1"
            />
            {selectedFiles.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFiles([]);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Limpiar
              </Button>
            )}
          </div>

          {/* Preview of selected files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-green-700 dark:text-green-400">
                  Nuevas imágenes ({selectedFiles.length})
                </Label>
                <span className="text-xs text-muted-foreground">Se agregarán al guardar</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="group relative aspect-square rounded-lg border-2 border-green-200 dark:border-green-800 overflow-hidden bg-green-50 dark:bg-green-950/20">
                    <Image
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      width={300}
                      height={300}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">{file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Existing images */}
        {existingImages.length > 0 && (
          <div className="space-y-2 pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  Imágenes actuales ({existingImages.length})
                </Label>
                <p className="text-xs text-muted-foreground">
                  Click en la estrella para marcar como imagen principal
                </p>
              </div>
              {product && existingImages.length !== product.images.length && (
                <span className="text-xs text-orange-600 dark:text-orange-400">
                  {product.images.length - existingImages.length} eliminada(s)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {existingImages.map((image, index) => (
                <div 
                  key={`${image.id}-${index}`} 
                  className={`group relative aspect-square rounded-lg border-2 overflow-hidden bg-muted transition-all ${
                    image.isFeatured 
                      ? 'border-yellow-400 dark:border-yellow-500 ring-2 ring-yellow-400/50' 
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={image.hint || `Imagen ${index + 1}`}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                  
                  {/* Featured badge */}
                  {image.isFeatured && (
                    <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg">
                      <Star className="h-3 w-3 fill-white" />
                      Principal
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant={image.isFeatured ? "default" : "secondary"}
                      size="icon"
                      className={`h-7 w-7 ${image.isFeatured ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}
                      onClick={() => setFeaturedImage(index)}
                      title="Marcar como imagen principal"
                    >
                      <Star className={`h-4 w-4 ${image.isFeatured ? 'fill-white' : ''}`} />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeExistingImage(index)}
                      title="Eliminar imagen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {image.hint && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">{image.hint}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!product?.images?.length && selectedFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
            <PlusCircle className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No hay imágenes seleccionadas</p>
            <p className="text-xs text-muted-foreground mt-1">Selecciona archivos para comenzar</p>
          </div>
        )}
      </div>

      <div className="space-y-6 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="space-y-2">
          <h3 className="font-headline text-lg font-semibold text-emerald-900 dark:text-emerald-100">
            {(dict.admin as any).productExperienceTitle ?? 'Product Experience'}
          </h3>
          <p className="text-sm text-muted-foreground dark:text-emerald-200/80">
            {(dict.admin as any).productExperienceDescription ?? 'Configure the product experience details'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {(dict.admin as any).productExperienceLocaleHeading ?? 'Localized Content'}
            </h4>
            <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
              {(dict.admin as any).productExperienceLocaleDescription ?? 'Configure content for each language'}
            </p>
          </div>
          <Tabs defaultValue={lang} className="w-full">
            <TabsList className="flex w-fit flex-wrap gap-2 bg-transparent p-0">
              {supportedLocales.map((locale) => (
                <TabsTrigger
                  key={locale}
                  value={locale}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition-colors data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:bg-emerald-900/40 dark:text-emerald-200"
                >
                  {locale === 'en' ? ((dict.admin as any).languageEnglish ?? 'English') : ((dict.admin as any).languageSpanish ?? 'Spanish')}
                </TabsTrigger>
              ))}
            </TabsList>
            {supportedLocales.map((locale) => {
              const localeState = experienceState.locales[locale];
              return (
                <TabsContent
                  key={locale}
                  value={locale}
                  className="mt-4 space-y-4 rounded-lg border bg-white/80 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/50"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`${locale}-tagline`}>{(dict.admin as any).productExperienceTagline ?? 'Tagline'}</Label>
                    <Input
                      id={`${locale}-tagline`}
                      value={localeState?.tagline ?? ''}
                      onChange={(event) => updateLocaleStringField(locale, 'tagline', event.target.value)}
                      placeholder={(dict.admin as any).productExperienceTaglinePlaceholder ?? 'Enter tagline'}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${locale}-hero`}>{(dict.admin as any).productExperienceHeroSupporting ?? 'Hero Supporting Text'}</Label>
                    <Textarea
                      id={`${locale}-hero`}
                      value={localeState?.heroSupporting ?? ''}
                      onChange={(event) => updateLocaleStringField(locale, 'heroSupporting', event.target.value)}
                      placeholder={(dict.admin as any).productExperienceHeroSupportingPlaceholder ?? 'Enter hero supporting text'}
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${locale}-highlights`}>{(dict.admin as any).productExperienceHighlights ?? 'Quick Highlights'}</Label>
                      <Textarea
                        id={`${locale}-highlights`}
                        value={(localeState?.quickHighlights ?? []).join('\n')}
                        onChange={(event) => updateLocaleListField(locale, 'quickHighlights', event.target.value)}
                        placeholder={(dict.admin as any).productExperienceHighlightsPlaceholder ?? 'Enter highlights'}
                        rows={4}
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
                        {(dict.admin as any).productExperienceListHelper ?? 'One item per line'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${locale}-usage`}>{(dict.admin as any).productExperienceUsage ?? 'Usage'}</Label>
                      <Textarea
                        id={`${locale}-usage`}
                        value={(localeState?.usage ?? []).join('\n')}
                        onChange={(event) => updateLocaleListField(locale, 'usage', event.target.value)}
                        placeholder={(dict.admin as any).productExperienceUsagePlaceholder ?? 'Enter usage instructions'}
                        rows={4}
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
                        {(dict.admin as any).productExperienceListHelper ?? 'One item per line'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${locale}-insights`}>{(dict.admin as any).productExperienceInsights ?? 'Insights'}</Label>
                      <Textarea
                        id={`${locale}-insights`}
                        value={(localeState?.insights ?? []).join('\n')}
                        onChange={(event) => updateLocaleListField(locale, 'insights', event.target.value)}
                        placeholder={(dict.admin as any).productExperienceInsightsPlaceholder ?? 'Enter insights'}
                        rows={4}
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
                        {(dict.admin as any).productExperienceListHelper ?? 'One item per line'}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="experience-rating-average">{(dict.admin as any).productExperienceRatingAverage ?? 'Average Rating'}</Label>
            <Input
              id="experience-rating-average"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={experienceState.rating.average}
              onChange={(event) => updateRatingField('average', event.target.value)}
              placeholder="4.9"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
              {(dict.admin as any).productExperienceRatingHelper ?? 'Rating from 0 to 5'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="experience-rating-count">{(dict.admin as any).productExperienceRatingCount ?? 'Rating Count'}</Label>
            <Input
              id="experience-rating-count"
              type="number"
              min={0}
              step={1}
              value={experienceState.rating.count}
              onChange={(event) => updateRatingField('count', event.target.value)}
              placeholder="128"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {(dict.admin as any).productExperienceReviewsTitle ?? 'Reviews'}
            </h4>
            <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
              {(dict.admin as any).productExperienceReviewsDescription ?? 'Manage product reviews'}
            </p>
          </div>

          {experienceState.reviews.length === 0 ? (
            <p className="rounded-lg border border-dashed border-emerald-200 bg-white/60 p-4 text-sm text-muted-foreground dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200/80">
              {(dict.admin as any).productExperienceReviewEmpty ?? 'No reviews yet'}
            </p>
          ) : (
            <div className="space-y-4">
              {experienceState.reviews.map((review, index) => (
                <div
                  key={review.id}
                  className="space-y-4 rounded-lg border bg-white/80 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/50"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="grid flex-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`review-author-${review.id}`}>
                          {(dict.admin as any).productExperienceReviewAuthor ?? 'Author'}
                        </Label>
                        <Input
                          id={`review-author-${review.id}`}
                          value={review.author}
                          onChange={(event) => handleReviewChange(index, 'author', event.target.value)}
                          placeholder="Alex Rivera"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`review-avatar-${review.id}`}>
                          {(dict.admin as any).productExperienceReviewAvatar ?? 'Avatar URL'}
                        </Label>
                        <Input
                          id={`review-avatar-${review.id}`}
                          value={review.avatarUrl}
                          onChange={(event) => handleReviewChange(index, 'avatarUrl', event.target.value)}
                          placeholder="https://cdn.purvita.com/reviews/alex.jpg"
                          disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
                          {(dict.admin as any).productExperienceReviewAvatarHint ?? 'URL to author avatar image'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>{(dict.admin as any).productExperienceReviewLocale ?? 'Locale'}</Label>
                        <Select
                          value={review.locale}
                          onValueChange={(value) => handleReviewChange(index, 'locale', value as Locale)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={(dict.admin as any).productExperienceReviewLocale ?? 'Select locale'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">{(dict.admin as any).languageEnglish ?? 'English'}</SelectItem>
                            <SelectItem value="es">{(dict.admin as any).languageSpanish ?? 'Spanish'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`review-rating-${review.id}`}>
                          {(dict.admin as any).productExperienceReviewRating ?? 'Rating'}
                        </Label>
                        <Input
                          id={`review-rating-${review.id}`}
                          type="number"
                          min={0}
                          max={5}
                          step={0.1}
                          value={review.rating}
                          onChange={(event) => handleReviewChange(index, 'rating', Number(event.target.value))}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`review-timeago-${review.id}`}>
                          {(dict.admin as any).productExperienceReviewTimeAgo ?? 'Time Ago'}
                        </Label>
                        <Input
                          id={`review-timeago-${review.id}`}
                          value={review.timeAgo}
                          onChange={(event) => handleReviewChange(index, 'timeAgo', event.target.value)}
                          placeholder={(dict.admin as any).productExperienceReviewTimeAgoPlaceholder ?? 'e.g., 2 weeks ago'}
                          disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground dark:text-emerald-200/70">
                          {(dict.admin as any).productExperienceReviewTimeAgoHint ?? 'How long ago the review was posted'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>{(dict.admin as any).productExperienceReviewSource ?? 'Source'}</Label>
                        <Select
                          value={review.source}
                          onValueChange={(value) => handleReviewChange(index, 'source', value as ReviewSource)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{(dict.admin as any).productExperienceReviewSourceAdmin ?? 'Admin'}</SelectItem>
                            <SelectItem value="member">{(dict.admin as any).productExperienceReviewSourceMember ?? 'Member'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleRemoveReview(index)}
                      className="self-start text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {(dict.admin as any).productExperienceReviewRemove ?? 'Remove Review'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`review-comment-${review.id}`}>
                      {(dict.admin as any).productExperienceReviewComment ?? 'Comment'}
                    </Label>
                    <Textarea
                      id={`review-comment-${review.id}`}
                      value={review.comment}
                      onChange={(event) => handleReviewChange(index, 'comment', event.target.value)}
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleAddReview}
            className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800 dark:text-emerald-200"
            disabled={isSubmitting}
          >
            <PlusCircle className="h-4 w-4" />
            {(dict.admin as any).productExperienceReviewAdd ?? 'Add Review'}
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={handleCancel} disabled={isSubmitting}>
          {dict.admin.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : ((dict.admin as any).saveProduct ?? 'Save Product')}
        </Button>
      </div>
    </form>
  );
}
