'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { i18n } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const pathName = usePathname();
  const searchParams = useSearchParams();

  const currentLocale = (() => {
    if (!pathName) {
      return i18n.defaultLocale;
    }

    if (pathName.startsWith('/admin')) {
      const langParam = searchParams?.get('lang');
      if (langParam && (i18n.locales as readonly string[]).includes(langParam)) {
        return langParam;
      }
      return i18n.defaultLocale;
    }

    const segments = pathName.split('/');
    const localeSegment = segments[1];
    if (localeSegment && (i18n.locales as readonly string[]).includes(localeSegment)) {
      return localeSegment;
    }
    return i18n.defaultLocale;
  })();

  const redirectedPathName = (locale: string) => {
    if (!pathName) return '/';
    if (pathName.startsWith('/admin')) {
      const basePath = pathName;
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('lang', locale);
      const queryString = params.toString();
      return queryString ? `${basePath}?${queryString}` : `${basePath}?lang=${locale}`;
    }
    const segments = pathName.split('/');
    segments[1] = locale;
    return segments.join('/');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" suppressHydrationWarning>
          <Globe className="h-5 w-5" />
          <span className="sr-only">{currentLocale === 'es' ? 'Cambiar idioma' : 'Change language'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentLocale === 'es' ? 'Seleccionar idioma' : 'Select language'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {i18n.locales.map((locale) => {
            return (
              <Button key={locale} variant="outline" asChild>
                <Link href={redirectedPathName(locale)}>{locale.toUpperCase()}</Link>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
