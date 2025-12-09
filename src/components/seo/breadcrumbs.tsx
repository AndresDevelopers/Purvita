'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';

export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  locale: Locale;
  className?: string;
}

/**
 * Breadcrumbs component with Schema.org structured data
 * 
 * Automatically generates breadcrumbs from URL path or accepts custom items.
 * Includes BreadcrumbList structured data for SEO.
 */
export function Breadcrumbs({ items, locale, className = '' }: BreadcrumbsProps) {
  const pathname = usePathname();
  
  // Generate breadcrumbs from pathname if items not provided
  const breadcrumbItems = items || generateBreadcrumbsFromPath(pathname, locale);
  
  if (breadcrumbItems.length === 0) {
    return null;
  }

  // Generate Schema.org BreadcrumbList
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbItems.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.label,
      'item': `${typeof window !== 'undefined' ? window.location.origin : ''}${item.href}`,
    })),
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Visual Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center space-x-2 text-sm ${className}`}
      >
        <ol className="flex items-center space-x-2">
          {breadcrumbItems.map((item, itemIndex) => {
            const isLast = itemIndex === breadcrumbItems.length - 1;

            return (
              <li key={item.href} className="flex items-center">
                {itemIndex > 0 && (
                  <ChevronRight className="mx-2 h-4 w-4 text-gray-400" aria-hidden="true" />
                )}

                {itemIndex === 0 ? (
                  <Link
                    href={item.href}
                    className="flex items-center text-gray-600 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors"
                    aria-label="Home"
                  >
                    <Home className="h-4 w-4" />
                  </Link>
                ) : isLast ? (
                  <span
                    className="font-medium text-gray-900 dark:text-gray-100"
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-gray-600 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * Generate breadcrumbs from URL pathname
 */
function generateBreadcrumbsFromPath(pathname: string, locale: Locale): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  
  // Remove locale from segments
  if (segments[0] === locale) {
    segments.shift();
  }
  
  if (segments.length === 0) {
    return [];
  }
  
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: `/${locale}` },
  ];
  
  let currentPath = `/${locale}`;

  segments.forEach((segment) => {
    currentPath += `/${segment}`;

    // Humanize segment (replace hyphens with spaces, capitalize)
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    breadcrumbs.push({
      label,
      href: currentPath,
    });
  });
  
  return breadcrumbs;
}

/**
 * Helper function to generate breadcrumbs for affiliate pages
 */
export function getAffiliateBreadcrumbs(
  lang: string,
  storeName: string,
  referralCode: string,
  currentPage?: 'store' | 'product' | 'cart' | 'checkout',
  productName?: string
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    {
      label: lang === 'es' ? 'Inicio' : 'Home',
      href: `/${lang}`,
    },
  ];

  // Always add the affiliate store
  items.push({
    label: storeName,
    href: currentPage === 'store' ? `/${lang}/affiliate/${referralCode}` : `/${lang}/affiliate/${referralCode}`,
  });

  // Add current page if not the store itself
  if (currentPage === 'product' && productName) {
    items.push({
      label: productName,
      href: '', // Current page, no href
    });
  } else if (currentPage === 'cart') {
    items.push({
      label: lang === 'es' ? 'Carrito' : 'Cart',
      href: '', // Current page, no href
    });
  } else if (currentPage === 'checkout') {
    items.push({
      label: lang === 'es' ? 'Pago' : 'Checkout',
      href: '', // Current page, no href
    });
  }

  return items;
}

/**
 * Helper function to generate breadcrumbs for product pages
 */
export function getProductBreadcrumbs(
  lang: string,
  productName: string,
  categoryName?: string
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    {
      label: lang === 'es' ? 'Inicio' : 'Home',
      href: `/${lang}`,
    },
    {
      label: lang === 'es' ? 'Productos' : 'Products',
      href: `/${lang}/products`,
    },
  ];

  if (categoryName) {
    items.push({
      label: categoryName,
      href: `/${lang}/products?category=${encodeURIComponent(categoryName)}`,
    });
  }

  items.push({
    label: productName,
    href: '', // Current page, no href
  });

  return items;
}
