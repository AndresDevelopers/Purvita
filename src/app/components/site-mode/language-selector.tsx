'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { i18n, type Locale } from '@/i18n/config';

// Flag component using actual PNG images
const FlagIcon = ({ locale }: { locale: Locale }) => {
  const flagSrc = locale === 'en' ? '/flags/us.png' : '/flags/es.png';
  const alt = locale === 'en' ? 'EN' : 'ES';

  return (
    <Image
      src={flagSrc}
      alt={alt}
      width={19}
      height={16}
      className="object-contain"
      priority
    />
  );
};

const _LANGUAGE_META: Record<Locale, { name: string }> = {
  en: { name: 'English' },
  es: { name: 'Español' },
};

const isSupportedLocale = (value: string): value is Locale => {
  return i18n.locales.includes(value as Locale);
};

export function LanguageSelector() {
  const pathname = usePathname();
  const router = useRouter();

  const fallbackLocale = i18n.defaultLocale;
  const localeFromPath = pathname.split('/')[1] ?? fallbackLocale;
  const currentLocale = isSupportedLocale(localeFromPath) ? localeFromPath : fallbackLocale;

  const handleLanguageChange = (locale: Locale) => {
    const segments = pathname.split('/');
    segments[1] = locale;
    const newPath = segments.join('/');
    router.push(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 border-none bg-transparent px-2 py-1 text-base font-normal text-black hover:bg-transparent"
        >
          <FlagIcon locale={currentLocale} />
          <span className="font-normal">
            {currentLocale.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[80px] border border-gray-300 bg-white p-2">
        {i18n.locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLanguageChange(locale)}
            className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs text-black hover:bg-gray-100 ${
              currentLocale === locale ? 'bg-gray-50 font-semibold' : ''
            }`}
          >
            <FlagIcon locale={locale} />
            <span className="text-black">{locale.toUpperCase()}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
