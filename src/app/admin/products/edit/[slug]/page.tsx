'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductForm } from '../../product-form';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/models/definitions';
import { useSiteBranding } from '@/contexts/site-branding-context';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function EditProductPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading product...</div>}>
      <EditProductPageContent />
    </Suspense>
  );
}

function EditProductPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const lang = (searchParams.get('lang') as Locale) || 'en';
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const response = await fetch(`/api/products/${slug}`, { cache: 'no-store' });
        if (!response.ok) {
          if (response.status === 404) {
            setError('Producto no encontrado');
          } else {
            setError('Error al cargar el producto');
          }
        } else {
          const fetchedProduct = await response.json();
          setProduct(fetchedProduct);
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Error al cargar el producto');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/admin/products?lang=${lang}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {dict.admin.backToProducts}
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div>
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/admin/products?lang=${lang}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {dict.admin.backToProducts}
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p>Producto no encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <CardTitle className="font-headline text-2xl">{dict.admin.editProduct}</CardTitle>
          <CardDescription>{dict.admin.editProductDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm lang={lang} product={product} />
        </CardContent>
      </Card>
    </div>
  );
}
