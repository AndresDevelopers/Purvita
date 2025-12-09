import { redirect } from 'next/navigation';

/**
 * ✅ DYNAMIC ADMIN BYPASS ROUTE
 *
 * Esta ruta fue generada automáticamente por scripts/setup-bypass-route.js
 * basándose en NEXT_PUBLIC_ADMIN_BYPASS_URL=purvitaadmin
 *
 * IMPORTANTE: Esta página redirige SIEMPRE al admin login (con o sin token).
 */
export default async function AdminBypassPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  // Redirigir SIEMPRE al admin login (sin validar token)
  redirect(`/admin/login?lang=${lang}`);
}
