import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { i18n } from '@/i18n/config';

const SUPPORTED_LOCALES = ['en', 'es'] as const;
const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * Parse Accept-Language header and return the best matching locale
 */
function getLocaleFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return i18n.defaultLocale;

  // Parse and sort by quality value
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(),
        quality: qValue ? parseFloat(qValue) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find the first matching supported locale
  for (const lang of languages) {
    if (SUPPORTED_LOCALES.includes(lang.code as typeof SUPPORTED_LOCALES[number])) {
      return lang.code;
    }
  }

  return i18n.defaultLocale;
}

export default async function RootPage() {
  // Check for saved locale preference in cookie
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  
  if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as typeof SUPPORTED_LOCALES[number])) {
    redirect(`/${savedLocale}`);
  }

  // Detect locale from Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get('Accept-Language');
  const detectedLocale = getLocaleFromHeader(acceptLanguage);
  
  redirect(`/${detectedLocale}`);
}
