'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Home, ShoppingBag } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';

export default function AffiliateNotFound() {
  const params = useParams();
  const lang = (params?.lang as Locale) || 'en';
  const _referralCode = params?.referralCode as string;
  const { branding } = useSiteBranding();
  const dict = getDictionary(lang, branding.appName).affiliate.notFound;
  const fullDict = getDictionary(lang, branding.appName);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
              <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{dict.title}</CardTitle>
          <CardDescription className="text-base">
            {dict.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-muted bg-muted/30 p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">{dict.reasons}</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600 dark:text-amber-500">•</span>
                <span>{dict.reason1}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600 dark:text-amber-500">•</span>
                <span>{dict.reason2}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600 dark:text-amber-500">•</span>
                <span>{dict.reason3}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href={`/${lang}/products`}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                {fullDict.shopOfficial}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/${lang}`}>
                <Home className="mr-2 h-4 w-4" />
                {dict.goHome}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

