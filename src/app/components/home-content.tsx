"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Leaf, Users, Award, HelpCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import ProductCard from "@/app/components/product-card";
import { OpportunitySection } from "@/modules/opportunity";
import { useLocaleContent, useLandingPageContent } from "@/contexts/locale-content-context";
import { useSiteBranding } from "@/contexts/site-branding-context";
import { useSupabaseUser } from "@/modules/auth/hooks/use-supabase-user";
import { useDetectCountry } from "@/modules/profile/hooks/use-detect-country";
import { sanitizeUserInput } from "@/lib/security/frontend-sanitization";
import { useFeaturedTeamMembers } from "@/modules/site-content/hooks/use-featured-team-members";
import { HeroDefault } from "@/app/components/hero/hero-default";
import { HeroModern } from "@/app/components/hero/hero-modern";
import { HeroMinimal } from "@/app/components/hero/hero-minimal";
import { AffiliateOpportunitySection } from "@/app/components/affiliate-opportunity-section";
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll";
import type { Product } from "@/lib/models/definitions";

interface HomeContentProps {
  lang: Locale;
  featuredProducts: any[];
}

const FALLBACK_HERO_IMAGE = "https://images.unsplash.com/photo-1464639351491-a172c2aa2911?auto=format&fit=crop&w=1400&q=80";

const FAQ_MAX_CHARS = 150;

function FaqCard({ faq }: { faq: { id?: string; question?: string; answer?: string; imageUrl?: string } }) {
  const question = faq.question ?? "";
  const answer = faq.answer ?? "";
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = answer.length > FAQ_MAX_CHARS;
  const displayText = expanded || !shouldTruncate 
    ? answer 
    : answer.slice(0, FAQ_MAX_CHARS) + "...";

  return (
    <div className="group flex h-full flex-col gap-4 rounded-[2rem] border border-border/50 bg-card p-8 shadow-md transition-all hover:shadow-xl hover:border-emerald-500/20 dark:bg-slate-900/60">
      <h3 className="text-lg font-bold text-foreground line-clamp-2">{question}</h3>
      <div className="min-h-[120px]">
        <p className="text-base leading-relaxed text-muted-foreground">{displayText}</p>
        {shouldTruncate && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
          >
            {expanded ? "Ver menos" : "Leer más..."}
          </button>
        )}
      </div>
      {faq.imageUrl ? (
        <div className="relative aspect-video overflow-hidden rounded-2xl shadow-sm">
          <Image
            src={faq.imageUrl}
            alt={question}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : null}
    </div>
  );
}

