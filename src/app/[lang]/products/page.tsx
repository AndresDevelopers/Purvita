import type { Locale } from '@/i18n/config';
import type { Product } from '@/lib/models/definitions';
import { getProducts } from '@/lib/services/product-service';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import ProductCatalogExperience from '@/modules/products/ui/product-catalog-experience';
import { PersonalizedRecommendations } from '@/components/products/personalized-recommendations';

export default async function ProductsPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const dict = await getLocalizedDictionary(lang);

  let products: Product[] = [];
  let hasError = false;

  try {
    products = await getProducts();
  } catch (error) {
    hasError = true;
    console.error('ProductsPage: error loading products', error);
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-headline">{dict.products.title}</h1>
        <p className="text-lg text-muted-foreground mt-2">{dict.products.subtitle}</p>
      </div>
      {products.length > 0 ? (
        <ProductCatalogExperience products={products} lang={lang} dictionary={dict.products} />
      ) : (
        <div className="mx-auto max-w-xl text-center rounded-3xl border border-dashed border-border p-8">
          <h2 className="text-2xl font-semibold font-headline">
            {hasError ? dict.products.errorTitle : dict.products.emptyTitle}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {hasError ? dict.products.errorDescription : dict.products.emptyDescription}
          </p>
        </div>
      )}

      {/* Personalized Recommendations */}
      <PersonalizedRecommendations
        lang={lang}
        excludeProductIds={products.slice(0, 6).map(p => p.id)}
        limit={4}
      />
    </div>
  );
}
