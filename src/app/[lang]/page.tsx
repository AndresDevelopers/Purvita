import HomeContent from '@/app/components/home-content';
import { getFeaturedProducts } from '@/lib/services/product-service';
import type { Locale } from '@/i18n/config';

export const revalidate = 0; // Set to 0 during development to see changes immediately

export default async function Home({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const featuredProducts = await getFeaturedProducts(12);
  return (
    <HomeContent lang={lang} featuredProducts={featuredProducts} />
  );
}


