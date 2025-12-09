'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase, getSafeSession } from '@/lib/supabase';
import { getCurrentUserProfile } from '@/lib/services/user-service';
import type { UserProfile } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import type { Permission } from '@/lib/models/role';

interface AdminGuardProps {
  children: React.ReactNode;
  lang: Locale;
  /**
   * Required permission to access this page.
   * If not provided, only checks if user is admin (legacy behavior).
   * If provided, checks both admin role AND specific permission.
   */
  requiredPermission?: Permission;
}

export default function AdminGuard({ children, lang, requiredPermission }: AdminGuardProps) {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        // Verificar autenticación
        const { data: { session } } = await getSafeSession();

        if (!session?.user) {
          router.push(`/${lang}/auth/login`);
          return;
        }

        setIsAuthenticated(true);

        // Obtener perfil del usuario
        const profile = await getCurrentUserProfile();

        if (!profile) {
          router.push(`/${lang}/dashboard`);
          return;
        }

        setUserProfile(profile);

        // ALWAYS check for access_admin_panel permission using the correct endpoint
        try {
          const response = await fetch('/api/check-admin-access', {
            method: 'GET',
            credentials: 'include',
          });

          if (!response.ok) {
            console.warn('Failed to check admin access');
            router.push(`/${lang}/dashboard?error=admin_access_denied`);
            return;
          }

          const data = await response.json();

          if (!data.hasAccess) {
            // Usuario no tiene permiso para acceder al panel de admin
            console.warn('User lacks access_admin_panel permission');
            router.push(`/${lang}/dashboard?error=admin_access_denied`);
            return;
          }
        } catch (error) {
          console.error('Error checking access_admin_panel permission:', error);
          router.push(`/${lang}/dashboard?error=permission_check_failed`);
          return;
        }

        // Si se requiere un permiso específico adicional, verificarlo
        if (requiredPermission) {
          try {
            const response = await fetch('/api/admin/check-permission', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ permission: requiredPermission }),
            });

            if (!response.ok) {
              // Usuario no tiene el permiso requerido
              console.warn(`User lacks required permission: ${requiredPermission}`);
              router.push(`/admin?error=forbidden&permission=${requiredPermission}`);
              return;
            }

            setHasPermission(true);
          } catch (error) {
            console.error('Error checking permission:', error);
            router.push(`/admin?error=permission_check_failed`);
            return;
          }
        } else {
          // No se requiere permiso específico adicional
          setHasPermission(true);
        }
      } catch (error) {
        console.error('Error verificando permisos de admin:', error);
        // En caso de error, redirigir al dashboard
        router.push(`/${lang}/dashboard`);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndRole();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push(`/${lang}/auth/login`);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, lang, requiredPermission]);

  // Mostrar loading mientras se verifica
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Solo renderizar si está autenticado y tiene el permiso requerido
  if (!isAuthenticated || !userProfile || !hasPermission) {
    return null;
  }

  return <>{children}</>;
}
