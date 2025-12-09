'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { supabase } from '@/lib/supabase';
import {
  createDefaultComingSoonSettings,
  type SiteModeConfiguration,
} from '@/modules/site-status/domain/models/site-mode';
import { ComingSoonView } from './coming-soon-view';
import { MaintenanceView } from './maintenance-view';

interface SiteModeGateProps {
  lang: Locale;
  configuration: SiteModeConfiguration;
  children: React.ReactNode;
}

const resolveSeoValue = <T extends string | Record<string, string> | Record<string, string | null> | null>(
  value: T,
  locale: Locale,
  fallback?: string
): string | null | undefined => {
  if (typeof value === 'string') {
    // Return null if empty string to allow fallback to dictionary defaults
    return value.trim() || null;
  }
  if (value && typeof value === 'object') {
    const localizedValue = value[locale] ?? value['en'];
    // Return null if empty to allow fallback to dictionary defaults
    return (typeof localizedValue === 'string' && localizedValue.trim()) ? localizedValue : null;
  }
  return fallback ?? null;
};

export function SiteModeGate({ lang, configuration, children }: SiteModeGateProps) {
  const pathname = usePathname();
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const siteModesCopy = dictionary?.siteModes;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Obtener la configuración del modo activo
  const activeModeSettings = configuration.modes.find(mode => mode.mode === configuration.activeMode);

  // Marcar como montado en el cliente
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Verificar si el usuario es admin directamente desde la base de datos
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setIsAdmin(false);
          return;
        }

        // Use API route to check admin access instead of calling getUserPermissions directly
        // This prevents "cookies() called outside request scope" error
        const response = await fetch('/api/check-admin-access', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          // User is admin if they have access_admin_panel permission
          setIsAdmin(data.hasAccess === true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };

    void checkAdminStatus();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void checkAdminStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Determinar si debe permitir bypass basado SOLO en el rol del usuario
  const shouldBypass = useMemo(() => {
    // Si estamos en una ruta /admin
    if (pathname.startsWith('/admin')) {
      // Si aún estamos verificando, permitir temporalmente para evitar flashes
      if (isAdmin === null) {
        return true;
      }
      // Si es admin, permitir acceso
      if (isAdmin === true) {
        return true;
      }
      // Si NO es admin, bloquear
      return false;
    }

    // Para otras rutas, no aplicar bypass
    return false;
  }, [pathname, isAdmin]);

  const isModeActive = Boolean(activeModeSettings?.isActive) && Boolean(configuration.activeMode);

  const backgroundImageUrl = activeModeSettings?.appearance?.backgroundImageUrl ?? null;
  const socialLinks = activeModeSettings?.appearance?.socialLinks ?? [];
  const mailchimpAudienceId =
    typeof activeModeSettings?.mailchimpAudienceId === 'string'
      ? activeModeSettings.mailchimpAudienceId.trim()
      : '';
  const mailchimpServerPrefix =
    typeof activeModeSettings?.mailchimpServerPrefix === 'string'
      ? activeModeSettings.mailchimpServerPrefix.trim()
      : '';
  const isMailchimpEnabled = activeModeSettings?.mailchimpEnabled === true;
  const isMailchimpConfigured =
    isMailchimpEnabled &&
    mailchimpAudienceId.length > 0 &&
    mailchimpServerPrefix.length > 0;
  const waitlistStatus = useMemo(
    () => ({
      isEnabled: isMailchimpEnabled,
      isConfigured: isMailchimpConfigured,
    }),
    [isMailchimpEnabled, isMailchimpConfigured],
  );
  const comingSoonSettings = useMemo(
    () => activeModeSettings?.comingSoon ?? createDefaultComingSoonSettings(),
    [activeModeSettings?.comingSoon],
  );
  const comingSoonBranding = useMemo(
    () => comingSoonSettings.branding ?? createDefaultComingSoonSettings().branding,
    [comingSoonSettings.branding],
  );

  const comingSoonLogoUrl = comingSoonBranding.logoUrl ?? branding.logoUrl;
  const comingSoonBackgroundMode = comingSoonBranding.backgroundMode ?? 'gradient';
  const comingSoonGradientColours = comingSoonBranding.backgroundGradientColors ?? [];
  const comingSoonBackgroundImageUrl = comingSoonBranding.backgroundImageUrl ?? backgroundImageUrl;

  // Si no está montado en el cliente y hay un modo activo, mostrar children
  // para evitar errores de hidratación
  if (!isMounted && isModeActive) {
    return <>{children}</>;
  }

  // Si estamos en una ruta /admin y aún estamos verificando si es admin,
  // NO mostrar nada (ni children ni vistas de bloqueo) para evitar flashes
  if (pathname.startsWith('/admin') && isAdmin === null && isModeActive) {
    return null;
  }

  // Si el modo está activo y el usuario tiene bypass (es admin), mostrar el contenido
  if (isModeActive && shouldBypass) {
    return <>{children}</>;
  }

  // Si el modo está activo y NO tiene bypass, mostrar la vista correspondiente
  if (isModeActive && configuration.activeMode === 'maintenance' && !shouldBypass) {
    return (
      <MaintenanceView
        copy={siteModesCopy?.maintenance}
        logoUrl={branding.logoUrl}
        faviconUrl={branding.faviconUrl}
        appName={branding.appName}
        backgroundImageUrl={backgroundImageUrl ?? undefined}
        backgroundOverlayOpacity={activeModeSettings?.appearance?.backgroundOverlayOpacity}
        socialLinks={socialLinks as any}
      />
    );
  }

  if (isModeActive && configuration.activeMode === 'coming_soon' && !shouldBypass) {
    return (
      <ComingSoonView
        copy={siteModesCopy?.comingSoon}
        logoUrl={comingSoonLogoUrl}
        faviconUrl={branding.faviconUrl}
        appName={branding.appName}
        waitlistStatus={waitlistStatus}
        backgroundMode={comingSoonBackgroundMode}
        backgroundGradientColors={comingSoonGradientColours}
        backgroundImageUrl={comingSoonBackgroundImageUrl}
        backgroundOverlayOpacity={activeModeSettings?.appearance?.backgroundOverlayOpacity}
        socialLinks={socialLinks as any}
        title={
          comingSoonSettings.headline ??
          resolveSeoValue(activeModeSettings?.seo?.title ?? null, lang) ??
          siteModesCopy?.comingSoon?.title
        }
        description={
          comingSoonSettings.subheadline ??
          resolveSeoValue(activeModeSettings?.seo?.description ?? null, lang) ??
          siteModesCopy?.comingSoon?.description
        }
        countdown={comingSoonSettings.countdown}
      />
    );
  }

  return <>{children}</>;
}
