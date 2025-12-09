'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import type { Locale } from '@/i18n/config';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ChevronRight, ArrowLeft } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';

interface AffiliatePrivacyPageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

interface PrivacySettings {
  showReviews: boolean;
  allowPersonalizedRecommendations: boolean;
}

export default function AffiliatePrivacyPage({ params }: AffiliatePrivacyPageProps) {
  const { lang, referralCode } = use(params);
  const _dict = useAppDictionary();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState<PrivacySettings>({
    showReviews: true,
    allowPersonalizedRecommendations: true,
  });

  // Save the referrer URL when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && document.referrer) {
      sessionStorage.setItem('delete_account_origin', document.referrer);
    }
  }, []);

  // Load privacy settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/privacy');
        if (response.ok) {
          const data = await response.json();
          setSettings({
            showReviews: data.showReviews ?? true,
            allowPersonalizedRecommendations: data.allowPersonalizedRecommendations ?? true,
          });
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSettingChange = async (key: keyof PrivacySettings, value: boolean) => {
    const previousSettings = { ...settings };

    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update setting');
      }

      toast({
        title: 'Guardado',
        description: 'Configuración de privacidad actualizada'
      });
    } catch (_error) {
      // Revert on error
      setSettings(previousSettings);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la configuración',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      toast({ title: 'Success', description: 'Account deleted successfully' });

      // Get the origin URL from sessionStorage or use affiliate store as fallback
      const originUrl = sessionStorage.getItem('delete_account_origin');
      sessionStorage.removeItem('delete_account_origin');

      // Redirect to origin URL or affiliate store page
      window.location.href = originUrl || `/${lang}/affiliate/${referralCode}`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account';
      toast({ title: 'Error', description: errorMessage });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
              className="mb-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Configuración
            </Button>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Configuración
          </Button>

          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Configuración de Privacidad</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Administra tus datos y cómo se comparten.</p>
          </div>
          <div className="space-y-10">
            {/* Content Privacy Section */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">Privacidad de Contenido</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-medium text-gray-900 dark:text-white">Mostrar Reseñas Públicamente</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tus reseñas y calificaciones serán visibles en los productos de esta tienda.</p>
                  </div>
                  <Switch
                    checked={settings.showReviews}
                    onCheckedChange={(value) => handleSettingChange('showReviews', value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </section>

            {/* Personalization Section */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">Personalización</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-medium text-gray-900 dark:text-white">Recomendaciones Personalizadas</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Recibe sugerencias de productos basadas en tus compras y actividad en esta tienda.</p>
                  </div>
                  <Switch
                    checked={settings.allowPersonalizedRecommendations}
                    onCheckedChange={(value) => handleSettingChange('allowPersonalizedRecommendations', value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </section>

            {/* Account Management Section */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">Gestión de Cuenta</h3>
              <div className="space-y-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 p-4 rounded-lg -mx-4 transition-colors">
                      <p className="text-base font-medium text-red-500 dark:text-red-400">Eliminar Cuenta</p>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Esto eliminará permanentemente tu cuenta y todos tus datos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting} className="bg-red-500 hover:bg-red-600">
                        {isDeleting ? 'Eliminando...' : 'Eliminar Cuenta'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
