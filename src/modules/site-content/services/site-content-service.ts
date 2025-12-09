import { cache } from 'react';
import { z } from 'zod';
import type { Locale } from '@/i18n/config';
import { i18n } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { DEFAULT_APP_NAME } from '@/lib/config/app-config';
import { isBuildSmokeTestEnabled } from '@/lib/env/test-flags';
import { extractStoragePathFromUrl } from '@/lib/utils';
import { supabase, PAGE_BUCKET } from '@/lib/supabase';
import {
  createDefaultBranding,
  SiteBrandingSchema,
  SiteBrandingUpdateSchema,
  type SiteBranding,
  type SiteBrandingUpdateInput,
} from '../domain/models/site-branding';
import type { AffiliatePageConfig } from '../domain/models/affiliate-page-config';
import {
  LandingContentPayloadSchema,
  LandingContentSchema,
  LandingFaqSchema,
  LandingFeaturedProductsSectionSchema,
  LandingOpportunityPhaseSchema,
  LandingOpportunitySectionSchema,
  LandingContactSectionSchema,
  LandingStepSchema,
  LandingTestimonialSchema,
  LandingTestimonialsSectionSchema,
  LandingTeamSectionSchema,
  LandingHeaderContentSchema,
  LandingHeaderLinkSchema,
  LandingFooterContentSchema,
  LandingFooterLinkSchema,
  LandingFooterSocialSchema,
  AffiliateOpportunitySectionSchema,
  sortFaqsByOrder,
  sortStepsByOrder,
  sortTestimonialsByOrder,
  sortHeaderLinksByOrder,
  sortFooterLinksByOrder,
  sortFooterSocialByOrder,
  type LandingContent,
  type LandingContentPayload,
  type LandingContentRecord,
  type LandingFeaturedProductsSection,
  type LandingOpportunityPhase,
  type LandingOpportunitySection,
  type LandingContactSection,
  type LandingTestimonialsSection,
  type LandingTeamSection,
  type LandingHeaderContent,
  type LandingFooterContent,
  type AffiliateOpportunitySection,
} from '../domain/models/landing-content';
import { createSiteContentModule } from '../factories/site-content-module';
import { getAllPlans } from '@/lib/services/plan-service';
import { getPhaseLevels } from '@/modules/phase-levels/services/phase-level-service';

type CacheableFn<TArgs extends unknown[], TResult> = ((...args: TArgs) => Promise<TResult>) & {
  clear?: () => void;
};

const normalizeOptional = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1464639351491-a172c2aa2911?auto=format&fit=crop&w=1400&q=80';
const DEFAULT_ABOUT_IMAGE =
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80';

/**
 * Replace dynamic tokens in text with actual values from phase level
 */
const replaceDynamicTokens = (text: string, phaseLevel: any, monthlyFeeAmount: string): string => {
  if (!text) return text;

  const freeProductValue = (phaseLevel.freeProductValueCents / 100).toFixed(0);
  const walletCredit = (phaseLevel.creditCents / 100).toFixed(0);
  const commissionRate = (phaseLevel.commissionRate * 100).toFixed(0);

  return text
    .replace(/\{\{price\}\}/g, monthlyFeeAmount)
    .replace(/\{\{freeProductValue\}\}/g, freeProductValue)
    .replace(/\{\{walletCredit\}\}/g, walletCredit)
    .replace(/\{\{commissionRate\}\}/g, commissionRate);
};

/**
 * Build landing page phases from phase_levels table
 * This makes all $ and % values dynamic based on admin configuration
 */
const buildPhasesFromPhaseLevels = async (
  locale: Locale,
  monthlyFeeAmount: string,
): Promise<LandingOpportunityPhase[]> => {
  try {
    // getPhaseLevels() already filters by is_active = true
    // So we only get phases that admin marked as visible
    const phaseLevels = await getPhaseLevels();

    return phaseLevels
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((phaseLevel, index) => {
        const isEnglish = locale === 'en';

        // Get localized content
        const title = `Phase ${phaseLevel.level} · ${isEnglish ? phaseLevel.nameEn || phaseLevel.name : phaseLevel.nameEs || phaseLevel.name}`;
        const descriptor = isEnglish ? phaseLevel.descriptorEn : phaseLevel.descriptorEs;
        const requirement = isEnglish ? phaseLevel.requirementEn : phaseLevel.requirementEs;
        const rewards = isEnglish ? phaseLevel.rewardsEn : phaseLevel.rewardsEs;
        const visibilityTag = isEnglish ? phaseLevel.visibilityTagEn : phaseLevel.visibilityTagEs;

        // Build commission highlight
        const commissionPercent = (phaseLevel.commissionRate * 100).toFixed(0);
        const commissionHighlight = isEnglish
          ? `E-commerce commission: ${commissionPercent}% per sale`
          : `Comisión de e-commerce: ${commissionPercent}% por venta`;

        // Build account balance highlight (only if there's wallet credit)
        let accountBalanceHighlight: string | null = null;
        if (phaseLevel.creditCents > 0) {
          const walletCredit = (phaseLevel.creditCents / 100).toFixed(0);
          accountBalanceHighlight = isEnglish
            ? `Wallet balance after Phase ${phaseLevel.level}: $${walletCredit}`
            : `Saldo de billetera después de Fase ${phaseLevel.level}: $${walletCredit}`;
        }

        // Build monthly investment text
        const monthlyInvestment = isEnglish
          ? `Monthly commitment: $${monthlyFeeAmount}`
          : `Compromiso mensual: $${monthlyFeeAmount}`;

        // Default values if fields are empty (migration not applied yet)
        const defaultDescriptor = isEnglish
          ? `Access Phase ${phaseLevel.level} benefits and rewards.`
          : `Accede a los beneficios y recompensas de Fase ${phaseLevel.level}.`;

        const defaultRequirement = isEnglish
          ? `Meet the requirements for Phase ${phaseLevel.level}.`
          : `Cumple los requisitos para Fase ${phaseLevel.level}.`;

        // Replace dynamic tokens in rewards
        const processedRewards = (rewards && rewards.length > 0)
          ? rewards.map(reward => replaceDynamicTokens(reward, phaseLevel, monthlyFeeAmount))
          : [isEnglish ? 'Contact support for details' : 'Contacta soporte para más detalles'];

        return LandingOpportunityPhaseSchema.parse({
          id: `phase-${phaseLevel.level + 1}`,
          title,
          visibilityTag: visibilityTag || null,
          descriptor: replaceDynamicTokens(descriptor || defaultDescriptor, phaseLevel, monthlyFeeAmount),
          requirement: replaceDynamicTokens(requirement || defaultRequirement, phaseLevel, monthlyFeeAmount),
          monthlyInvestment,
          rewards: processedRewards,
          accountBalanceHighlight,
          commissionHighlight,
          order: index,
        });
      });
  } catch (error) {
    console.error('[SiteContentService] Failed to build phases from phase_levels:', error);
    // Return empty array on error - will use fallback from landing_page_content
    return [];
  }
};

