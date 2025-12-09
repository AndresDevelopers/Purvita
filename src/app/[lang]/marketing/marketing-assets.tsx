'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { Locale } from '@/i18n/config';
import { supabase } from '@/lib/supabase';

type MediaType = 'image' | 'video';
type FileType = 'gif' | 'png' | 'jpg' | 'jpeg' | 'video';

interface MarketingAsset {
  id: string;
  title: string;
  title_en?: string | null;
  title_es?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_es?: string | null;
  file_url: string | null;
  video_url: string | null;
  file_type: FileType | null;
  media_type: MediaType;
  category: string;
  display_order: number;
}

interface MarketingAssetsProps {
  lang: Locale;
  dict: unknown;
}

const extractYouTubeId = (url: string | null | undefined): string | null => {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes('youtube.com')) {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId) return videoId;

      const pathMatch = parsedUrl.pathname.match(/\/embed\/([\w-]{6,})|\/shorts\/([\w-]{6,})/);
      if (pathMatch) {
        return pathMatch[1] ?? pathMatch[2] ?? null;
      }
    }

    if (parsedUrl.hostname.includes('youtu.be')) {
      const shortId = parsedUrl.pathname.replace('/', '');
      return shortId || null;
    }
  } catch (error) {
    console.warn('No se pudo analizar la URL de YouTube:', error);
  }

  const fallbackMatch = url.match(/[?&]v=([\w-]{6,})/);
  return fallbackMatch?.[1] ?? null;
};

const normalizeCategory = (category?: string | null): string => {
  if (!category) return 'general';
  return category;
};

export default function MarketingAssets({ lang, dict: _dict }: MarketingAssetsProps) {
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const { data, error } = await supabase
          .from('marketing_assets')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) {
          throw error;
        }

        setAssets((data || []).map((asset) => ({
          ...asset,
          category: normalizeCategory(asset.category),
        })));
      } catch (err) {
        console.error('Error fetching marketing assets:', err);
        setError('Error al cargar los recursos de marketing');
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

  const categories = useMemo(() => {
    const collection = new Set<string>();
    collection.add('all');
    assets.forEach((asset) => {
      collection.add(normalizeCategory(asset.category));
    });
    return Array.from(collection);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (selectedCategory === 'all') {
      return assets;
    }
    return assets.filter((asset) => normalizeCategory(asset.category) === selectedCategory);
  }, [assets, selectedCategory]);

  const getLocalizedText = (asset: MarketingAsset, field: 'title' | 'description'): string => {
    const localizedField = `${field}_${lang}` as keyof MarketingAsset;
    const localizedValue = asset[localizedField];
    const fallbackValue = asset[field];
    return (typeof localizedValue === 'string' ? localizedValue : fallbackValue) || '';
  };

  const renderMedia = (asset: MarketingAsset) => {
    if (asset.media_type === 'video') {
      const videoId = extractYouTubeId(asset.video_url);

      if (!videoId) {
        return (
          <div className="flex items-center justify-center h-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">
            Video no disponible
          </div>
        );
      }

      return (
        <div className="absolute inset-0">
          <iframe
            title={getLocalizedText(asset, 'title') || 'Video de marketing'}
            src={`https://www.youtube.com/embed/${videoId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full rounded-t-lg"
          />
        </div>
      );
    }

    if (!asset.file_url) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">
          Recurso no disponible
        </div>
      );
    }

    if (asset.file_type === 'gif') {
      return (
        <Image
          src={asset.file_url}
          alt={getLocalizedText(asset, 'title')}
          fill
          className="object-cover"
          unoptimized
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      );
    }

    return (
      <Image
        src={asset.file_url}
        alt={getLocalizedText(asset, 'title')}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
            <div className="h-48 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Error al cargar recursos
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {error}
        </p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No hay recursos disponibles
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Los recursos de marketing estarán disponibles próximamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`flex-shrink-0 px-4 py-2 text-sm rounded-full border transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-300 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {category === 'all' ? 'Todos' : category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="relative h-48 bg-gray-100 dark:bg-gray-700">
              {asset.media_type === 'video' ? (
                <div className="relative w-full h-full">
                  <div className="relative w-full h-0 pb-[56.25%]">
                    <div className="absolute inset-0">{renderMedia(asset)}</div>
                  </div>
                </div>
              ) : (
                renderMedia(asset)
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="inline-flex items-center px-2 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-white/90 text-gray-700">
                  {normalizeCategory(asset.category)}
                </span>
                <span className="inline-flex items-center px-2 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-blue-600/90 text-white">
                  {asset.media_type === 'video' ? 'Video' : 'Imagen'}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {getLocalizedText(asset, 'title')}
                </h3>
                {getLocalizedText(asset, 'description') && (
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {getLocalizedText(asset, 'description')}
                  </p>
                )}
              </div>
              <div>
                <a
                  href={asset.media_type === 'video' ? asset.video_url ?? '#' : asset.file_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={
                        asset.media_type === 'video'
                          ? 'M14.752 11.168l-3.197-1.832A1 1 0 0010.5 10.23v3.54a1 1 0 001.555.894l3.197-1.832a1 1 0 000-1.764z'
                          : 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                      }
                    />
                  </svg>
                  {asset.media_type === 'video' ? 'Ver video' : 'Descargar'}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
