import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductForm } from '../product-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ lang?: Locale }> }) {
  const params = await searchParams;
  const lang = params.lang || 'en';
  const dict = await getLocalizedDictionary(lang as Locale);

  return (
    <div>
      <Button variant="ghost" asChild className="mb-4">
        <Link href={`/admin/products?lang=${lang}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {dict.admin.backToProducts}
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{dict.admin.addNewProduct}</CardTitle>
          <CardDescription>{dict.admin.addNewProductDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm lang={lang} />
        </CardContent>
      </Card>
    </div>
  );
}
