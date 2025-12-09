'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Gift, Store, TrendingUp, Percent, Wallet, Star, Users, ShoppingBag, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AffiliateOpportunitySection as AffiliateOpportunitySectionType } from '@/modules/site-content/domain/models/landing-content';

interface AffiliateOpportunitySectionProps {
  content: AffiliateOpportunitySectionType;
  lang: string;
}

// Map icon names to Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  gift: Gift,
  store: Store,
  'trending-up': TrendingUp,
  percent: Percent,
  wallet: Wallet,
  star: Star,
  users: Users,
  'shopping-bag': ShoppingBag,
};

export function AffiliateOpportunitySection({ content, lang }: AffiliateOpportunitySectionProps) {
  if (!content.isEnabled) return null;

  // Using Tailwind's emerald-500 (#10b981) for accent color
  const isSpanish = lang === 'es';
  
  const badgeText = isSpanish 
    ? { title: 'Programa Verificado', subtitle: 'Únete a exitosos afiliados' } 
    : { title: 'Verified Program', subtitle: 'Join successful affiliates' };
    
  const exclusiveText = isSpanish ? 'Oportunidad Exclusiva' : 'Exclusive Opportunity';

  return (
    <section id="affiliate-opportunity" className="relative py-20 lg:py-32 overflow-hidden bg-background">

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          
          {/* Text Content */}
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm shadow-sm">
                <Star className="mr-2 h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                <span className="font-medium text-muted-foreground">{exclusiveText}</span>
              </div>
              
              <h2 className="text-3xl font-bold tracking-tighter text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
                {content.title}
              </h2>
              
              <p className="max-w-[600px] text-lg text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed leading-relaxed">
                {content.subtitle}
              </p>
              
              {content.description && (
                <p className="text-muted-foreground text-base leading-relaxed max-w-lg">
                  {content.description}
                </p>
              )}
            </div>

            {/* Commission Card */}
            {content.commissionRate && (
              <div className="flex items-center gap-4 rounded-2xl bg-card p-4 border border-border max-w-md shadow-lg transition-transform hover:scale-[1.02]">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
                  <Percent className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight text-foreground">{content.commissionRate}</p>
                  {content.commissionLabel && (
                    <p className="text-sm font-medium text-muted-foreground">{content.commissionLabel}</p>
                  )}
                </div>
              </div>
            )}

            {/* Benefits Grid */}
            {content.benefits && content.benefits.length > 0 && (
              <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 mt-4">
                {content.benefits
                  .sort((a, b) => a.order - b.order)
                  .map((benefit) => {
                    const IconComponent = benefit.icon ? iconMap[benefit.icon] || Gift : Gift;
                    return (
                      <div key={benefit.id} className="flex gap-3 items-start group">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition-all duration-300 group-hover:scale-110">
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-semibold text-foreground leading-tight">{benefit.title}</h3>
                          <p className="text-sm text-muted-foreground leading-snug">{benefit.description}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row pt-6">
              <Button 
                asChild 
                size="lg" 
                className="h-14 px-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 transition-all duration-300 font-bold text-base shadow-xl hover:shadow-2xl"
              >
                <Link href={content.ctaLink.startsWith('/') ? `/${lang}${content.ctaLink}` : content.ctaLink}>
                  {content.ctaText}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Image / Visual */}
          <div className="relative order-1 lg:order-2 flex justify-center lg:justify-end mb-8 lg:mb-0">
            {content.imageUrl ? (
              <div className="relative aspect-[4/5] w-full max-w-sm md:max-w-md lg:max-w-full rounded-3xl overflow-hidden shadow-2xl lg:rotate-3 lg:hover:rotate-0 transition-all duration-500 group border border-border">
                <Image
                  src={content.imageUrl}
                  alt={content.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
                
                {/* Floating Badge */}
                <div className="absolute bottom-6 left-6 right-6 z-20 transform transition-transform duration-300 group-hover:translate-y-[-5px]">
                   <div className="backdrop-blur-xl bg-background/80 border border-border rounded-2xl p-4 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-md bg-emerald-500 text-white">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{badgeText.title}</p>
                          <p className="text-xs text-muted-foreground">{badgeText.subtitle}</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="relative aspect-square w-full max-w-md rounded-[2rem] bg-card border-2 border-border flex items-center justify-center p-12 shadow-2xl">
                <Store className="w-32 h-32 text-muted-foreground/20 animate-pulse" />
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
