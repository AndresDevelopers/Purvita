'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
// import Link from 'next/link'; // Unused
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { UserCircle, ShoppingBag, UserPlus, ArrowRight } from 'lucide-react';
import ProductCard from '@/app/components/product-card';
import { PersonalizedRecommendations } from '@/components/affiliate/personalized-recommendations';
import type { Locale } from '@/i18n/config';
import type { Product } from '@/lib/models/definitions';
import type { AppDictionary } from '@/i18n/dictionaries';
import { useReferralTracking } from '@/contexts/referral-tracking-context';
import { supabase } from '@/lib/supabase';

interface Sponsor {
  id: string;
  name: string | null;
  referralCode: string;
  // email is intentionally excluded for security (not exposed to client)
}

interface Customization {
  storeTitle?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
}

interface AffiliatePageClientProps {
  lang: Locale;
  sponsor: Sponsor;
  products: Product[];
  dictionary: AppDictionary;
  customization: Customization;
}

export function AffiliatePageClient({ lang, sponsor, products, dictionary, customization }: AffiliatePageClientProps) {
  const router = useRouter();
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { setReferralTracking } = useReferralTracking();

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Track the referral when the page loads
  useEffect(() => {
    setReferralTracking(sponsor.referralCode, sponsor.id);
  }, [sponsor.referralCode, sponsor.id, setReferralTracking]);

  const displayedProducts = useMemo(() => {
    return showAllProducts ? products : products.slice(0, 6);
  }, [products, showAllProducts]);

  const sponsorDisplayName = sponsor.name || 'Affiliate Partner';

  const handleRegisterClick = () => {
    router.push(`/${lang}/affiliate/${sponsor.referralCode}/register`);
  };

  const dict = dictionary;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Custom Banner (if set) */}
      {customization.bannerUrl && (
        <div className="relative h-64 w-full overflow-hidden md:h-80 lg:h-96">
          <Image
            src={customization.bannerUrl}
            alt="Store banner"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
          {customization.storeTitle && (
            <div className="absolute inset-0 flex items-center justify-center">
              <h1 className="font-headline text-4xl font-bold text-white drop-shadow-lg md:text-5xl lg:text-6xl">
                {customization.storeTitle}
              </h1>
            </div>
          )}
        </div>
      )}

      {/* Hero Section with Sponsor Info - Only show if no banner */}
      {!customization.bannerUrl && (
        <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-primary/5">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="mx-auto max-w-4xl text-center">
              {/* Store Title or Sponsor Name */}
              <h1 className="mb-4 font-headline text-4xl font-bold tracking-tight md:text-5xl">
                {customization.storeTitle ||
                  dict.affiliate?.welcomeTitle?.replace('{{name}}', sponsorDisplayName) ||
                  `Welcome to ${sponsorDisplayName}'s Store`}
              </h1>

              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                {dict.affiliate?.welcomeSubtitle ||
                  'Discover amazing products and join our community'}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                {!isAuthenticated && (
                  <Button
                    size="lg"
                    onClick={handleRegisterClick}
                    className="group gap-2 px-8 shadow-lg transition-all hover:shadow-xl"
                  >
                    <UserPlus className="h-5 w-5" />
                    {dict.affiliate?.joinNow || 'Join Now'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const productsSection = document.getElementById('products-section');
                    productsSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="gap-2 px-8 self-center"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {dict.affiliate?.viewProducts || 'View Products'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Buttons Section - Show when banner exists */}
      {customization.bannerUrl && (
        <section className="border-b bg-background py-12">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                {dict.affiliate?.welcomeSubtitle ||
                  'Discover amazing products and join our community'}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                {!isAuthenticated && (
                  <Button
                    size="lg"
                    onClick={handleRegisterClick}
                    className="group gap-2 px-8 shadow-lg transition-all hover:shadow-xl"
                  >
                    <UserPlus className="h-5 w-5" />
                    {dict.affiliate?.joinNow || 'Join Now'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const productsSection = document.getElementById('products-section');
                    productsSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="gap-2 px-8 self-center"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {dict.affiliate?.viewProducts || 'View Products'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      <section id="products-section" className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-headline text-3xl font-bold md:text-4xl">
              {dict.affiliate?.productsTitle || 'Featured Products'}
            </h2>
            <p className="text-lg text-muted-foreground">
              {dict.affiliate?.productsSubtitle || 'Browse our selection of quality products'}
            </p>
          </div>

          {products.length > 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {displayedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lang={lang}
                    variant="affiliate"
                    affiliateCode={sponsor.referralCode}
                  />
                ))}
              </div>

              {products.length > 6 && !showAllProducts && (
                <div className="mt-12 flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowAllProducts(true)}
                    className="gap-2"
                  >
                    {dict.affiliate?.showMore || 'Show More Products'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="mx-auto max-w-xl">
              <CardContent className="p-12 text-center">
                <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-xl font-semibold">
                  {dict.affiliate?.noProducts || 'No products available'}
                </h3>
                <p className="text-muted-foreground">
                  {dict.affiliate?.noProductsDescription || 'Check back soon for new products'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Personalized Recommendations Section - Only for authenticated users */}
      {isAuthenticated && products.length > 0 && (
        <section className="border-t bg-muted/20 py-16">
          <div className="container mx-auto px-4">
            <PersonalizedRecommendations
              lang={lang}
              affiliateCode={sponsor.referralCode}
              excludeProductIds={products.slice(0, 6).map(p => p.id)}
              limit={4}
            />
          </div>
        </section>
      )}

      {/* Join CTA Section - Only show when user is NOT authenticated */}
      {!isAuthenticated && (
        <section className="border-t bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <Card className="mx-auto max-w-3xl border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-xl">
              <CardHeader className="text-center">
                <CardTitle className="font-headline text-3xl">
                  {dict.affiliate?.joinCtaTitle || 'Ready to Get Started?'}
                </CardTitle>
                <CardDescription className="text-base">
                  {dict.affiliate?.joinCtaDescription ||
                    'Join our community and start enjoying exclusive benefits'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <div className="mb-2 flex justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <UserPlus className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <h4 className="mb-1 font-semibold">
                      {dict.affiliate?.step1Title || 'Sign Up'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {dict.affiliate?.step1Description || 'Create your free account'}
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="mb-2 flex justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <ShoppingBag className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <h4 className="mb-1 font-semibold">
                      {dict.affiliate?.step2Title || 'Shop'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {dict.affiliate?.step2Description || 'Browse and purchase products'}
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="mb-2 flex justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <h4 className="mb-1 font-semibold">
                      {dict.affiliate?.step3Title || 'Grow'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {dict.affiliate?.step3Description || 'Build your network'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleRegisterClick}
                    className="group gap-2 px-12 shadow-lg transition-all hover:shadow-xl"
                  >
                    <UserPlus className="h-5 w-5" />
                    {dict.affiliate?.registerButton || 'Register Now'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
