'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AuthDebug() {
  const [authState, setAuthState] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verificar sesión
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Verificar usuario
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        let profile = null;
        if (session?.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          profile = { data: profileData, error: profileError };
        }

        setAuthState({
          session: { data: session, error: sessionError },
          user: { data: user, error: userError },
          profile,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setAuthState({ error: message });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email: 'kevinsotov95@gmail.com',
      options: {
        shouldCreateUser: false
      }
    });
    
    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Revisa tu email para el link de acceso');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div>Cargando estado de autenticación...</div>;
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Estado de Autenticación - Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div>
            <h3 className="font-semibold">Sesión:</h3>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
              {JSON.stringify(authState.session, null, 2)}
            </pre>
          </div>
          
          <div>
            <h3 className="font-semibold">Usuario:</h3>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
              {JSON.stringify(authState.user, null, 2)}
            </pre>
          </div>
          
          {authState.profile && (
            <div>
              <h3 className="font-semibold">Perfil:</h3>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                {JSON.stringify(authState.profile, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleLogin} variant="outline">
            Enviar Magic Link
          </Button>
          <Button onClick={handleLogout} variant="destructive">
            Cerrar Sesión
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p><strong>Estado:</strong> {authState.session?.data ? 'Autenticado' : 'No autenticado'}</p>
          <p><strong>Email:</strong> {authState.session?.data?.user?.email || 'N/A'}</p>
          <p><strong>Acceso a videos:</strong> {authState.profile?.data?.pay ? 'Sí' : 'No'}</p>
        </div>
      </CardContent>
    </Card>
  );
}