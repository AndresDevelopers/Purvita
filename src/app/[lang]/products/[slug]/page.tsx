import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { logUserAction } from '@/lib/services/audit-log-service';
import type { Product } from '@/lib/models/definitions';
import { createProductModule } from '@/modules/products/factories/product-module';
import { ProductDetailClient } from './product-detail-client';
import { StructuredDataScript } from '@/components/seo/structured-data-script';
import { generateProductSchema } from '@/lib/seo/structured-data-generators';
import { getAppUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string; lang: Locale }>;
}

async function getProductData(slug: string): Promise<{ product: Product; related: Product[] }> {
  const { repository } = createProductModule();
  const product = await repository.getBySlug(slug);

  if (!product) {
    notFound();
  }

  const related = await repository.listRelated(slug);

  return { product, related };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, lang } = await params;
  const { product } = await getProductData(slug);
  const baseUrl = getAppUrl();

  // Get featured image or first image
  const featuredImage = product.images?.find(img => img.isFeatured) || product.images?.[0];
  const ogImage = featuredImage?.url || `${baseUrl}/og-products.jpg`;

  // Truncate description for meta
  const description = product.description?.substring(0, 160) || `${product.name} - Premium wellness product`;

  return {
    title: `${product.name} | PūrVita Network`,
    description,
    openGraph: {
      title: product.name,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      url: `${baseUrl}/${lang}/products/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: [ogImage],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug, lang } = await params;
  const { product, related } = await getProductData(slug);

  try {
    await logUserAction('VIEW_PRODUCT', 'product', product.id, {
      productName: product.name,
      slug,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to record product view audit log', error);
    }
  }

  // Generate Product Schema.org structured data
  const baseUrl = getAppUrl();
  const productSchema = generateProductSchema(product, lang, baseUrl);

  return (
    <>
      <StructuredDataScript json={productSchema} />
      <ProductDetailClient product={product} relatedProducts={related} lang={lang} />
    </>
  );
}
