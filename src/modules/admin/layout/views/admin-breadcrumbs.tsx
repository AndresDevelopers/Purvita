'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminBreadcrumbsProps {
  lang: Locale;
}

const pathToLabel: Record<string, { es: string; en: string }> = {
  '/admin': { es: 'Panel de Administración', en: 'Admin Panel' },
  '/admin/dashboard': { es: 'Dashboard', en: 'Dashboard' },
  '/admin/users': { es: 'Usuarios', en: 'Users' },
  '/admin/plans': { es: 'Planes de Suscripción', en: 'Subscription Plans' },
  '/admin/products': { es: 'Productos', en: 'Products' },
  '/admin/orders': { es: 'Pedidos', en: 'Orders' },
  '/admin/bodega': { es: 'Bodega', en: 'Warehouse' },
  '/admin/videos': { es: 'Videos', en: 'Videos' },
  '/admin/pays': { es: 'Pagos', en: 'Payments' },
  '/admin/payments/history': { es: 'Historial de Pagos', en: 'Payment History' },
  '/admin/sales-history': { es: 'Historial de Ventas', en: 'Sales History' },
  '/admin/messages': { es: 'Mensajes', en: 'Messages' },
  '/admin/seo': { es: 'SEO', en: 'SEO' },
  '/admin/pages': { es: 'Páginas', en: 'Pages' },
  '/admin/site-content': { es: 'Contenido del Sitio', en: 'Site Content' },
  '/admin/app-settings': { es: 'Configuración de la App', en: 'App Settings' },
  '/admin/contact-settings': { es: 'Configuración de Contacto', en: 'Contact Settings' },
  '/admin/email-notifications': { es: 'Notificaciones por Correo', en: 'Email Notifications' },
  '/admin/site-status': { es: 'Estado del Sitio', en: 'Site Status' },
  '/admin/tutorials': { es: 'Tutoriales', en: 'Tutorials' },
  '/admin/marketing': { es: 'Marketing', en: 'Marketing' },
  '/admin/security': { es: 'Seguridad', en: 'Security' },
};

export const AdminBreadcrumbs = ({ lang }: AdminBreadcrumbsProps) => {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    const items: BreadcrumbItem[] = [];
    
    // Always start with home
    items.push({
      label: lang === 'es' ? 'Inicio' : 'Home',
      href: `/admin/dashboard?lang=${lang}`,
    });

    // Get the current path without query params
    const cleanPath = pathname.split('?')[0];
    
    // If we're not on the dashboard, add the current page
    if (cleanPath !== '/admin/dashboard' && cleanPath !== '/admin') {
      const pathInfo = pathToLabel[cleanPath];
      if (pathInfo) {
        items.push({
          label: pathInfo[lang],
        });
      } else {
        // Fallback: use the last segment of the path
        const segments = cleanPath.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        items.push({
          label: lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, ' '),
        });
      }
    }

    return items;
  }, [pathname, lang]);

  // Don't show breadcrumbs if there's only one item (home)
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="mb-6"
      data-testid="admin-breadcrumbs"
    >
      <ol className="flex items-center gap-2 text-sm text-background-dark/60 dark:text-background-light/60">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                  data-testid={`breadcrumb-${index}`}
                >
                  {index === 0 && <Home className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span 
                  className={`flex items-center gap-1 ${isLast ? 'text-background-dark dark:text-background-light font-medium' : ''}`}
                  aria-current={isLast ? 'page' : undefined}
                  data-testid={`breadcrumb-${index}`}
                >
                  {index === 0 && <Home className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

