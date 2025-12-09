import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';

interface LoginRedirectPageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function LoginRedirectPage({ params }: LoginRedirectPageProps) {
  const { lang } = await params;
  redirect(`/${lang}/auth/login`);
}

