'use client';

import { usePathname } from 'next/navigation';
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

  const redirectedPathName = (locale: string) => {
    if (!pathName) return '/';
    if (pathName.startsWith('/admin')) {
      const basePath = pathName.split('?')[0];
      return `${basePath}?lang=${locale}`;
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
          <span className="sr-only">Change language</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Idioma</DialogTitle>
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