export default function HomeContent({
  lang,
  featuredProducts,
}: HomeContentProps) {
  const router = useRouter();
  const { dictionary } = useLocaleContent();
  const landing = dictionary.landing;
  const landingContent = useLandingPageContent();
  const { branding } = useSiteBranding();
  const supabaseUser = useSupabaseUser();
  const { country: userCountryCode } = useDetectCountry({ autoDetect: true });
  const { data: featuredTeam } = useFeaturedTeamMembers(lang);
  const [mounted, setMounted] = useState(false);

  // ✅ FIX: Filter products by country availability (respect admin's cart_visibility_countries config)
  const countryFilteredProducts = useMemo(() => {
    return (featuredProducts as Product[]).filter((product) => {
      // If cart_visibility_countries is not configured (null/undefined), show to everyone (legacy behavior)
      if (product.cart_visibility_countries === null || product.cart_visibility_countries === undefined) {
        return true;
      }

      // If cart_visibility_countries is an empty array, cart is DISABLED for all countries - hide product
      if (Array.isArray(product.cart_visibility_countries) && product.cart_visibility_countries.length === 0) {
        return false;
      }

      // Product HAS country restrictions configured by admin
      // If we can't detect user's country, hide the product (fail-safe: respect admin config)
      if (!userCountryCode) {
        return false;
      }

      // Normalize user country code for comparison
      const normalizedUserCountry = userCountryCode.trim().toUpperCase();

      // Normalize product's allowed countries and check if user's country is included
      const normalizedAllowedCountries = product.cart_visibility_countries
        .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : ''))
        .filter((code) => /^[A-Z]{2}$/.test(code));

      return normalizedAllowedCountries.includes(normalizedUserCountry);
    });
  }, [featuredProducts, userCountryCode]);

  const [displayedProducts, setDisplayedProducts] = useState(countryFilteredProducts.slice(0, 3));
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [contactError, setContactError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');

  // ✅ SECURITY: Fetch CSRF token on component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        setCsrfToken(data.token);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    };
    fetchCsrfToken();
  }, []);

  const heroTitle = landingContent.hero.title || landing.heroTitle;
  const heroSubtitle = landingContent.hero.subtitle || landing.heroSubtitle;
  const heroImage = landingContent.hero.backgroundImageUrl ?? FALLBACK_HERO_IMAGE;

  const aboutTitle = landingContent.about.title || landing.aboutTitle;
  const aboutText1 = landingContent.about.description || landing.aboutText1;
  const aboutText2 = landingContent.about.secondaryDescription || landing.aboutText2;
  const aboutImage = landingContent.about.imageUrl;

  const howItWorksTitle = landingContent.howItWorks.title || landing.howItWorksTitle;
  const howItWorksSubtitle = landingContent.howItWorks.subtitle || landing.howItWorksSubtitle;

  const opportunitySection = (landingContent.opportunity ?? landing.opportunitySection) as any;
  const testimonialsSection = landingContent.testimonials ?? landing.testimonialsSection;
  const featuredProductsSection = landingContent.featuredProducts ?? landing.featuredProductsSection;
  const contactSection = landingContent.contact ?? landing.contactSection;
  const contactFormCopy = contactSection.form;
  const isContactSubmitting = contactStatus === 'loading';
  const contactSuccessMessage = contactFormCopy.successMessage ?? 'Thanks for reaching out! We will contact you soon.';
  const contactErrorMessage = contactError ?? contactFormCopy.errorMessage ?? 'We could not send your message.';

  const resetContactForm = () => {
    setContactForm({ name: '', email: '', message: '' });
  };

  const handleContactFieldChange = (field: 'name' | 'email' | 'message', value: string) => {
    if (contactStatus !== 'idle') {
      setContactStatus('idle');
      setContactError(null);
    }
    setContactForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactStatus('loading');
    setContactError(null);

    try {
      // Get honeypot field value
      const formData = new FormData(event.currentTarget);
      const honeypot = formData.get('website') as string;

      // ✅ SECURITY: Include CSRF token in request
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          ...contactForm,
          locale: lang,
          website: honeypot || '', // Include honeypot field
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const rawMessage = body?.error ?? contactFormCopy.errorMessage ?? 'We could not send your message.';
        // ✅ SECURITY: Sanitize error message before displaying
        const message = sanitizeUserInput(rawMessage);
        throw new Error(message);
      }

      setContactStatus('success');
      resetContactForm();
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : contactFormCopy.errorMessage ?? 'We could not send your message.';
      // ✅ SECURITY: Sanitize error message before displaying
      const message = sanitizeUserInput(rawMessage);
      setContactError(message);
      setContactStatus('error');
    }
  };

  const steps = useMemo(() => {
    if (landingContent.howItWorks.steps.length === 0) {
      return [
        { label: "01", title: landing.howItWorks.step1Title, description: landing.howItWorks.step1Desc },
        { label: "02", title: landing.howItWorks.step2Title, description: landing.howItWorks.step2Desc },
        { label: "03", title: landing.howItWorks.step3Title, description: landing.howItWorks.step3Desc },
      ];
    }

    return landingContent.howItWorks.steps.map((step, index) => ({
      label: String(index + 1).padStart(2, '0'),
      title: step.title,
      description: step.description,
    }));
  }, [landing.howItWorks, landingContent.howItWorks.steps]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    setMounted(true);
    if (!supabaseUser.isLoading && supabaseUser.isAuthenticated) {
      router.replace(`/${lang}/dashboard`);
    }
  }, [supabaseUser.isLoading, supabaseUser.isAuthenticated, lang, router]);

  // Update displayed products when country filtered products change
  useEffect(() => {
    setDisplayedProducts(countryFilteredProducts.slice(0, 3));
  }, [countryFilteredProducts]);

  useEffect(() => {
    if (countryFilteredProducts.length <= 3) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 3) % countryFilteredProducts.length;
      const nextProducts: typeof countryFilteredProducts = [];
      for (let i = 0; i < 3; i++) {
        nextProducts.push(countryFilteredProducts[(currentIndex + i) % countryFilteredProducts.length]);
      }
      setDisplayedProducts(nextProducts);
    }, 5000);

    return () => clearInterval(interval);
  }, [countryFilteredProducts]);

  // Show loading state while checking authentication
  if (mounted && supabaseUser.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  // Redirect is happening, show loading
  if (mounted && supabaseUser.isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Redirecting" />
      </div>
    );
  }

  if (!landing) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background text-muted-foreground">
        <p>Landing copy is missing in the translation dictionary.</p>
      </div>
    );
  }

  const heroStyle = (landingContent.hero as any).style || 'default';

  const HeroComponent = {
    modern: HeroModern,
    minimal: HeroMinimal,
    default: HeroDefault,
  }[heroStyle as 'modern' | 'minimal' | 'default'] || HeroDefault;

  return (
    <div className="flex flex-col gap-20 pb-24 pt-12 overflow-x-hidden">
      {/* Hero */}
      <HeroComponent
        title={heroTitle}
        subtitle={heroSubtitle}
        backgroundImageUrl={heroImage}
        backgroundColor={(landingContent.hero as any).backgroundColor}
        branding={branding}
        dictionary={landing}
        lang={lang}
      />

      {/* Highlights */}
      <section className="container mx-auto px-4">
        <RevealOnScroll animation="fade-up" delay={100}>
          <div className="mx-auto grid w-full max-w-5xl gap-8 rounded-[2.5rem] border border-border/40 bg-gradient-to-br from-card/80 to-card/40 p-8 shadow-2xl backdrop-blur-md md:grid-cols-3 md:p-12 dark:bg-slate-900/60">
            {[
              {
                icon: Leaf,
                title: aboutTitle,
                description: aboutText1,
              },
              {
                icon: Users,
                title: howItWorksTitle,
                description: howItWorksSubtitle,
              },
              {
                icon: Award,
                title: testimonialsSection.title,
                description: testimonialsSection.testimonials[0]?.quote ?? '',
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="group flex flex-col gap-4 rounded-2xl p-4 transition-all duration-300 hover:bg-emerald-500/5 hover:translate-y-[-4px]">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 dark:bg-emerald-500/20 dark:text-emerald-200">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="text-xl font-bold text-foreground transition-colors group-hover:text-emerald-600">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </section>

      {/* About */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 md:grid-cols-2">
        <RevealOnScroll animation="slide-in-left" duration={800}>
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              Sobre Nosotros
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">{aboutTitle}</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">{aboutText1}</p>
            <p className="text-lg leading-relaxed text-muted-foreground">{aboutText2}</p>
          </div>
        </RevealOnScroll>
        <RevealOnScroll animation="zoom-in" delay={200} duration={800}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-2xl transition-transform duration-500 hover:scale-[1.02] hover:shadow-emerald-500/20">
            <Image
              src={aboutImage ?? "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"}
              alt="Community"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 hover:scale-110"
              loading="lazy"
              quality={85}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        </RevealOnScroll>
      </section>

      {/* Affiliate Opportunity Section */}
      {landingContent.affiliateOpportunity && landingContent.affiliateOpportunity.isEnabled && (
        <RevealOnScroll animation="fade-up" threshold={0.1}>
          <AffiliateOpportunitySection 
            content={landingContent.affiliateOpportunity} 
            lang={lang} 
          />
        </RevealOnScroll>
      )}

      {/* How it works */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl space-y-16 px-4">
        <RevealOnScroll animation="fade-up">
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">{howItWorksTitle}</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{howItWorksSubtitle}</p>
          </div>
        </RevealOnScroll>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <RevealOnScroll key={step.label} animation="fade-up" delay={i * 150}>
              <div className="group relative flex flex-col gap-6 rounded-3xl border border-border/50 bg-card p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:border-emerald-500/30 dark:bg-slate-900/60">
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl transition-all group-hover:bg-emerald-500/10" />
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-600 shadow-sm transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/20 dark:text-emerald-200">
                  {step.label}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-emerald-600 transition-colors">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {opportunitySection ? (
        <RevealOnScroll animation="fade-up" threshold={0.1}>
          <OpportunitySection content={opportunitySection} />
        </RevealOnScroll>
      ) : null}

      {/* Testimonials */}
      <section className="mx-auto w-full max-w-6xl space-y-12 px-4">
        <RevealOnScroll animation="fade-up">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">{testimonialsSection.title}</h2>
          </div>
        </RevealOnScroll>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonialsSection.testimonials.map((testimonial, i) => (
            <RevealOnScroll key={testimonial.id} animation="fade-up" delay={i * 100}>
              <figure className="group flex h-full flex-col gap-6 rounded-[2rem] border border-border/50 bg-card p-8 shadow-lg transition-all duration-300 hover:shadow-2xl hover:border-emerald-500/20 dark:bg-slate-900/60">
                <div className="text-emerald-500 opacity-50">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21L14.017 18C14.017 16.082 15.435 13.697 19.318 10.272C19.8341 10.012 21 8 21 8H16.329C16.329 7.061 16.333 5.091 17.463 3H22V11C22 16.868 18.239 21 14.017 21ZM5 21L5 18C5 16.082 6.435 13.697 10.318 10.272C10.8341 10.012 12 8 12 8H7.329C7.329 7.061 7.333 5.091 8.463 3H13V11C13 16.868 9.239 21 5 21Z"/></svg>
                </div>
                <blockquote className="text-lg leading-relaxed text-muted-foreground">{testimonial.quote}</blockquote>
                <figcaption className="mt-auto flex items-center gap-4 border-t border-border/50 pt-6">
                   {testimonial.imageUrl ? (
                     <Image
                       src={testimonial.imageUrl}
                       alt={testimonial.name}
                       width={40}
                       height={40}
                       className="h-10 w-10 rounded-full object-cover"
                     />
                   ) : (
                     <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500" />
                   )}
                   <div>
                      <span className="block font-bold text-foreground">{testimonial.name}</span>
                      {testimonial.role ? <span className="text-sm text-muted-foreground">{testimonial.role}</span> : null}
                   </div>
                </figcaption>
              </figure>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section id="featured-products" className="mx-auto w-full max-w-6xl space-y-12 px-4">
        <RevealOnScroll animation="fade-up">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">{featuredProductsSection.title}</h2>
              <p className="mt-2 text-xl text-muted-foreground">{featuredProductsSection.subtitle}</p>
            </div>
            <Button asChild variant="outline" className="rounded-full px-6 transition-transform hover:scale-105">
              <Link href={`/${lang}/products`}>{dictionary.products?.allProducts ?? "All Products"}</Link>
            </Button>
          </div>
        </RevealOnScroll>
        {displayedProducts.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-3">
            {displayedProducts.map((product, i) => (
              <RevealOnScroll key={product.id} animation="fade-up" delay={i * 100}>
                <div className="group h-full transition-transform duration-300 hover:-translate-y-2">
                  <ProductCard
                    product={product}
                    lang={lang}
                    variant="landingHighlight"
                  />
                </div>
              </RevealOnScroll>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{featuredProductsSection.emptyState}</p>
        )}
      </section>

      {/* Team Section */}
      {featuredTeam && featuredTeam.members.length > 0 ? (
        <section id="team" className="mx-auto w-full max-w-6xl space-y-12 px-4">
          <RevealOnScroll animation="fade-up">
            <div className="max-w-2xl text-center mx-auto">
              <Link href={`/${lang}/company-team`} className="group inline-block">
                <h2 className="text-3xl font-bold text-foreground md:text-4xl lg:text-5xl transition-colors hover:text-emerald-600 cursor-pointer">
                  {featuredTeam.title}
                </h2>
              </Link>
              <p className="mt-4 text-lg text-muted-foreground">{featuredTeam.subtitle}</p>
            </div>
          </RevealOnScroll>
          <div className={`grid gap-8 ${featuredTeam.members.length === 1
            ? 'grid-cols-1 max-w-sm mx-auto'
            : featuredTeam.members.length === 2
              ? 'md:grid-cols-2 max-w-3xl mx-auto'
              : featuredTeam.members.length === 3
                ? 'md:grid-cols-3'
                : 'md:grid-cols-4'
            }`}>
            {featuredTeam.members.map((member, i) => (
              <RevealOnScroll key={member.id} animation="zoom-in" delay={i * 100}>
                <div className="group h-full flex flex-col items-center gap-6 rounded-[2.5rem] border border-border/50 bg-card p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-emerald-500/30 dark:bg-slate-900/60 text-center">
                  {member.imageUrl ? (
                    <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-full border-4 border-card shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:border-emerald-500">
                      <Image
                        src={member.imageUrl}
                        alt={member.name}
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 border-4 border-card group-hover:border-emerald-500 transition-colors">
                      <Users className="h-16 w-16 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col justify-start space-y-2">
                    <h3 className="text-lg font-bold text-foreground line-clamp-1">{member.name}</h3>
                    <p className="text-sm font-medium text-emerald-600 line-clamp-1">{member.role}</p>
                    {member.description ? (
                      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">{member.description}</p>
                    ) : null}
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {landingContent.faqs.length > 0 ? (
        <section id="faq" className="mx-auto w-full max-w-6xl space-y-12 px-4">
          <RevealOnScroll animation="fade-up">
            <div className="flex flex-col gap-4 text-left md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-3 text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400">
                     <HelpCircle className="h-6 w-6" />
                  </span>
                  {landing.faqTitle ?? dictionary.landing.faqTitle}
                </h2>
                <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                  {landing.faqSubtitle ?? dictionary.landing.faqSubtitle}
                </p>
              </div>
            </div>
          </RevealOnScroll>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {landingContent.faqs.map((faq, i) => (
              <RevealOnScroll key={faq.id} animation="fade-up" delay={i * 50}>
                <FaqCard faq={faq} />
              </RevealOnScroll>
            ))}
          </div>
        </section>
      ) : null}

      {/* Contact */}
      <section id="contact" className="mx-auto w-full max-w-6xl px-4">
        <RevealOnScroll animation="zoom-in" duration={800}>
          <div className="grid gap-12 rounded-[3rem] bg-slate-950 px-8 py-16 text-white shadow-2xl md:grid-cols-2 md:px-16 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="space-y-8 relative z-10">
              <div>
                <h2 className="text-3xl font-bold md:text-4xl lg:text-5xl mb-4">{contactSection.title}</h2>
                <p className="text-lg text-white/80 leading-relaxed">{contactSection.description}</p>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <p className="font-medium">{contactSection.contactInfo.phone}</p>
                </div>
                <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="font-medium">{contactSection.contactInfo.email}</p>
                </div>
                <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <p className="font-medium">{contactSection.contactInfo.address}</p>
                </div>
              </div>
            </div>
            <form className="space-y-5 relative z-10" onSubmit={handleContactSubmit} noValidate>
              {/* Honeypot field - hidden from users, only bots will fill it */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="absolute -left-[9999px] w-px h-px"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-white ml-1" htmlFor="contact-name">
                  {contactSection.form.nameLabel ?? contactSection.form.namePlaceholder}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={180}
                  placeholder={contactSection.form.namePlaceholder}
                  value={contactForm.name}
                  onChange={(event) => handleContactFieldChange('name', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-white/40 focus:border-emerald-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  disabled={isContactSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white ml-1" htmlFor="contact-email">
                  {contactSection.form.emailLabel ?? contactSection.form.emailPlaceholder}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  maxLength={180}
                  placeholder={contactSection.form.emailPlaceholder}
                  value={contactForm.email}
                  onChange={(event) => handleContactFieldChange('email', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-white/40 focus:border-emerald-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  disabled={isContactSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white ml-1" htmlFor="contact-message">
                  {contactSection.form.messageLabel ?? contactSection.form.messagePlaceholder}
                </label>
                <textarea
                  id="contact-message"
                  required
                  minLength={10}
                  maxLength={4000}
                  placeholder={contactSection.form.messagePlaceholder}
                  value={contactForm.message}
                  onChange={(event) => handleContactFieldChange('message', event.target.value)}
                  className="h-40 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-white/40 focus:border-emerald-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                  disabled={isContactSubmitting}
                />
              </div>
              <div className="space-y-4 pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="flex w-full h-14 items-center justify-center gap-2 rounded-full bg-white text-base font-bold text-slate-950 hover:bg-emerald-50 hover:scale-[1.02] transition-all shadow-lg shadow-white/5"
                  disabled={isContactSubmitting}
                >
                  {isContactSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      {contactSection.form.sendingLabel ?? contactSection.form.sendButton}
                    </>
                  ) : (
                    contactSection.form.sendButton
                  )}
                </Button>
                <div className="min-h-[3rem] rounded-2xl bg-white/5 px-4 py-3 text-sm backdrop-blur-sm border border-white/5" aria-live="polite" role="status">
                  {contactStatus === 'success' ? (
                    <div className="flex items-center gap-2 text-emerald-300">
                      <CheckCircle2 className="h-5 w-5" />
                      <p>{contactSuccessMessage}</p>
                    </div>
                  ) : contactStatus === 'error' ? (
                    <p className="text-red-300">{contactErrorMessage}</p>
                  ) : (
                    <p className="text-white/60 text-center">{contactSection.form.helperText ?? ''}</p>
                  )}
                </div>
              </div>
            </form>
          </div>
        </RevealOnScroll>
      </section>
    </div>
  );
}
