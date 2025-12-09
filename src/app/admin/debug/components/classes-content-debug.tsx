'use client';

import { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import type { ClassVideo } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import type { getDictionary } from '@/i18n/dictionaries';

const extractYouTubeId = (value: string): string | null => {
  const trimmed = value.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/(?:(?:v=)|(?:youtu\.be\/)|(?:embed\/))([A-Za-z0-9_-]{11})/);

  return match ? match[1] : null;
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

export default function ClassesPageContentDebug({ lang: _lang, dict: _dict }: ClassesPageContentProps) {
  const [videos, setVideos] = useState<ClassVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  interface DebugInfo {
    timestamp?: string;
    steps?: string[];
    session?: Record<string, unknown>;
    profile?: Record<string, unknown>;
    videos?: Record<string, unknown>;
    error?: string;
  }

  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});

  useEffect(() => {
    let isMounted = true;

    const loadVideos = async () => {
      setIsLoading(true);
      setError(null);
      
      const debug: DebugInfo = {
        timestamp: new Date().toISOString(),
        steps: []
      };

      try {
        // Paso 1: Verificar sesión
        debug.steps?.push('Verificando sesión...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        debug.session = {
          exists: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          error: sessionError?.message
        };

        if (sessionError) {
          throw new Error(`Error de sesión: ${sessionError.message}`);
        }

        // Paso 2: Verificar perfil (si hay sesión)
        if (session?.user) {
          debug.steps?.push('Verificando perfil...');
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          debug.profile = {
            exists: !!profile,
            pay: profile?.pay,
            role: profile?.role,
            status: profile?.status,
            error: profileError?.message
          };
        }

        // Paso 3: Intentar obtener videos directamente
        debug.steps?.push('Obteniendo videos...');
        const { data: videosData, error: videosError } = await supabase
          .from('class_videos')
          .select('*')
          .eq('is_published', true)
          .order('order_index');

        debug.videos = {
          count: videosData?.length || 0,
          data: videosData,
          error: videosError?.message,
          errorCode: videosError?.code
        };

        if (videosError) {
          throw new Error(`Error obteniendo videos: ${videosError.message} (${videosError.code})`);
        }

        if (isMounted) {
          setVideos(videosData || []);
          setDebugInfo(debug);
        }

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        debug.error = errorMessage;
        
        if (isMounted) {
          setError(errorMessage);
          setDebugInfo(debug);
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
  }, []);

  const renderVideos = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
      {videos.map((video) => {
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
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">Video Library (Debug)</h1>
        
        {/* Debug Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Información de Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="aspect-video rounded-lg" />
            ))}
          </div>
        )}
        
        {!isLoading && error && (
          <Alert variant="destructive" className="max-w-2xl mb-12">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {!isLoading && !error && videos.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Videos Encontrados ({videos.length})
            </h2>
            {renderVideos()}
          </section>
        )}
        
        {!isLoading && !error && videos.length === 0 && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>No se encontraron videos</CardTitle>
              <CardDescription>
                No hay videos publicados disponibles o no tienes permisos para verlos.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </main>
  );
};