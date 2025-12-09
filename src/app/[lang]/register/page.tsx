import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';

interface RegisterRedirectPageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function RegisterRedirectPage({ params }: RegisterRedirectPageProps) {
  const { lang } = await params;
  redirect(`/${lang}/auth/register`);
}

