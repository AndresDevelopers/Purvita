'use client';

import { useState, use, useEffect } from 'react';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail } from 'lucide-react';

interface AffiliateEmailPageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

export default function AffiliateEmailPage({ params }: AffiliateEmailPageProps) {
  const { lang, referralCode } = use(params);
  const _dict = useAppDictionary();
  const { toast } = useToast();
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Load current email on mount
  useEffect(() => {
    const loadCurrentEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentEmail(user.email);
      }
    };
    loadCurrentEmail();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newEmail !== confirmEmail) {
      toast({ 
        title: 'Error', 
        description: 'Los correos electrónicos no coinciden',
        variant: 'destructive'
      });
      return;
    }

    if (newEmail === currentEmail) {
      toast({ 
        title: 'Error', 
        description: 'El nuevo correo debe ser diferente al actual',
        variant: 'destructive'
      });
      return;
    }

    // Validate current password is provided
    if (!currentPassword || currentPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa tu contraseña actual',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Call server-side API with validation
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newEmail,
          currentPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update email');
      }

      toast({
        title: 'Verificación enviada',
        description: data.message || 'Se ha enviado un correo de confirmación a tu nueva dirección.',
      });

      setNewEmail('');
      setConfirmEmail('');
      setCurrentPassword('');

      // Redirect back to settings after a delay
      setTimeout(() => {
        router.push(`/${lang}/affiliate/${referralCode}/settings`);
      }, 3000);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el correo electrónico',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Configuración
          </Button>

          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">Cambiar Correo Electrónico</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2">
              Actualiza tu dirección de correo electrónico. Recibirás un correo de confirmación.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="current-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Correo Actual
              </Label>
              <Input
                id="current-email"
                type="email"
                value={currentEmail}
                disabled
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              />
            </div>

            <div>
              <Label htmlFor="new-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Nuevo Correo Electrónico
              </Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="nuevo@ejemplo.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Confirmar Nuevo Correo
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="nuevo@ejemplo.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="current-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Contraseña Actual
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="Tu contraseña actual"
                required
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Importante:</strong> Se enviará un correo de confirmación a tu nueva dirección. 
                Debes hacer clic en el enlace de verificación para completar el cambio.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full md:w-auto px-6 py-3 bg-primary text-background-dark font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                {loading ? 'Actualizando...' : 'Actualizar Correo'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}

