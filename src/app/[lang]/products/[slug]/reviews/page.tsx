
import { notFound } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { logUserAction } from '@/lib/services/audit-log-service';
import type { Product } from '@/lib/models/definitions';
import { createProductModule } from '@/modules/products/factories/product-module';
import ProductReviewsClient from './product-reviews-client';

interface Props {
  params: Promise<{ lang: Locale; slug: string }>;
}

const getProduct = async (slug: string): Promise<Product> => {
  const { repository } = createProductModule();
  const product = await repository.getBySlug(slug);

  if (!product) {
    notFound();
  }

  return product;
};

const logReviewVisit = async (product: Product, slug: string) => {
  try {
    await logUserAction('VIEW_PRODUCT_REVIEWS', 'product', product.id, {
      productName: product.name,
      slug,
    });
  } catch (error) {
    console.error('Failed to record product review audit log', error);
  }
};

export default async function ProductReviewsPage({ params }: Props) {
  const { lang, slug } = await params;
  const product = await getProduct(slug);

  await logReviewVisit(product, slug);

  return <ProductReviewsClient product={product} lang={lang} />;
}
