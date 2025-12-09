'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestVideos() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const checkUserAndVideos = async () => {
      try {
        // Verificar usuario
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Session:', session);
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Error de sesión: ' + sessionError.message);
          return;
        }

        if (!session?.user) {
          setError('Usuario no autenticado');
          return;
        }

        setUser(session.user);

        // Verificar perfil
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        console.log('Profile:', profileData);
        
        if (profileError) {
          console.error('Profile error:', profileError);
          setError('Error de perfil: ' + profileError.message);
          return;
        }

        setProfile(profileData);

        if (!profileData?.pay) {
          setError('Usuario no tiene acceso de pago');
          return;
        }

        // Intentar obtener videos
        console.log('Intentando obtener videos...');
        const { data: videosData, error: videosError } = await supabase
          .from('class_videos')
          .select('*')
          .eq('is_published', true)
          .order('order_index');

        console.log('Videos data:', videosData);
        console.log('Videos error:', videosError);

        if (videosError) {
          console.error('Videos error:', videosError);
          setError('Error obteniendo videos: ' + videosError.message);
          return;
        }

        setVideos(videosData || []);
        
      } catch (err: any) {
        console.error('Unexpected error:', err);
        setError('Error inesperado: ' + (err?.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    checkUserAndVideos();
  }, []);

  if (loading) {
    return <div className="p-8 flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test de Videos de Clases</h1>
      
      <div className="space-y-4 mb-8">
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <h3 className="font-semibold">Estado del Usuario:</h3>
          <p>Email: {user?.email || 'No autenticado'}</p>
          <p>ID: {user?.id || 'N/A'}</p>
        </div>

        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <h3 className="font-semibold">Perfil:</h3>
          <p>Nombre: {profile?.name || 'N/A'}</p>
          <p>Pago: {profile?.pay ? 'Sí' : 'No'}</p>
          <p>Rol: {profile?.role || 'N/A'}</p>
          <p>Estado: {profile?.status || 'N/A'}</p>
        </div>

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
            <h3 className="font-semibold">Error:</h3>
            <p>{error}</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Videos ({videos.length})</h2>
        {videos.length === 0 ? (
          <p className="text-gray-600">No se encontraron videos</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {videos.map((video) => (
              <div key={video.id} className="p-4 border rounded">
                <h3 className="font-semibold">{video.title}</h3>
                <p className="text-sm text-gray-600">{video.description}</p>
                <p className="text-xs text-gray-500">YouTube ID: {video.youtube_id}</p>
                <p className="text-xs text-gray-500">Orden: {video.order_index}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}