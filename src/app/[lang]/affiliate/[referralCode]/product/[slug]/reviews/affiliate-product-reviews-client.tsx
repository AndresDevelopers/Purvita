'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/i18n/config';
import type { Product } from '@/lib/models/definitions';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import type { ProductReviewDisplay } from '@/modules/products/types/product-review';
import { computeRelativeTimeAgo, normalizeMemberReviewResponse } from '@/modules/products/utils/review-utils';
import { resolveProductCopy } from '@/app/[lang]/products/[slug]/product-detail-client';
import { Star, ArrowLeft, Pencil, Trash2, X, Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const STAR_COUNT = 5;

const formatTemplate = (template: string | undefined, value: string): string | undefined => {
  if (!template) {
    return undefined;
  }

  if (!template.includes('{{count}}')) {
    return template;
  }

  return template.replace('{{count}}', value);
};

interface AffiliateProductReviewsClientProps {
  product: Product;
  lang: Locale;
  referralCode: string;
}

const mapCuratedReviews = (
  reviews: ProductReviewDisplay[],
  lang: Locale,
): ProductReviewDisplay[] => {
  return reviews.map((review) => {
    const createdAt = review.createdAt ?? null;
    return {
      ...review,
      createdAt,
      timeAgo: review.timeAgo ?? computeRelativeTimeAgo(createdAt, lang),
    } satisfies ProductReviewDisplay;
  });
};

const sortReviews = (reviews: ProductReviewDisplay[]): ProductReviewDisplay[] => {
  const entries = reviews.map((review, index) => {
    const timestamp = review.createdAt ? Date.parse(review.createdAt) : Number.NaN;
    return {
      review,
      index,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
    };
  });

  entries.sort((a, b) => {
    if (a.timestamp !== null && b.timestamp !== null) {
      return b.timestamp - a.timestamp;
    }
    if (a.timestamp !== null) {
      return -1;
    }
    if (b.timestamp !== null) {
      return 1;
    }
    return a.index - b.index;
  });

  const seen = new Set<string>();
  const result: ProductReviewDisplay[] = [];

  for (const entry of entries) {
    if (seen.has(entry.review.id)) {
      continue;
    }
    seen.add(entry.review.id);
    result.push(entry.review);
  }

  return result;
};

export default function AffiliateProductReviewsClient({ product, lang, referralCode }: AffiliateProductReviewsClientProps) {
  const dict = useAppDictionary();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useSupabaseUser();

  const copy = useMemo(() => resolveProductCopy(dict, product, lang), [dict, product, lang]);
  const curatedReviews = useMemo(() => mapCuratedReviews([...copy.reviews], lang), [copy.reviews, lang]);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US'),
    [lang],
  );

  const [memberReviews, setMemberReviews] = useState<ProductReviewDisplay[]>([]);
  const [isLoadingMemberReviews, setIsLoadingMemberReviews] = useState(true);
  const [comment, setComment] = useState('');
  const [ratingInput, setRatingInput] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');

  // Edit/Delete state
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editRating, setEditRating] = useState<number>(0);
  const [editHoveredRating, setEditHoveredRating] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // ✅ SECURITY: Fetch CSRF token on component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        setCsrfToken(data.token);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    };
    fetchCsrfToken();
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadReviews = async () => {
      try {
        setIsLoadingMemberReviews(true);
        const response = await fetch(`/api/products/${product.slug}/reviews`, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Failed to fetch reviews: ${response.status}`);
        }

        const payload = await response.json();
        if (!isActive) {
          return;
        }

        const reviews = Array.isArray(payload?.reviews) ? payload.reviews : [];
        const normalized = reviews
          .map((entry: unknown) => normalizeMemberReviewResponse(entry, lang))
          .filter(
            (review: ProductReviewDisplay | null | undefined): review is ProductReviewDisplay => Boolean(review),
          );

        setMemberReviews(normalized);
      } catch (error) {
        if (isActive) {
          console.error('Failed to load member reviews', error);
          setMemberReviews([]);
        }
      } finally {
        if (isActive) {
          setIsLoadingMemberReviews(false);
        }
      }
    };

    loadReviews();

    return () => {
      isActive = false;
    };
  }, [lang, product.slug]);

  const memberReviewStats = useMemo(() => {
    if (memberReviews.length === 0) {
      return { count: 0, sum: 0 };
    }

    return memberReviews.reduce<{ count: number; sum: number }>(
      (acc: { count: number; sum: number }, review: ProductReviewDisplay) => {
        if (typeof review.rating === 'number' && Number.isFinite(review.rating) && review.rating > 0) {
          acc.count += 1;
          acc.sum += review.rating;
        }
        return acc;
      },
      { count: 0, sum: 0 },
    );
  }, [memberReviews]);

  const aggregatedRating = useMemo(() => {
    const baseAverage =
      typeof copy.rating.average === 'number' && !Number.isNaN(copy.rating.average)
        ? copy.rating.average
        : 0;
    const baseCount = Math.max(copy.rating.count ?? 0, 0);

    const totalCount = baseCount + memberReviewStats.count;

    if (totalCount === 0) {
      return {
        average: Math.min(Math.max(baseAverage, 0), 5),
        count: 0,
      };
    }

    const weightedSum = baseAverage * baseCount + memberReviewStats.sum;
    const average = weightedSum / totalCount;

    return {
      average: Number.isFinite(average) ? Math.min(Math.max(average, 0), 5) : 0,
      count: totalCount,
    };
  }, [copy.rating.average, copy.rating.count, memberReviewStats]);

  const ratingValue = useMemo(() => aggregatedRating.average, [aggregatedRating.average]);

  const ratingSummary = useMemo(() => {
    const summaryTemplate = dict.productDetails?.ratingSummaryLabel;
    if (summaryTemplate) {
      return summaryTemplate.replace('{{rating}}', ratingValue.toFixed(1));
    }

    return `${ratingValue.toFixed(1)} / 5`;
  }, [dict.productDetails?.ratingSummaryLabel, ratingValue]);

  const ratingCount = useMemo(() => {
    const formatted = numberFormatter.format(Math.max(aggregatedRating.count ?? 0, 0));
    return formatTemplate(dict.productDetails?.ratingCountLabel, formatted) ?? formatted;
  }, [aggregatedRating.count, dict.productDetails?.ratingCountLabel, numberFormatter]);

  const combinedReviews = useMemo(() => sortReviews([...memberReviews, ...curatedReviews]), [curatedReviews, memberReviews]);

  const showReviewSkeleton = isLoadingMemberReviews && combinedReviews.length === 0;
  const hasReviews = combinedReviews.length > 0;

  const isFormDisabled = (
    isLoading ||
    !isAuthenticated ||
    isSubmitting ||
    comment.trim().length < 10 ||
    ratingInput < 1 ||
    ratingInput > STAR_COUNT
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!isAuthenticated || isFormDisabled) {
        return;
      }

      try {
        setIsSubmitting(true);
        const response = await fetch(`/api/products/${product.slug}/reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({ rating: ratingInput, comment: comment.trim() }),
        });

        const payload = await response.json();

        if (!response.ok) {
          // Handle duplicate review error (409 Conflict)
          if (response.status === 409) {
            toast({
              variant: 'destructive',
              title: lang === 'es' ? 'Ya tienes una reseña' : 'You already have a review',
              description: lang === 'es' 
                ? 'Ya has dejado una reseña para este producto. Puedes editarla en la lista de abajo.'
                : 'You have already reviewed this product. You can edit your existing review below.',
            });
            return;
          }
          throw new Error(payload?.error || `Failed to submit review: ${response.status}`);
        }
        const normalized = normalizeMemberReviewResponse(payload?.review, lang);

        if (normalized) {
          setMemberReviews((previous) => sortReviews([normalized, ...previous]));
        }

        setComment('');
        setRatingInput(0);
        setHoveredRating(null);
        toast({
          title: dict.productDetails?.reviewFormSuccessTitle ?? '¡Gracias por tu reseña!',
          description:
            dict.productDetails?.reviewFormSuccessDescription ?? 'Tu opinión ayuda a otros compradores.',
        });
      } catch (error) {
        console.error('Failed to submit review', error);
        toast({
          variant: 'destructive',
          title: dict.productDetails?.reviewFormErrorTitle ?? 'No se pudo enviar la reseña',
          description:
            dict.productDetails?.reviewFormErrorDescription ?? 'Por favor intenta de nuevo en unos momentos.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [comment, csrfToken, dict.productDetails, isAuthenticated, isFormDisabled, lang, product.slug, ratingInput, toast],
  );

  const startEditing = useCallback((review: ProductReviewDisplay) => {
    setEditingReviewId(review.id);
    setEditComment(review.comment);
    setEditRating(review.rating);
    setEditHoveredRating(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingReviewId(null);
    setEditComment('');
    setEditRating(0);
    setEditHoveredRating(null);
  }, []);

  const handleUpdate = useCallback(
    async (reviewId: string) => {
      if (!isAuthenticated || editComment.trim().length < 10 || editRating < 1) {
        return;
      }

      try {
        setIsUpdating(true);
        const response = await fetch(`/api/products/${product.slug}/reviews/${reviewId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({ rating: editRating, comment: editComment.trim() }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update review: ${response.status}`);
        }

        const payload = await response.json();
        const normalized = normalizeMemberReviewResponse(payload?.review, lang);

        if (normalized) {
          setMemberReviews((previous) =>
            previous.map((r) => (r.id === reviewId ? normalized : r))
          );
        }

        cancelEditing();
        toast({
          title: lang === 'es' ? 'Reseña actualizada' : 'Review updated',
          description: lang === 'es' ? 'Tu reseña ha sido actualizada.' : 'Your review has been updated.',
        });
      } catch (error) {
        console.error('Failed to update review', error);
        toast({
          variant: 'destructive',
          title: lang === 'es' ? 'No se pudo actualizar la reseña' : 'Unable to update review',
          description: lang === 'es' ? 'Por favor intenta de nuevo.' : 'Please try again.',
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [cancelEditing, csrfToken, editComment, editRating, isAuthenticated, lang, product.slug, toast],
  );

  const handleDelete = useCallback(
    async (reviewId: string) => {
      if (!isAuthenticated) {
        return;
      }

      try {
        setIsDeleting(reviewId);
        const response = await fetch(`/api/products/${product.slug}/reviews/${reviewId}`, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to delete review: ${response.status}`);
        }

        setMemberReviews((previous) => previous.filter((r) => r.id !== reviewId));
        toast({
          title: lang === 'es' ? 'Reseña eliminada' : 'Review deleted',
          description: lang === 'es' ? 'Tu reseña ha sido eliminada.' : 'Your review has been removed.',
        });
      } catch (error) {
        console.error('Failed to delete review', error);
        toast({
          variant: 'destructive',
          title: lang === 'es' ? 'No se pudo eliminar la reseña' : 'Unable to delete review',
          description: lang === 'es' ? 'Por favor intenta de nuevo.' : 'Please try again.',
        });
      } finally {
        setIsDeleting(null);
      }
    },
    [csrfToken, isAuthenticated, lang, product.slug, toast],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-emerald-500">
            {dict.productDetails?.ratingTitle ?? 'Reseñas de clientes'}
          </p>
          <h1 className="font-headline text-3xl font-bold text-emerald-900 dark:text-emerald-100">
            {product.name}
          </h1>
          <p className="text-sm text-muted-foreground dark:text-emerald-200/80">{ratingCount}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/${lang}/affiliate/${referralCode}/product/${product.slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {dict.productDetails?.reviewBackToProduct ?? 'Volver al producto'}
          </Link>
        </Button>
      </div>

      <Card className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
              {ratingSummary}
            </CardTitle>
            {dict.productDetails?.ratingDescription ? (
              <p className="text-sm text-muted-foreground dark:text-emerald-200/80">
                {dict.productDetails.ratingDescription}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: STAR_COUNT }).map((_, index) => (
              <Star
                key={index}
                className={`h-6 w-6 ${index + 1 <= ratingValue ? 'fill-emerald-500 text-emerald-500' : 'text-emerald-200 dark:text-emerald-800'}`}
              />
            ))}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-10 pt-6">
          {/* Review Form Section */}
          <section className="space-y-6">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                {dict.productDetails?.reviewFormTitle ?? 'Comparte tu experiencia'}
              </h2>
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground dark:text-emerald-200/80">
                  {dict.productDetails?.reviewFormAuthPrompt ?? 'Inicia sesión para dejar una reseña.'}{' '}
                  <Link
                    href={`/${lang}/auth/login`}
                    className="font-medium text-emerald-600 hover:underline dark:text-emerald-200"
                  >
                    {dict.productDetails?.reviewFormAuthCta ?? 'Iniciar sesión'}
                  </Link>
                </p>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" data-disabled={isFormDisabled}>
              <div className="space-y-2">
                <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  {dict.productDetails?.reviewFormRatingLabel ?? 'Tu calificación'}
                </span>

                <div className="flex items-center gap-2">
                  {Array.from({ length: STAR_COUNT }).map((_, index) => {
                    const value = index + 1;
                    const isActive = value <= (hoveredRating ?? ratingInput);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRatingInput(value)}
                        onMouseEnter={() => setHoveredRating(value)}
                        onMouseLeave={() => setHoveredRating(null)}
                        onFocus={() => setHoveredRating(value)}
                        onBlur={() => setHoveredRating(null)}
                        className={`rounded-full p-1 transition ${isActive ? 'text-emerald-500' : 'text-emerald-200 dark:text-emerald-800 hover:text-emerald-400'}`}
                        aria-label={`Calificar ${value} estrella${value === 1 ? '' : 's'}${value === ratingInput ? ' (seleccionada)' : ''}`}
                        disabled={!isAuthenticated}
                      >
                        <Star className={`h-6 w-6 ${isActive ? 'fill-emerald-500 text-emerald-500' : 'text-inherit'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-emerald-900 dark:text-emerald-100" htmlFor="review-comment">
                  {dict.productDetails?.reviewFormCommentLabel ?? 'Tu reseña'}
                </label>
                <Textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={
                    dict.productDetails?.reviewFormCommentPlaceholder ??
                    'Cuéntanos sobre tu experiencia con este producto...'
                  }
                  className="min-h-[120px] resize-vertical"
                  disabled={!isAuthenticated || isSubmitting}
                  required
                />
                <p className="text-xs text-muted-foreground dark:text-emerald-200/80">
                  {dict.productDetails?.reviewFormCommentHint ?? 'Mínimo 10 caracteres.'}
                </p>
              </div>

              <Button type="submit" disabled={isFormDisabled} className="gap-2">
                {isSubmitting
                  ? dict.productDetails?.reviewFormSubmitting ?? 'Enviando reseña...'
                  : dict.productDetails?.reviewFormSubmit ?? 'Enviar reseña'}
              </Button>
            </form>
          </section>

          {/* Reviews List Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
                {dict.productDetails?.reviewListTitle ?? 'Reseñas recientes'}
              </h2>
              <p className="text-sm text-muted-foreground dark:text-emerald-200/80">
                {dict.productDetails?.reviewListCountLabel
                  ? dict.productDetails.reviewListCountLabel.replace('{{count}}', String(combinedReviews.length))
                  : `${combinedReviews.length} ${combinedReviews.length === 1 ? 'reseña' : 'reseñas'}`}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {hasReviews ? (
                combinedReviews.map((review) => {
                  const isOwner = user?.id && review.userId === user.id;
                  const isEditing = editingReviewId === review.id;

                  return (
                    <Card
                      key={review.id}
                      className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50"
                    >
                      <CardHeader className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border border-emerald-100 bg-white dark:border-emerald-900/60 dark:bg-emerald-900/40">
                              {review.avatarUrl ? (
                                <AvatarImage src={review.avatarUrl} alt={`${review.author} avatar`} />
                              ) : null}
                              <AvatarFallback className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                                {review.author
                                  .split(' ')
                                  .map((part) => part[0])
                                  .join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-emerald-900 dark:text-emerald-100">{review.author}</p>
                              {review.timeAgo ? (
                                <p className="text-xs text-muted-foreground dark:text-emerald-200/80">{review.timeAgo}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {review.source === 'member' && dict.productDetails?.ratingVerifiedLabel ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200"
                              >
                                {dict.productDetails.ratingVerifiedLabel}
                              </Badge>
                            ) : null}
                            {isOwner && !isEditing && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                                  onClick={() => startEditing(review)}
                                  title={lang === 'es' ? 'Editar reseña' : 'Edit review'}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/30"
                                      title={lang === 'es' ? 'Eliminar reseña' : 'Delete review'}
                                      disabled={isDeleting === review.id}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {lang === 'es' ? '¿Eliminar reseña?' : 'Delete review?'}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {lang === 'es'
                                          ? 'Esta acción no se puede deshacer. Tu reseña será eliminada permanentemente.'
                                          : 'This action cannot be undone. Your review will be permanently deleted.'}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        {lang === 'es' ? 'Cancelar' : 'Cancel'}
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(review.id)}
                                        className="bg-red-500 hover:bg-red-600"
                                      >
                                        {lang === 'es' ? 'Eliminar' : 'Delete'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            {Array.from({ length: STAR_COUNT }).map((_, index) => {
                              const value = index + 1;
                              const isActive = value <= (editHoveredRating ?? editRating);
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setEditRating(value)}
                                  onMouseEnter={() => setEditHoveredRating(value)}
                                  onMouseLeave={() => setEditHoveredRating(null)}
                                  className={`rounded-full p-1 transition ${isActive ? 'text-emerald-500' : 'text-emerald-200 dark:text-emerald-800 hover:text-emerald-400'}`}
                                  aria-label={`${value} ${value === 1 ? (lang === 'es' ? 'estrella' : 'star') : (lang === 'es' ? 'estrellas' : 'stars')}`}
                                >
                                  <Star className={`h-4 w-4 ${isActive ? 'fill-current' : ''}`} />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: STAR_COUNT }).map((_, index) => (
                              <Star
                                key={index}
                                className={`h-4 w-4 ${index + 1 <= review.rating ? 'fill-emerald-500 text-emerald-500' : 'text-emerald-200 dark:text-emerald-800'}`}
                              />
                            ))}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground dark:text-emerald-100/80">
                        {isEditing ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editComment}
                              onChange={(e) => setEditComment(e.target.value)}
                              className="min-h-[80px] resize-none border-emerald-200 bg-white/80 focus:border-emerald-500 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/50"
                              disabled={isUpdating}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditing}
                                disabled={isUpdating}
                                className="gap-1"
                              >
                                <X className="h-4 w-4" />
                                {lang === 'es' ? 'Cancelar' : 'Cancel'}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUpdate(review.id)}
                                disabled={isUpdating || editComment.trim().length < 10 || editRating < 1}
                                className="gap-1"
                              >
                                <Check className="h-4 w-4" />
                                {isUpdating
                                  ? (lang === 'es' ? 'Guardando...' : 'Saving...')
                                  : (lang === 'es' ? 'Guardar' : 'Save')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          review.comment
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : showReviewSkeleton ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <Card
                    key={`review-skeleton-${index}`}
                    className="border border-emerald-100/70 bg-white/80 shadow-sm backdrop-blur dark:border-emerald-900/50 dark:bg-emerald-950/50"
                    aria-hidden
                  >
                    <CardHeader className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex flex-col gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-full border border-dashed border-emerald-700/30 bg-emerald-50/40 p-6 text-center text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/40 dark:text-emerald-100/70">
                  <CardContent>
                    {dict.productDetails?.reviewEmptyState ?? 'Aún no hay reseñas. ¡Sé el primero en compartir tu experiencia!'}
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
