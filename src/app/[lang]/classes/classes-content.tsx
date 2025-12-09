'use client';

import { useEffect, useState } from 'react';
import { PlayCircle, Search } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublishedClassVideos as _getPublishedClassVideos, getPublishedClassVideosForUser } from '@/lib/services/class-video-service';
import { supabase } from '@/lib/supabase';
import type { ClassVideo } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import type { getDictionary } from '@/i18n/dictionaries';
import { sanitizeUserInput } from '@/lib/security/frontend-sanitization';

const extractYouTubeId = (value: string): string | null => {
  const trimmed = value.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/(?:(?:v=)|(?:youtu\.be\/)|(?:embed\/))([A-Za-z0-9_-]{11})/);

  return match ? match[1] : null;
};

const _buildEmbedUrl = (value: string): string => {
  const videoId = extractYouTubeId(value);

  return `https://www.youtube.com/embed/${videoId ?? value}`;
};

const buildWatchUrl = (value: string): string => {
  const videoId = extractYouTubeId(value) ?? value;

  return `https://www.youtube.com/watch?v=${videoId}`;
};

type AppDictionary = ReturnType<typeof getDictionary>;

interface ClassesPageContentProps {
  lang: Locale;
  dict: AppDictionary;
}

export default function ClassesPageContent({ lang: _lang, dict }: ClassesPageContentProps) {
  return <ClassVideoGrid dict={dict} />;
}

interface ClassVideoGridProps {
  dict: AppDictionary;
}

const ClassVideoGrid = ({ dict }: ClassVideoGridProps) => {
  const [videos, setVideos] = useState<ClassVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<ClassVideo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadVideos = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Verificar autenticación primero
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          throw new Error('Usuario no autenticado. Por favor inicia sesión.');
        }

        const userId = session.user.id;
        const data = await getPublishedClassVideosForUser(userId);

        if (isMounted) {
          setVideos(data);
        }
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('ClassVideoGrid: Error loading class videos', err);
        }

        if (isMounted) {
          // Mostrar error más específico
          if (err?.message?.includes('no autenticado')) {
            setError('Necesitas iniciar sesión para ver los videos de clases.');
          } else if (err?.message?.includes('RLS') || err?.message?.includes('policy')) {
            setError('No tienes permisos para ver los videos. Verifica tu suscripción.');
          } else if (err?.message) {
            setError(err.message);
          } else {
            setError('Error desconocido al cargar los videos. Por favor revisa la consola.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVideos();

    return () => {
      isMounted = false;
    };
  }, [dict.classesPage.errorDescription]);

  // Filtrar videos por categoría
  useEffect(() => {
    if (selectedCategory === 'All') {
      setFilteredVideos(videos);
    } else {
      setFilteredVideos(videos.filter(video => video.category === selectedCategory));
    }
  }, [videos, selectedCategory]);

  const _renderSkeletons = () => (
    <div className="grid gap-8 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );

  const getCategories = () => {
    const categories = new Set<string>();
    videos.forEach(video => {
      if (video.category) {
        categories.add(video.category);
      }
    });
    return ['All', ...Array.from(categories).sort()];
  };

  const renderFeatured = () => {
    const featuredVideos = filteredVideos.filter(video => video.is_featured);
    
    if (featuredVideos.length === 0) {
      return null;
    }
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {featuredVideos.map((video) => {
          const videoId = extractYouTubeId(video.youtube_id) ?? video.youtube_id;
          const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          const watchUrl = buildWatchUrl(video.youtube_id);

          return (
            <div key={video.id} className="group">
              <div className="relative aspect-video rounded-lg overflow-hidden mb-3">
                <div
                  className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                  style={{ backgroundImage: `url("${thumbnailUrl}")` }}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayCircle className="text-white text-6xl" />
                </div>
                <a href={watchUrl} target="_blank" rel="noreferrer" className="absolute inset-0" />
              </div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">{video.title}</h3>
            </div>
          );
        })}
      </div>
    );
  };

  const renderVideos = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
      {filteredVideos.map((video) => {
        const videoId = extractYouTubeId(video.youtube_id) ?? video.youtube_id;
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const watchUrl = buildWatchUrl(video.youtube_id);

        return (
          <div key={video.id} className="group">
            <div className="relative aspect-video rounded-lg overflow-hidden mb-3">
              <div
                className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                style={{ backgroundImage: `url("${thumbnailUrl}")` }}
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <PlayCircle className="text-white text-6xl" />
              </div>
              <a href={watchUrl} target="_blank" rel="noreferrer" className="absolute inset-0" />
            </div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{video.title}</h3>
          </div>
        );
      })}
    </div>
  );

  return (
    <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">Video Library</h1>
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-5 w-5" />
          <input
            className="w-full h-12 pl-12 pr-4 bg-gray-100 dark:bg-gray-800 border-transparent focus:ring-2 focus:ring-primary focus:border-transparent rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Search"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              // ✅ SECURITY: Sanitize search input to prevent XSS
              const sanitized = sanitizeUserInput(e.target.value);
              setSearchTerm(sanitized);
            }}
          />
        </div>
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="aspect-video rounded-lg" />
            ))}
          </div>
        )}
        {!isLoading && error && (
          <Alert variant="destructive" className="max-w-2xl mb-12">
            <AlertTitle>{dict.classesPage.errorTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && filteredVideos.length > 0 && (
          <>
            {filteredVideos.some(v => v.is_featured) && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Featured</h2>
                {renderFeatured()}
              </section>
            )}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Categories</h2>
              <div className="border-b border-gray-200 dark:border-gray-700/50 mb-6">
                <nav aria-label="Tabs" className="-mb-px flex space-x-8">
                  {getCategories().map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm ${
                        selectedCategory === category
                          ? 'font-bold text-primary border-primary'
                          : 'font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 border-transparent'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </nav>
              </div>
              {renderVideos()}
            </section>
          </>
        )}
        {!isLoading && !error && videos.length === 0 && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>No hay videos disponibles</CardTitle>
              <CardDescription>
                No se encontraron videos de clases publicados. Por favor contacta al administrador para agregar contenido.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        {!isLoading && !error && videos.length > 0 && filteredVideos.length === 0 && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>No videos in this category</CardTitle>
              <CardDescription>Try selecting a different category or check back later for new content.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </main>
  );
};