/**
 * Get active phase levels and map them to landing page phase IDs
 * Returns an array of phase IDs that should be visible on the landing page
 */
const _getActivePhaseIds = async (): Promise<string[]> => {
  try {
    const phaseLevels = await getPhaseLevels();

    // Map phase levels to landing page phase IDs
    // phase_levels.level 0 -> 'phase-1', level 1 -> 'phase-2', etc.
    return phaseLevels
      .filter(level => level.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(level => `phase-${level.level + 1}`);
  } catch (error) {
    console.warn('[SiteContentService] Failed to fetch active phase levels, showing all phases:', error);
    // Fallback: show all 4 phases if there's an error
    return ['phase-1', 'phase-2', 'phase-3', 'phase-4'];
  }
};

/**
 * Get affiliate opportunity content from database
 */
const getAffiliateOpportunityContent = async (locale: Locale): Promise<AffiliateOpportunitySection | undefined> => {
  try {
    const { data, error } = await supabase
      .from('affiliate_opportunity_content')
      .select('*')
      .eq('locale', locale)
      .single();

    if (error || !data) {
      return undefined;
    }

    return AffiliateOpportunitySectionSchema.parse({
      isEnabled: data.is_enabled ?? true,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description ?? undefined,
      benefits: (data.benefits ?? []).map((b: any, idx: number) => ({
        id: b.id ?? `benefit-${idx}`,
        icon: b.icon ?? undefined,
        title: b.title,
        description: b.description,
        order: b.order ?? idx,
      })),
      commissionRate: data.commission_rate ?? undefined,
      commissionLabel: data.commission_label ?? undefined,
      ctaText: data.cta_text,
      ctaLink: data.cta_link,
      imageUrl: data.image_url ?? undefined,
    });
  } catch (error) {
    console.warn('[SiteContentService] Failed to fetch affiliate opportunity content:', error);
    return undefined;
  }
};

const mapRecordToPayload = (record: LandingContentRecord): LandingContentPayload => {
  return LandingContentPayloadSchema.parse({
    hero: record.hero ?? undefined,
    about: record.about ?? undefined,
    howItWorks: record.how_it_works ?? undefined,
    opportunity: record.opportunity ?? undefined,
    testimonials: record.testimonials ?? undefined,
    featuredProducts: record.featured_products ?? undefined,
    contact: record.contact ?? undefined,
    team: record.team ?? undefined,
    header: record.header ?? undefined,
    footer: record.footer ?? undefined,
    faqs: record.faqs ?? undefined,
  });
};

const createDefaultLandingContent = (locale: Locale, appName: string, monthlyFeeAmount: string): LandingContent => {
  const dictionary = getDictionary(locale, appName);

  const steps = [
    {
      id: 'step-1',
      title: dictionary.landing.howItWorks.step1Title,
      description: dictionary.landing.howItWorks.step1Desc,
      order: 0,
      imageUrl: null,
    },
    {
      id: 'step-2',
      title: dictionary.landing.howItWorks.step2Title,
      description: dictionary.landing.howItWorks.step2Desc,
      order: 1,
      imageUrl: null,
    },
    {
      id: 'step-3',
      title: dictionary.landing.howItWorks.step3Title,
      description: dictionary.landing.howItWorks.step3Desc,
      order: 2,
      imageUrl: null,
    },
  ].map((step) => LandingStepSchema.parse(step));

  const opportunitySection = dictionary.landing.opportunitySection as any;
  const opportunity = LandingOpportunitySectionSchema.parse({
    title: opportunitySection.title ?? null,
    subtitle: opportunitySection.subtitle ?? null,
    duplicationNote: opportunitySection.duplicationNote ?? null,
    monthlyFee: opportunitySection.monthlyFee ? {
      ...opportunitySection.monthlyFee,
      amount: monthlyFeeAmount,
    } : null,
    networkCap: opportunitySection.networkCap ?? null,
    phases: opportunitySection.phases.map((phase: any, index: number) =>
      LandingOpportunityPhaseSchema.parse({
        ...phase,
        id: phase.id ?? `phase-${index + 1}`,
        order: phase.order ?? index,
        visibilityTag: normalizeOptional(phase.visibilityTag),
        accountBalanceHighlight: normalizeOptional(phase.accountBalanceHighlight),
        title: replacePriceInText(phase.title, monthlyFeeAmount),
        descriptor: replacePriceInText(phase.descriptor, monthlyFeeAmount),
        requirement: replacePriceInText(phase.requirement, monthlyFeeAmount),
        monthlyInvestment: replacePriceInText(phase.monthlyInvestment, monthlyFeeAmount),
        rewards: phase.rewards.map((reward: string) => replacePriceInText(reward, monthlyFeeAmount)),
        commissionHighlight: replacePriceInText(phase.commissionHighlight, monthlyFeeAmount),
      }),
    ),
    summary: opportunitySection.summary ?? null,
  });

  const testimonials = LandingTestimonialsSectionSchema.parse({
    title: dictionary.landing.testimonialsSection.title,
    testimonials: dictionary.landing.testimonialsSection.testimonials.map((testimonial, index) =>
      LandingTestimonialSchema.parse({
        ...testimonial,
        id: testimonial.id ?? `testimonial-${index + 1}`,
        order: testimonial.order ?? index,
        role: normalizeOptional(testimonial.role),
        imageUrl: normalizeOptional(testimonial.imageUrl),
      }),
    ),
  });

  const header = LandingHeaderContentSchema.parse({
    landingLinks: dictionary.landing.header.landingLinks.map((link, index) => ({
      id: link.id ?? `landing-link-${index + 1}`,
      label: link.label,
      href: link.href,
      requiresAuth: link.requiresAuth ?? false,
      order: link.order ?? index,
    })),
    authenticatedLinks: dictionary.landing.header.authenticatedLinks.map((link, index) => ({
      id: link.id ?? `auth-link-${index + 1}`,
      label: link.label,
      href: link.href,
      requiresAuth: link.requiresAuth ?? true,
      order: link.order ?? index,
    })),
    primaryAction: dictionary.landing.header.primaryAction,
    secondaryAction: dictionary.landing.header.secondaryAction,
    showCart: dictionary.landing.header.showCart ?? true,
  });

  const footer = LandingFooterContentSchema.parse({
    tagline: dictionary.landing.footer.tagline,
    navigationLinks: dictionary.landing.footer.navigationLinks.map((link, index) => ({
      id: link.id ?? `footer-nav-${index + 1}`,
      label: link.label,
      href: link.href,
      order: link.order ?? index,
    })),
    legalLinks: dictionary.landing.footer.legalLinks.map((link, index) => ({
      id: link.id ?? `footer-legal-${index + 1}`,
      label: link.label,
      href: link.href,
      order: link.order ?? index,
    })),
    socialLinks: dictionary.landing.footer.socialLinks.map((link, index) => ({
      id: link.id ?? `footer-social-${index + 1}`,
      platform: link.platform,
      label: link.label,
      href: link.href,
      order: link.order ?? index,
    })),
    brandingAppName: appName,
    showBrandingLogo: true,
    showBrandingAppName: true,
    showBrandingDescription: true,
    brandingOrientation: 'beside',
    showLanguageSwitcher: dictionary.landing.footer.showLanguageSwitcher ?? true,
    showThemeSwitcher: dictionary.landing.footer.showThemeSwitcher ?? true,
  });

  return LandingContentSchema.parse({
    locale,
    hero: {
      title: dictionary.landing.heroTitle,
      subtitle: dictionary.landing.heroSubtitle,
      backgroundImageUrl: DEFAULT_HERO_IMAGE,
      backgroundColor: null,
      style: 'default',
    },
    about: {
      title: dictionary.landing.aboutTitle,
      description: dictionary.landing.aboutText1,
      secondaryDescription: dictionary.landing.aboutText2,
      imageUrl: DEFAULT_ABOUT_IMAGE,
    },
    howItWorks: {
      title: dictionary.landing.howItWorksTitle,
      subtitle: dictionary.landing.howItWorksSubtitle,
      steps,
    },
    opportunity,
    testimonials,
    featuredProducts: LandingFeaturedProductsSectionSchema.parse({
      title: dictionary.landing.featuredProductsSection.title,
      subtitle: dictionary.landing.featuredProductsSection.subtitle,
      emptyState: dictionary.landing.featuredProductsSection.emptyState,
    }),
    contact: LandingContactSectionSchema.parse({
      title: dictionary.landing.contactSection.title,
      description: dictionary.landing.contactSection.description,
      contactInfo: dictionary.landing.contactSection.contactInfo,
      form: dictionary.landing.contactSection.form,
      recipientEmail: dictionary.landing.contactSection.recipientEmail,
    }),
    team: LandingTeamSectionSchema.parse({
      title: dictionary.landing.teamSection?.title ?? 'Our Team',
      subtitle: dictionary.landing.teamSection?.subtitle ?? 'Meet the people behind our success',
      featuredMemberIds: [],
    }),
    header,
    footer,
    faqs: [],
    updatedAt: null,
  });
};

const replacePriceInText = (text: string | null, price: string): string | null => {
  if (!text) return text;
  if (!price || price === '0') return text;
  const formattedPrice = `$${parseFloat(price).toFixed(2)}`;
  // Replace both $34 and {{price}} tokens with the dynamic price
  return text
    .replace(/\$34(\.00)?/g, formattedPrice)
    .replace(/\{\{price\}\}/g, formattedPrice);
};

const mergeLandingContent = async (
  locale: Locale,
  appName: string,
  record: LandingContentRecord | null,
): Promise<LandingContent> => {
  const plans = await getAllPlans();
  const lowestPricePlan = plans.reduce((min, plan) => plan.price < min.price ? plan : min, plans[0]);
  const monthlyFeeAmount = lowestPricePlan ? lowestPricePlan.price.toString() : '0';
  const defaults = createDefaultLandingContent(locale, appName, monthlyFeeAmount);

  // Build dynamic phases from phase_levels table
  // This makes all $ and % values configurable by admin
  const dynamicPhases = await buildPhasesFromPhaseLevels(locale, monthlyFeeAmount);

  // Load affiliate opportunity content from database
  const affiliateOpportunity = await getAffiliateOpportunityContent(locale);

  if (!record) {
    // Use dynamic phases from phase_levels if available, otherwise use defaults
    const filteredDefaults = {
      ...defaults,
      opportunity: {
        ...defaults.opportunity,
        phases: dynamicPhases.length > 0 ? dynamicPhases : defaults.opportunity.phases,
      },
      affiliateOpportunity,
    };
    return filteredDefaults;
  }

  const payload = mapRecordToPayload(record);

  const hero = payload.hero
    ? {
      title: payload.hero.title ?? defaults.hero.title,
      subtitle: payload.hero.subtitle ?? defaults.hero.subtitle,
      backgroundImageUrl: normalizeOptional(payload.hero.backgroundImageUrl) ?? defaults.hero.backgroundImageUrl,
      backgroundColor: normalizeOptional((payload.hero as any).backgroundColor) ?? defaults.hero.backgroundColor,
      style: (payload.hero.style as any) ?? defaults.hero.style,
    }
    : defaults.hero;

  const about = payload.about
    ? {
      title: payload.about.title ?? defaults.about.title,
      description: payload.about.description ?? defaults.about.description,
      secondaryDescription:
        normalizeOptional(payload.about.secondaryDescription) ?? defaults.about.secondaryDescription,
      imageUrl: normalizeOptional(payload.about.imageUrl) ?? defaults.about.imageUrl,
    }
    : defaults.about;

  const steps = payload.howItWorks?.steps?.length
    ? sortStepsByOrder(
      payload.howItWorks.steps.map((step, index) =>
        LandingStepSchema.parse({
          id: step.id ?? `step-${index + 1}`,
          title: step.title ?? defaults.howItWorks.steps[index]?.title ?? `Step ${index + 1}`,
          description:
            step.description ?? defaults.howItWorks.steps[index]?.description ?? 'Add a description for this step.',
          imageUrl: normalizeOptional(step.imageUrl),
          order: step.order ?? index,
        }),
      ),
    )
    : defaults.howItWorks.steps;

  const howItWorks = {
    title: payload.howItWorks?.title ?? defaults.howItWorks.title,
    subtitle: payload.howItWorks?.subtitle ?? defaults.howItWorks.subtitle,
    steps,
  };

  const opportunity: LandingOpportunitySection = payload.opportunity
    ? LandingOpportunitySectionSchema.parse({
      title: payload.opportunity.title ?? defaults.opportunity.title ?? null,
      subtitle: payload.opportunity.subtitle ?? defaults.opportunity.subtitle ?? null,
      duplicationNote: payload.opportunity.duplicationNote ?? defaults.opportunity.duplicationNote ?? null,
      monthlyFee: (payload.opportunity.monthlyFee || defaults.opportunity.monthlyFee) ? {
        label: payload.opportunity.monthlyFee?.label ?? defaults.opportunity.monthlyFee?.label ?? '',
        amount: monthlyFeeAmount,
        description:
          payload.opportunity.monthlyFee?.description ?? defaults.opportunity.monthlyFee?.description ?? '',
      } : null,
      networkCap: payload.opportunity.networkCap ?? defaults.opportunity.networkCap ?? null,
      // ALWAYS use dynamic phases from phase_levels table
      // This ensures all $ and % values are controlled by admin
      phases: dynamicPhases.length > 0 ? dynamicPhases : defaults.opportunity.phases,
      summary: payload.opportunity.summary
        ? {
          title:
            payload.opportunity.summary.title ??
            defaults.opportunity.summary?.title ??
            '',
          description:
            payload.opportunity.summary.description ??
            defaults.opportunity.summary?.description ??
            '',
        }
        : defaults.opportunity.summary ?? null,
    })
    : {
      ...defaults.opportunity,
      phases: dynamicPhases.length > 0 ? dynamicPhases : defaults.opportunity.phases,
    };

  const testimonials: LandingTestimonialsSection = payload.testimonials
    ? LandingTestimonialsSectionSchema.parse({
      title: payload.testimonials.title ?? defaults.testimonials.title,
      testimonials: payload.testimonials.testimonials?.length
        ? sortTestimonialsByOrder(
          payload.testimonials.testimonials.map((testimonial, index) =>
            LandingTestimonialSchema.parse({
              id:
                testimonial.id ??
                defaults.testimonials.testimonials[index]?.id ??
                `testimonial-${index + 1}`,
              name:
                testimonial.name ??
                defaults.testimonials.testimonials[index]?.name ??
                'Add the testimonial name.',
              quote:
                testimonial.quote ??
                defaults.testimonials.testimonials[index]?.quote ??
                'Add the testimonial quote.',
              role:
                normalizeOptional(testimonial.role) ??
                normalizeOptional(defaults.testimonials.testimonials[index]?.role) ??
                null,
              imageUrl:
                normalizeOptional(testimonial.imageUrl) ??
                normalizeOptional(defaults.testimonials.testimonials[index]?.imageUrl) ??
                null,
              order: testimonial.order ?? index,
            }),
          ),
        )
        : defaults.testimonials.testimonials,
    })
    : defaults.testimonials;

  const featuredProducts: LandingFeaturedProductsSection = LandingFeaturedProductsSectionSchema.parse({
    title: payload.featuredProducts?.title ?? defaults.featuredProducts.title,
    subtitle: payload.featuredProducts?.subtitle ?? defaults.featuredProducts.subtitle,
    emptyState: payload.featuredProducts?.emptyState ?? defaults.featuredProducts.emptyState,
  });

  const contact: LandingContactSection = LandingContactSectionSchema.parse({
    title: payload.contact?.title ?? defaults.contact.title,
    description: payload.contact?.description ?? defaults.contact.description,
    contactInfo: {
      phone: payload.contact?.contactInfo?.phone ?? defaults.contact.contactInfo.phone,
      email: normalizeOptional(payload.contact?.contactInfo?.email) ?? defaults.contact.contactInfo.email,
      address: payload.contact?.contactInfo?.address ?? defaults.contact.contactInfo.address,
    },
    form: {
      namePlaceholder:
        payload.contact?.form?.namePlaceholder ?? defaults.contact.form.namePlaceholder,
      emailPlaceholder:
        payload.contact?.form?.emailPlaceholder ?? defaults.contact.form.emailPlaceholder,
      messagePlaceholder:
        payload.contact?.form?.messagePlaceholder ?? defaults.contact.form.messagePlaceholder,
      sendButton: payload.contact?.form?.sendButton ?? defaults.contact.form.sendButton,
      nameLabel:
        payload.contact?.form?.nameLabel ??
        defaults.contact.form.nameLabel ??
        payload.contact?.form?.namePlaceholder ??
        defaults.contact.form.namePlaceholder,
      emailLabel:
        payload.contact?.form?.emailLabel ??
        defaults.contact.form.emailLabel ??
        payload.contact?.form?.emailPlaceholder ??
        defaults.contact.form.emailPlaceholder,
      messageLabel:
        payload.contact?.form?.messageLabel ??
        defaults.contact.form.messageLabel ??
        payload.contact?.form?.messagePlaceholder ??
        defaults.contact.form.messagePlaceholder,
      sendingLabel:
        payload.contact?.form?.sendingLabel ??
        defaults.contact.form.sendingLabel ??
        defaults.contact.form.sendButton,
      successMessage:
        payload.contact?.form?.successMessage ??
        defaults.contact.form.successMessage ??
        'Thanks for reaching out! We will get back to you shortly.',
      errorMessage:
        payload.contact?.form?.errorMessage ??
        defaults.contact.form.errorMessage ??
        'We could not send your message. Please try again.',
      helperText:
        payload.contact?.form?.helperText ??
        defaults.contact.form.helperText ??
        'We usually respond within one business day.',
    },
    recipientEmail:
      normalizeOptional(payload.contact?.recipientEmail) ?? defaults.contact.recipientEmail,
  });

  const header: LandingHeaderContent = LandingHeaderContentSchema.parse({
    landingLinks: payload.header?.landingLinks?.length
      ? sortHeaderLinksByOrder(
        payload.header.landingLinks.map((link, index) =>
          LandingHeaderLinkSchema.parse({
            id:
              link.id ??
              defaults.header.landingLinks[index]?.id ??
              `landing-link-${index + 1}`,
            label:
              link.label ??
              defaults.header.landingLinks[index]?.label ??
              `Link ${index + 1}`,
            href:
              link.href ??
              defaults.header.landingLinks[index]?.href ??
              '#',
            requiresAuth:
              link.requiresAuth ??
              defaults.header.landingLinks[index]?.requiresAuth ??
              false,
            order: link.order ?? index,
            visibility: link.visibility,
            openInNewTab: link.openInNewTab ?? false,
            icon: link.icon ?? null,
          }),
        ),
      )
      : defaults.header.landingLinks,
    authenticatedLinks: payload.header?.authenticatedLinks?.length
      ? sortHeaderLinksByOrder(
        payload.header.authenticatedLinks.map((link, index) =>
          LandingHeaderLinkSchema.parse({
            id:
              link.id ??
              defaults.header.authenticatedLinks[index]?.id ??
              `auth-link-${index + 1}`,
            label:
              link.label ??
              defaults.header.authenticatedLinks[index]?.label ??
              `Link ${index + 1}`,
            href:
              link.href ??
              defaults.header.authenticatedLinks[index]?.href ??
              '/',
            requiresAuth:
              link.requiresAuth ??
              defaults.header.authenticatedLinks[index]?.requiresAuth ??
              true,
            order: link.order ?? index,
            visibility: link.visibility,
            openInNewTab: link.openInNewTab ?? false,
            icon: link.icon ?? null,
          }),
        ),
      )
      : defaults.header.authenticatedLinks,
    primaryAction: {
      label: payload.header?.primaryAction?.label ?? defaults.header.primaryAction.label,
      href: payload.header?.primaryAction?.href ?? defaults.header.primaryAction.href,
    },
    secondaryAction: {
      label: payload.header?.secondaryAction?.label ?? defaults.header.secondaryAction.label,
      href: payload.header?.secondaryAction?.href ?? defaults.header.secondaryAction.href,
    },
    showCart: payload.header?.showCart ?? defaults.header.showCart,
  });

  const footer: LandingFooterContent = LandingFooterContentSchema.parse({
    tagline: payload.footer?.tagline ?? defaults.footer.tagline,
    navigationLinks: payload.footer?.navigationLinks?.length
      ? sortFooterLinksByOrder(
        payload.footer.navigationLinks.map((link, index) =>
          LandingFooterLinkSchema.parse({
            id:
              link.id ??
              defaults.footer.navigationLinks[index]?.id ??
              `footer-nav-${index + 1}`,
            label:
              link.label ??
              defaults.footer.navigationLinks[index]?.label ??
              `Navigation ${index + 1}`,
            href:
              link.href ??
              defaults.footer.navigationLinks[index]?.href ??
              '#',
            order: link.order ?? index,
            visibility: link.visibility,
            openInNewTab: link.openInNewTab ?? false,
          }),
        ),
      )
      : defaults.footer.navigationLinks,
    legalLinks: payload.footer?.legalLinks?.length
      ? sortFooterLinksByOrder(
        payload.footer.legalLinks.map((link, index) =>
          LandingFooterLinkSchema.parse({
            id:
              link.id ??
              defaults.footer.legalLinks[index]?.id ??
              `footer-legal-${index + 1}`,
            label:
              link.label ??
              defaults.footer.legalLinks[index]?.label ??
              `Legal ${index + 1}`,
            href:
              link.href ??
              defaults.footer.legalLinks[index]?.href ??
              '#',
            order: link.order ?? index,
            visibility: link.visibility,
            openInNewTab: link.openInNewTab ?? false,
          }),
        ),
      )
      : defaults.footer.legalLinks,
    socialLinks: payload.footer?.socialLinks?.length
      ? sortFooterSocialByOrder(
        payload.footer.socialLinks.map((link, index) =>
          LandingFooterSocialSchema.parse({
            id:
              link.id ??
              defaults.footer.socialLinks[index]?.id ??
              `footer-social-${index + 1}`,
            platform:
              link.platform ??
              defaults.footer.socialLinks[index]?.platform ??
              'custom',
            label:
              link.label ??
              defaults.footer.socialLinks[index]?.label ??
              `Social ${index + 1}`,
            href:
              link.href ??
              defaults.footer.socialLinks[index]?.href ??
              '#',
            order: link.order ?? index,
          }),
        ),
      )
      : defaults.footer.socialLinks,
    brandingAppName:
      normalizeOptional(payload.footer?.brandingAppName) ??
      defaults.footer.brandingAppName ??
      appName,
    showBrandingLogo: payload.footer?.showBrandingLogo ?? defaults.footer.showBrandingLogo,
    showBrandingAppName: payload.footer?.showBrandingAppName ?? defaults.footer.showBrandingAppName,
    showBrandingDescription:
      payload.footer?.showBrandingDescription ?? defaults.footer.showBrandingDescription,
    brandingOrientation: payload.footer?.brandingOrientation ?? defaults.footer.brandingOrientation,
    showLanguageSwitcher:
      payload.footer?.showLanguageSwitcher ?? defaults.footer.showLanguageSwitcher,
    showThemeSwitcher:
      payload.footer?.showThemeSwitcher ?? defaults.footer.showThemeSwitcher,
  });

  const faqs = payload.faqs?.length
    ? sortFaqsByOrder(
      payload.faqs.map((faq, index) =>
        LandingFaqSchema.parse({
          id: faq.id ?? `faq-${index + 1}`,
          question: faq.question ?? 'New question',
          answer: faq.answer ?? 'Add the answer for this question.',
          imageUrl: normalizeOptional(faq.imageUrl),
          order: faq.order ?? index,
        }),
      ),
    )
    : defaults.faqs;

  const team: LandingTeamSection = payload.team
    ? LandingTeamSectionSchema.parse({
      title: payload.team.title ?? defaults.team.title,
      subtitle: payload.team.subtitle ?? defaults.team.subtitle,
      featuredMemberIds: payload.team.featuredMemberIds ?? defaults.team.featuredMemberIds,
    })
    : defaults.team;

  return LandingContentSchema.parse({
    locale,
    hero,
    about,
    howItWorks,
    opportunity,
    affiliateOpportunity,
    testimonials,
    featuredProducts,
    contact,
    team,
    header,
    footer,
    faqs,
    updatedAt: null,
  });
};

const getRepository = () => createSiteContentModule().repository;

const getCachedBranding = cache(async (): Promise<SiteBranding> => {
  if (isBuildSmokeTestEnabled()) {
    return createDefaultBranding(DEFAULT_APP_NAME);
  }

  const repository = getRepository();
  const stored = await repository.fetchBranding();

  if (!stored) {
    return createDefaultBranding(DEFAULT_APP_NAME);
  }

  return SiteBrandingSchema.parse({
    ...stored,
    appName: stored.appName || DEFAULT_APP_NAME,
  });
}) as CacheableFn<[], SiteBranding>;

export const getSiteBranding = async (): Promise<SiteBranding> => {
  return getCachedBranding();
};

export const updateSiteBranding = async (
  input: SiteBrandingUpdateInput,
): Promise<SiteBranding> => {
  const repository = getRepository();

  // Get current branding to check if logo is being changed
  const currentBranding = await getSiteBranding();

  const payload = SiteBrandingUpdateSchema.parse({
    ...input,
    appName: input.appName.trim(),
    logoUrl: normalizeOptional(input.logoUrl),
    faviconUrl: normalizeOptional(input.faviconUrl),
    description: normalizeOptional(input.description),
  });

  // If logo is being changed and there was a previous logo, delete it from storage
  if (payload.logoUrl !== currentBranding.logoUrl && currentBranding.logoUrl) {
    const oldLogoPath = extractStoragePathFromUrl(currentBranding.logoUrl);
    if (oldLogoPath) {
      try {
        const { error } = await supabase.storage
          .from(PAGE_BUCKET)
          .remove([oldLogoPath]);

        if (error) {
          console.warn('Failed to delete old logo from storage:', error);
        }
      } catch (error) {
        console.warn('Error deleting old logo:', error);
      }
    }
  }

  // If favicon is being changed and there was a previous favicon, delete it from storage
  if (payload.faviconUrl !== currentBranding.faviconUrl && currentBranding.faviconUrl) {
    const oldFaviconPath = extractStoragePathFromUrl(currentBranding.faviconUrl);
    if (oldFaviconPath) {
      try {
        const { error } = await supabase.storage
          .from(PAGE_BUCKET)
          .remove([oldFaviconPath]);

        if (error) {
          console.warn('Failed to delete old favicon from storage:', error);
        }
      } catch (error) {
        console.warn('Error deleting old favicon:', error);
      }
    }
  }

  const updated = await repository.upsertBranding(payload);

  getCachedBranding.clear?.();

  return updated;
};

export const LandingContentUpdateSchema = LandingContentSchema.omit({
  locale: true,
  updatedAt: true,
}).extend({
  faqs: LandingFaqSchema.array(),
});

export type LandingContentUpdateInput = z.infer<typeof LandingContentUpdateSchema>;

const getLandingContentCached = cache(async (locale: Locale): Promise<LandingContent> => {
  if (isBuildSmokeTestEnabled()) {
    return createDefaultLandingContent(locale, DEFAULT_APP_NAME, '0');
  }

  const repository = getRepository();
  const branding = await getSiteBranding();
  const stored = await repository.fetchLandingContent(locale);
  return await mergeLandingContent(locale, branding.appName, stored);
}) as CacheableFn<[Locale], LandingContent>;

export const getLandingContent = getLandingContentCached;

export const updateLandingContent = async (
  locale: Locale,
  input: LandingContentUpdateInput,
): Promise<LandingContent> => {
  const repository = getRepository();
  const payload = LandingContentUpdateSchema.parse(input);

  const sanitized: LandingContentPayload = {
    hero: {
      title: payload.hero.title.trim(),
      subtitle: payload.hero.subtitle.trim(),
      backgroundImageUrl: normalizeOptional(payload.hero.backgroundImageUrl) ?? null,
      backgroundColor: normalizeOptional((payload.hero as any).backgroundColor) ?? null,
      style: (payload.hero as any).style ?? 'default',
    },
    about: {
      title: payload.about.title.trim(),
      description: payload.about.description.trim(),
      secondaryDescription: normalizeOptional(payload.about.secondaryDescription),
      imageUrl: normalizeOptional(payload.about.imageUrl) ?? null,
    },
    howItWorks: {
      title: payload.howItWorks.title.trim(),
      subtitle: payload.howItWorks.subtitle.trim(),
      steps: payload.howItWorks.steps.map((step, index) => ({
        id: step.id ?? `step-${index + 1}`,
        title: step.title?.trim() ?? `Step ${index + 1}`,
        description: step.description?.trim() ?? '',
        imageUrl: normalizeOptional(step.imageUrl),
        order: step.order ?? index,
      })),
    },
    opportunity: {
      title: payload.opportunity.title.trim(),
      subtitle: payload.opportunity.subtitle.trim(),
      duplicationNote: payload.opportunity.duplicationNote.trim(),
      monthlyFee: {
        label: payload.opportunity.monthlyFee.label.trim(),
        amount: payload.opportunity.monthlyFee.amount.trim(),
        description: payload.opportunity.monthlyFee.description.trim(),
      },
      networkCap: payload.opportunity.networkCap.trim(),
      phases: payload.opportunity.phases.map((phase, index) => ({
        id: phase.id ?? `phase-${index + 1}`,
        title: phase.title?.trim() ?? `Phase ${index + 1}`,
        visibilityTag: normalizeOptional(phase.visibilityTag),
        descriptor: phase.descriptor?.trim() ?? '',
        requirement: phase.requirement?.trim() ?? '',
        monthlyInvestment: phase.monthlyInvestment?.trim() ?? '',
        rewards: (phase.rewards ?? [])
          .map((reward) => reward?.trim())
          .filter((reward): reward is string => Boolean(reward && reward.length > 0)),
        accountBalanceHighlight: normalizeOptional(phase.accountBalanceHighlight),
        commissionHighlight: phase.commissionHighlight?.trim() ?? '',
        order: phase.order ?? index,
      })),
      summary: payload.opportunity.summary
        ? {
          title: payload.opportunity.summary.title?.trim() ?? payload.opportunity.title.trim(),
          description:
            payload.opportunity.summary.description?.trim() ?? payload.opportunity.subtitle.trim(),
        }
        : undefined,
    },
    testimonials: {
      title: payload.testimonials.title.trim(),
      testimonials: payload.testimonials.testimonials.map((testimonial, index) => ({
        id: testimonial.id ?? `testimonial-${index + 1}`,
        name: testimonial.name?.trim() ?? `Testimonial ${index + 1}`,
        quote: testimonial.quote?.trim() ?? '',
        role: normalizeOptional(testimonial.role),
        imageUrl: normalizeOptional(testimonial.imageUrl),
        order: testimonial.order ?? index,
      })),
    },
    featuredProducts: {
      title: payload.featuredProducts.title.trim(),
      subtitle: payload.featuredProducts.subtitle.trim(),
      emptyState: payload.featuredProducts.emptyState.trim(),
    },
    contact: {
      title: payload.contact.title.trim(),
      description: payload.contact.description.trim(),
      contactInfo: {
        phone: payload.contact.contactInfo.phone.trim(),
        email: payload.contact.contactInfo.email.trim(),
        address: payload.contact.contactInfo.address.trim(),
      },
      form: {
        namePlaceholder: payload.contact.form.namePlaceholder.trim(),
        emailPlaceholder: payload.contact.form.emailPlaceholder.trim(),
        messagePlaceholder: payload.contact.form.messagePlaceholder.trim(),
        sendButton: payload.contact.form.sendButton.trim(),
      },
      recipientEmail: payload.contact.recipientEmail.trim(),
    },
    header: {
      landingLinks: payload.header.landingLinks.map((link, index) => ({
        id: link.id ?? `landing-link-${index + 1}`,
        label: link.label?.trim() ?? `Link ${index + 1}`,
        href: link.href?.trim() ?? '#',
        requiresAuth: link.requiresAuth ?? false,
        order: link.order ?? index,
        visibility: link.visibility,
        openInNewTab: link.openInNewTab ?? false,
        icon: link.icon ?? null,
      })),
      authenticatedLinks: payload.header.authenticatedLinks.map((link, index) => ({
        id: link.id ?? `auth-link-${index + 1}`,
        label: link.label?.trim() ?? `Link ${index + 1}`,
        href: link.href?.trim() ?? '/',
        requiresAuth: link.requiresAuth ?? true,
        order: link.order ?? index,
        visibility: link.visibility,
        openInNewTab: link.openInNewTab ?? false,
        icon: link.icon ?? null,
      })),
      primaryAction: {
        label: payload.header.primaryAction.label.trim(),
        href: payload.header.primaryAction.href.trim(),
      },
      secondaryAction: {
        label: payload.header.secondaryAction.label.trim(),
        href: payload.header.secondaryAction.href.trim(),
      },
      showCart: payload.header.showCart,
    },
    footer: {
      tagline: payload.footer.tagline.trim(),
      navigationLinks: payload.footer.navigationLinks.map((link, index) => ({
        id: link.id ?? `footer-nav-${index + 1}`,
        label: link.label?.trim() ?? `Navigation ${index + 1}`,
        href: link.href?.trim() ?? '#',
        order: link.order ?? index,
        visibility: link.visibility,
        openInNewTab: link.openInNewTab ?? false,
      })),
      legalLinks: payload.footer.legalLinks.map((link, index) => ({
        id: link.id ?? `footer-legal-${index + 1}`,
        label: link.label?.trim() ?? `Legal ${index + 1}`,
        href: link.href?.trim() ?? '#',
        order: link.order ?? index,
        visibility: link.visibility,
        openInNewTab: link.openInNewTab ?? false,
      })),
      socialLinks: payload.footer.socialLinks.map((link, index) => ({
        id: link.id ?? `footer-social-${index + 1}`,
        platform: link.platform ?? 'custom',
        label: link.label?.trim() ?? `Social ${index + 1}`,
        href: link.href?.trim() ?? '#',
        order: link.order ?? index,
      })),
      brandingAppName: normalizeOptional(payload.footer.brandingAppName),
      showBrandingLogo: payload.footer.showBrandingLogo,
      showBrandingAppName: payload.footer.showBrandingAppName,
      showBrandingDescription: payload.footer.showBrandingDescription,
      brandingOrientation: payload.footer.brandingOrientation,
      showLanguageSwitcher: payload.footer.showLanguageSwitcher,
      showThemeSwitcher: payload.footer.showThemeSwitcher,
    },
    team: {
      title: payload.team.title.trim(),
      subtitle: payload.team.subtitle.trim(),
      featuredMemberIds: payload.team.featuredMemberIds ?? [],
    },
    faqs: payload.faqs.map((faq, index) => ({
      id: faq.id ?? `faq-${index + 1}`,
      question: faq.question.trim(),
      answer: faq.answer.trim(),
      imageUrl: normalizeOptional(faq.imageUrl),
      order: faq.order ?? index,
    })),
  };

  await repository.upsertLandingContent(locale, sanitized);

  getLandingContent.clear?.();

  return getLandingContent(locale);
};

export interface SiteContentConfiguration {
  branding: SiteBranding;
  landing: LandingContent;
  affiliatePageConfig?: AffiliatePageConfig;
}

export interface SiteContentConfigurationUpdateInput {
  branding: SiteBrandingUpdateInput;
  landing: LandingContentUpdateInput;
  affiliatePageConfig?: AffiliatePageConfig;
}

export const getSiteContentConfiguration = async (locale: Locale): Promise<SiteContentConfiguration> => {
  const repository = getRepository();
  const branding = await getSiteBranding();
  const landing = await getLandingContent(locale);
  const affiliatePageConfig = await repository.fetchAffiliatePageConfig();

  return { branding, landing, affiliatePageConfig: affiliatePageConfig ?? undefined };
};

export const updateSiteContentConfiguration = async (
  locale: Locale,
  input: SiteContentConfigurationUpdateInput,
): Promise<SiteContentConfiguration> => {
  const repository = getRepository();
  const branding = await updateSiteBranding(input.branding);
  const landing = await updateLandingContent(locale, input.landing);

  let affiliatePageConfig: AffiliatePageConfig | null = null;
  if (input.affiliatePageConfig) {
    affiliatePageConfig = await repository.upsertAffiliatePageConfig(input.affiliatePageConfig);
  }

  return { branding, landing, affiliatePageConfig: affiliatePageConfig ?? undefined };
};

export const getLocalizedDictionary = async (locale: Locale) => {
  const branding = await getSiteBranding();
  return getDictionary(locale, branding.appName);
};

export const validateLocale = (value: string | null | undefined): Locale => {
  const locale = value ?? i18n.defaultLocale;
  if ((i18n.locales as readonly string[]).includes(locale)) {
    return locale as Locale;
  }
  return i18n.defaultLocale;
};
