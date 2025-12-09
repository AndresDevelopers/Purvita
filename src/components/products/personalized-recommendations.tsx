'use client';

import { useEffect, useState, useMemo } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import ProductCard from '@/app/components/product-card';
import type { Product } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';

interface PersonalizedRecommendationsProps {
  lang: Locale;
  excludeProductIds?: string[];
  limit?: number;
  className?: string;
}

interface RecommendationsResponse {
  recommendations: Product[];
  personalized: boolean;
  source: 'purchase_history' | 'hybrid' | 'popular';
}

export function PersonalizedRecommendations({
  lang,
  excludeProductIds = [],
  limit = 4,
  className = '',
}: PersonalizedRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          limit: String(limit),
        });

        if (excludeProductIds.length > 0) {
          params.set('exclude', excludeProductIds.join(','));
        }

        const response = await fetch(`/api/recommendations?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch recommendations');
        }

        const data: RecommendationsResponse = await response.json();
        setRecommendations(data.recommendations);
        setIsPersonalized(data.personalized);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('No se pudieron cargar las recomendaciones');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [limit, excludeProductIds]);

  const title = useMemo(() => {
    if (isPersonalized) {
      return 'Recomendado para ti';
    }
    return 'Productos populares';
  }, [isPersonalized]);

  const subtitle = useMemo(() => {
    if (isPersonalized) {
      return 'Basado en tus compras anteriores';
    }
    return 'Los favoritos de nuestros clientes';
  }, [isPersonalized]);

  // Don't render if no recommendations and not loading
  if (!isLoading && recommendations.length === 0 && !error) {
    return null;
  }

  return (
    <section className={`mt-16 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        {isPersonalized ? (
          <Sparkles className="h-6 w-6 text-primary" />
        ) : (
          <TrendingUp className="h-6 w-6 text-primary" />
        )}
        <div>
          <h2 className="font-headline text-2xl font-bold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: limit }).map((_, index) => (
            <div key={`rec-skeleton-${index}`} className="space-y-4">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {recommendations.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
            />
          ))}
        </div>
      )}
    </section>
  );
}
