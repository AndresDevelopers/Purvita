import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/services/product-service';
import { getAllPlans } from '@/lib/services/plan-service';
import type { Product } from '@/lib/models/definitions';
import { getAppUrl } from '@/lib/env';
import { i18n } from '@/i18n/config';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Normalizes URL to remove www subdomain for canonical URLs
 */
const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Remove www. from hostname if present
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    return urlObj.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch {
    return url;
  }
};

interface SitemapUrl {
  url: string;
  lastModified: string;
  changeFrequency: string;
  priority: number;
  alternates: Array<{ lang: string; url: string }>;
}

export async function GET() {
  const baseUrl = normalizeUrl(getAppUrl());

  // URLs estáticas principales
  const staticUrls = [
    '',
    '/products',
    '/subscriptions',
    '/team',
    '/terms',
    '/privacy-policy',
  ];

  // Obtener idiomas dinámicamente desde la configuración
  const languages = i18n.locales;
  const defaultLang = i18n.defaultLocale;

  const urlsMap = new Map<string, SitemapUrl>();

  // Función helper para agregar URL con alternates
  const addUrlWithAlternates = (
    path: string,
    lastModified: string,
    changeFrequency: string,
    priority: number
  ) => {
    const alternates: Array<{ lang: string; url: string }> = [];

    // Agregar alternates para cada idioma
    languages.forEach(lang => {
      alternates.push({
        lang,
        url: `${baseUrl}/${lang}${path}`,
      });
    });

    // Agregar x-default apuntando al idioma por defecto
    alternates.push({
      lang: 'x-default',
      url: `${baseUrl}/${defaultLang}${path}`,
    });

    // Usar el idioma por defecto como URL principal en el sitemap
    const mainUrl = `${baseUrl}/${defaultLang}${path}`;

    urlsMap.set(mainUrl, {
      url: mainUrl,
      lastModified,
      changeFrequency,
      priority,
      alternates,
    });
  };

  // Agregar URLs estáticas con alternates
  // Use different lastmod dates based on content type
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  staticUrls.forEach(path => {
    // Homepage changes daily, legal pages rarely change
    const isHomepage = path === '';
    const isLegalPage = path.includes('terms') || path.includes('privacy');

    addUrlWithAlternates(
      path,
      isHomepage ? now.toISOString() : isLegalPage ? lastMonth.toISOString() : lastWeek.toISOString(),
      isHomepage ? 'daily' : isLegalPage ? 'monthly' : 'weekly',
      isHomepage ? 1.0 : 0.8
    );
  });

  try {
    // Agregar productos dinámicos
    const products: Product[] = await getProducts();
    products.forEach((product: Product) => {
      addUrlWithAlternates(
        `/products/${product.slug}`,
        product.updated_at || product.created_at || new Date().toISOString(),
        'weekly',
        0.6
      );
    });

    // Agregar planes dinámicos
    const plans = await getAllPlans();
    plans.forEach(plan => {
      addUrlWithAlternates(
        `/subscriptions?plan=${plan.slug}`,
        plan.updated_at || plan.created_at || new Date().toISOString(),
        'weekly',
        0.7
      );
    });

    // Agregar páginas de afiliados activos
    const supabase = getAdminClient();
    const { data: affiliates } = await supabase
      .from('profiles')
      .select('referral_code, updated_at')
      .not('referral_code', 'is', null)
      .eq('subscription_status', 'active')
      .limit(1000); // Limitar a 1000 afiliados activos

    if (affiliates && affiliates.length > 0) {
      affiliates.forEach(affiliate => {
        if (affiliate.referral_code) {
          addUrlWithAlternates(
            `/affiliate/${affiliate.referral_code}`,
            affiliate.updated_at || new Date().toISOString(),
            'weekly',
            0.7
          );
        }
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error generating sitemap:', error);
    }
    // Continuar sin productos/planes/afiliados si hay error
  }

  // Generar XML del sitemap con hreflang alternates
  const urls = Array.from(urlsMap.values());
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(entry => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>${entry.alternates.map(alt => `
    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${alt.url}" />`).join('')}
  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(sitemapXml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
