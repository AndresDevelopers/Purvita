'use client';

import { use } from 'react';
import type { Locale } from '@/i18n/config';
import ClassesPageContent from './classes-content';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';

export default function ClassesPage({ params }: { params: Promise<{ lang: Locale }> }) {
  // React 18+ exposes the `use` helper so client components can unwrap async params.
  // ES: React 18+ expone `use` para resolver Promises en componentes cliente
  // siguiendo la convención del App Router cuando los params llegan asincrónicamente.
  const resolvedParams = use(params);
  const dict = useAppDictionary();

  return (
    <AuthGuard lang={resolvedParams.lang}>
      <ClassesPageContent lang={resolvedParams.lang} dict={dict} />
    </AuthGuard>
  );
}
