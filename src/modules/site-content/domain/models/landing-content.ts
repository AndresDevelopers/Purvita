import { z } from 'zod';
import type { Locale } from '@/i18n/config';

export const LandingHeroContentSchema = z.object({
  title: z.string().min(1).max(180),
  subtitle: z.string().min(1).max(500),
  backgroundImageUrl: z.string().max(500).nullable().optional(),
  backgroundColor: z.string().max(50).nullable().optional(),
  style: z.enum(['default', 'modern', 'minimal']).default('default'),
});

export type LandingHeroContent = z.infer<typeof LandingHeroContentSchema>;

export const LandingAboutContentSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(1200),
  secondaryDescription: z.string().max(1200).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
});

export type LandingAboutContent = z.infer<typeof LandingAboutContentSchema>;

export const LandingStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(600),
  imageUrl: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).max(100).default(0),
});

export type LandingStep = z.infer<typeof LandingStepSchema>;

export const LandingHowItWorksSchema = z.object({
  title: z.string().min(1).max(180),
  subtitle: z.string().min(1).max(600),
  steps: z.array(LandingStepSchema).min(1).max(6),
});

export type LandingHowItWorks = z.infer<typeof LandingHowItWorksSchema>;

export const LandingOpportunityPhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(180),
  visibilityTag: z.string().max(120).nullable().optional(),
  descriptor: z.string().min(1).max(600),
  requirement: z.string().min(1).max(300),
  monthlyInvestment: z.string().min(1).max(120),
  rewards: z.array(z.string().min(1).max(400)).min(1).max(10),
  accountBalanceHighlight: z.string().max(300).nullable().optional(),
  commissionHighlight: z.string().min(1).max(240),
  order: z.number().int().min(0).max(100).default(0),
});

export type LandingOpportunityPhase = z.infer<typeof LandingOpportunityPhaseSchema>;

export const LandingOpportunitySectionSchema = z.object({
  title: z.string().max(180).nullable().optional(),
  subtitle: z.string().max(600).nullable().optional(),
  duplicationNote: z.string().max(240).nullable().optional(),
  monthlyFee: z.object({
    label: z.string().min(1).max(120),
    amount: z.string().min(1).max(60),
    description: z.string().min(1).max(300),
  }).nullable().optional(),
  networkCap: z.string().max(240).nullable().optional(),
  phases: z.array(LandingOpportunityPhaseSchema).min(1).max(8),
  summary: z
    .object({
      title: z.string().min(1).max(180),
      description: z.string().min(1).max(600),
    })
    .nullable()
    .optional(),
});

export type LandingOpportunitySection = z.infer<typeof LandingOpportunitySectionSchema>;

// Affiliate Opportunity Section - For affiliate program promotion on landing page
export const AffiliateOpportunityBenefitSchema = z.object({
  id: z.string().min(1),
  icon: z.string().max(60).nullable().optional(), // Icon name (e.g., 'gift', 'percent', 'wallet')
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(400),
  order: z.number().int().min(0).max(100).default(0),
});

export type AffiliateOpportunityBenefit = z.infer<typeof AffiliateOpportunityBenefitSchema>;

export const AffiliateOpportunitySectionSchema = z.object({
  isEnabled: z.boolean().default(true),
  title: z.string().min(1).max(180),
  subtitle: z.string().min(1).max(600),
  description: z.string().max(1200).nullable().optional(),
  benefits: z.array(AffiliateOpportunityBenefitSchema).max(8).default([]),
  commissionRate: z.string().max(60).nullable().optional(), // e.g., "15%" or "Up to 20%"
  commissionLabel: z.string().max(180).nullable().optional(), // e.g., "Commission per sale"
  ctaText: z.string().min(1).max(120), // Call to action button text
  ctaLink: z.string().min(1).max(500), // Call to action link
  imageUrl: z.string().max(500).nullable().optional(),
});

export type AffiliateOpportunitySection = z.infer<typeof AffiliateOpportunitySectionSchema>;

export const LandingTestimonialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  quote: z.string().min(1).max(600),
  role: z.string().max(120).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).max(100).default(0),
});

export type LandingTestimonial = z.infer<typeof LandingTestimonialSchema>;

export const LandingTestimonialsSectionSchema = z.object({
  title: z.string().min(1).max(180),
  testimonials: z.array(LandingTestimonialSchema).min(1).max(12),
});

export type LandingTestimonialsSection = z.infer<typeof LandingTestimonialsSectionSchema>;

export const LandingFeaturedProductsSectionSchema = z.object({
  title: z.string().min(1).max(180),
  subtitle: z.string().min(1).max(600),
  emptyState: z.string().min(1).max(240),
});

export type LandingFeaturedProductsSection = z.infer<typeof LandingFeaturedProductsSectionSchema>;

export const LandingContactSectionSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(600),
  contactInfo: z.object({
    phone: z.string().min(1).max(120),
    email: z.string().email().max(180),
    address: z.string().min(1).max(240),
  }),
  form: z.object({
    namePlaceholder: z.string().min(1).max(120),
    emailPlaceholder: z.string().min(1).max(120),
    messagePlaceholder: z.string().min(1).max(240),
    sendButton: z.string().min(1).max(60),
    nameLabel: z.string().min(1).max(120).optional(),
    emailLabel: z.string().min(1).max(120).optional(),
    messageLabel: z.string().min(1).max(240).optional(),
    sendingLabel: z.string().min(1).max(60).optional(),
    successMessage: z.string().min(1).max(240).optional(),
    errorMessage: z.string().min(1).max(240).optional(),
    helperText: z.string().min(1).max(240).optional(),
  }),
  recipientEmail: z.string().email().max(180),
});

export type LandingContactSection = z.infer<typeof LandingContactSectionSchema>;

export const LandingHeaderActionSchema = z.object({
  label: z.string().min(1).max(120),
  href: z.string().min(1).max(500),
});

export type LandingHeaderAction = z.infer<typeof LandingHeaderActionSchema>;

/**
 * Visibility rules for navigation links
 * Controls who can see each link based on authentication and subscription status
 */
export const LinkVisibilityRulesSchema = z.object({
  // Authentication-based visibility
  showToGuests: z.boolean().default(true), // Show to non-authenticated users
  showToAuthenticated: z.boolean().default(true), // Show to authenticated users
  
  // Subscription status-based visibility
  showToActiveSubscription: z.boolean().default(true), // Show to users with active subscription
  showToInactiveSubscription: z.boolean().default(true), // Show to users without active subscription
  
  // Subscription type-based visibility
  showToMlm: z.boolean().default(true), // Show to MLM subscription users
  showToAffiliate: z.boolean().default(true), // Show to Affiliate subscription users
  
  // Role-based visibility (for future expansion)
  showToAdmin: z.boolean().default(true), // Show to admin users
});

export type LinkVisibilityRules = z.infer<typeof LinkVisibilityRulesSchema>;

export const defaultVisibilityRules: LinkVisibilityRules = {
  showToGuests: true,
  showToAuthenticated: true,
  showToActiveSubscription: true,
  showToInactiveSubscription: true,
  showToMlm: true,
  showToAffiliate: true,
  showToAdmin: true,
};

export const LandingHeaderLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(180),
  href: z.string().min(1).max(500),
  requiresAuth: z.boolean().default(false),
  order: z.number().int().min(0).max(100).default(0),
  // Advanced visibility rules
  visibility: LinkVisibilityRulesSchema.optional(),
  // Icon identifier for the link (optional)
  icon: z.string().max(50).nullable().optional(),
  // Open in new tab
  openInNewTab: z.boolean().default(false),
});

export type LandingHeaderLink = z.infer<typeof LandingHeaderLinkSchema>;

export const LandingHeaderContentSchema = z.object({
  landingLinks: z.array(LandingHeaderLinkSchema).min(1).max(12),
  authenticatedLinks: z.array(LandingHeaderLinkSchema).max(12),
  primaryAction: LandingHeaderActionSchema,
  secondaryAction: LandingHeaderActionSchema,
  showCart: z.boolean().default(true),
});

export type LandingHeaderContent = z.infer<typeof LandingHeaderContentSchema>;

export const LandingFooterLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(180),
  href: z.string().min(1).max(500),
  order: z.number().int().min(0).max(100).default(0),
  // Advanced visibility rules (same as header links)
  visibility: LinkVisibilityRulesSchema.optional(),
  // Open in new tab
  openInNewTab: z.boolean().default(false),
});

export type LandingFooterLink = z.infer<typeof LandingFooterLinkSchema>;

export const LandingFooterSocialSchema = z.object({
  id: z.string().min(1),
  platform: z.enum([
    'facebook',
    'instagram',
    'twitter',
    'linkedin',
    'youtube',
    'tiktok',
    'custom',
  ]),
  label: z.string().min(1).max(120),
  href: z.string().min(1).max(500),
  order: z.number().int().min(0).max(100).default(0),
});

export type LandingFooterSocial = z.infer<typeof LandingFooterSocialSchema>;

export const LandingFooterContentSchema = z
  .object({
    tagline: z.string().max(600),
    navigationLinks: z.array(LandingFooterLinkSchema).min(1).max(12),
    legalLinks: z.array(LandingFooterLinkSchema).min(1).max(12),
    socialLinks: z.array(LandingFooterSocialSchema).max(12),
    brandingAppName: z.string().max(180).nullable().optional(),
    showBrandingLogo: z.boolean().default(true),
    showBrandingAppName: z.boolean().default(true),
    showBrandingDescription: z.boolean().default(true),
    brandingOrientation: z.enum(['beside', 'above', 'below']).default('beside'),
    showLanguageSwitcher: z.boolean().default(true),
    showThemeSwitcher: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.showBrandingDescription && data.tagline.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tagline'],
        message: 'Tagline is required when footer description is visible.',
      });
    }
  });

export type LandingFooterContent = z.infer<typeof LandingFooterContentSchema>;

export const LandingFaqSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(240),
  answer: z.string().min(1).max(1200),
  imageUrl: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).max(100).default(0),
});

export type LandingFaq = z.infer<typeof LandingFaqSchema>;

// Team section now only stores featured member IDs
// Actual member data comes from team_page_content table
export const LandingTeamSectionSchema = z.object({
  title: z.string().min(1).max(180),
  subtitle: z.string().min(1).max(600),
  featuredMemberIds: z.array(z.string()).max(3).default([]), // IDs of members to show on landing page (from team_page_content)
});

export type LandingTeamSection = z.infer<typeof LandingTeamSectionSchema>;

export const LandingContentSchema = z.object({
  locale: z.string(),
  hero: LandingHeroContentSchema,
  about: LandingAboutContentSchema,
  howItWorks: LandingHowItWorksSchema,
  opportunity: LandingOpportunitySectionSchema,
  affiliateOpportunity: AffiliateOpportunitySectionSchema.optional(),
  testimonials: LandingTestimonialsSectionSchema,
  featuredProducts: LandingFeaturedProductsSectionSchema,
  contact: LandingContactSectionSchema,
  team: LandingTeamSectionSchema,
  header: LandingHeaderContentSchema,
  footer: LandingFooterContentSchema,
  faqs: z.array(LandingFaqSchema).default([]),
  updatedAt: z.string().nullable().optional(),
});

export type LandingContent = z.infer<typeof LandingContentSchema>;

export const LandingContentPayloadSchema = z.object({
  hero: LandingHeroContentSchema.partial().optional(),
  about: LandingAboutContentSchema.partial().optional(),
  howItWorks: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      steps: z.array(LandingStepSchema.partial()).optional(),
    })
    .optional(),
  opportunity: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      duplicationNote: z.string().optional(),
      monthlyFee: z
        .object({
          label: z.string().optional(),
          amount: z.string().optional(),
          description: z.string().optional(),
        })
        .optional(),
      networkCap: z.string().optional(),
      phases: z.array(LandingOpportunityPhaseSchema.partial()).optional(),
      summary: z
        .object({
          title: z.string().optional(),
          description: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  affiliateOpportunity: z
    .object({
      isEnabled: z.boolean().optional(),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      description: z.string().nullable().optional(),
      benefits: z.array(AffiliateOpportunityBenefitSchema.partial()).optional(),
      commissionRate: z.string().nullable().optional(),
      commissionLabel: z.string().nullable().optional(),
      ctaText: z.string().optional(),
      ctaLink: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      backgroundColor: z.string().nullable().optional(),
    })
    .optional(),
  testimonials: z
    .object({
      title: z.string().optional(),
      testimonials: z.array(LandingTestimonialSchema.partial()).optional(),
    })
    .optional(),
  featuredProducts: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      emptyState: z.string().optional(),
    })
    .optional(),
  contact: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      contactInfo: z
        .object({
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.string().optional(),
        })
        .optional(),
      form: z
        .object({
          namePlaceholder: z.string().optional(),
          emailPlaceholder: z.string().optional(),
          messagePlaceholder: z.string().optional(),
          sendButton: z.string().optional(),
          nameLabel: z.string().optional(),
          emailLabel: z.string().optional(),
          messageLabel: z.string().optional(),
          sendingLabel: z.string().optional(),
          successMessage: z.string().optional(),
          errorMessage: z.string().optional(),
          helperText: z.string().optional(),
        })
        .optional(),
      recipientEmail: z.string().optional(),
    })
    .optional(),
  team: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      featuredMemberIds: z.array(z.string()).optional(),
    })
    .optional(),
  header: z
    .object({
      landingLinks: z.array(LandingHeaderLinkSchema.partial()).optional(),
      authenticatedLinks: z.array(LandingHeaderLinkSchema.partial()).optional(),
      primaryAction: LandingHeaderActionSchema.partial().optional(),
      secondaryAction: LandingHeaderActionSchema.partial().optional(),
      showCart: z.boolean().optional(),
    })
    .optional(),
  footer: z
    .object({
      tagline: z.string().optional(),
      navigationLinks: z.array(LandingFooterLinkSchema.partial()).optional(),
      legalLinks: z.array(LandingFooterLinkSchema.partial()).optional(),
      socialLinks: z.array(LandingFooterSocialSchema.partial()).optional(),
      brandingAppName: z.string().nullable().optional(),
      showBrandingLogo: z.boolean().optional(),
      showBrandingAppName: z.boolean().optional(),
      showBrandingDescription: z.boolean().optional(),
      brandingOrientation: z.enum(['beside', 'above', 'below']).optional(),
      showLanguageSwitcher: z.boolean().optional(),
      showThemeSwitcher: z.boolean().optional(),
    })
    .optional(),
  faqs: z.array(LandingFaqSchema.partial()).optional(),
});

export type LandingContentPayload = z.infer<typeof LandingContentPayloadSchema>;

export interface LandingContentRecord {
  locale: Locale;
  hero: Record<string, unknown> | null;
  about: Record<string, unknown> | null;
  how_it_works: Record<string, unknown> | null;
  opportunity: Record<string, unknown> | null;
  testimonials: Record<string, unknown> | null;
  featured_products: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  team: Record<string, unknown> | null;
  header: Record<string, unknown> | null;
  footer: Record<string, unknown> | null;
  faqs: Record<string, unknown>[] | null;
  updated_at: string | null;
}

export const sortFaqsByOrder = (faqs: LandingFaq[]): LandingFaq[] => {
  return [...faqs].sort((a, b) => a.order - b.order);
};

export const sortStepsByOrder = (steps: LandingStep[]): LandingStep[] => {
  return [...steps].sort((a, b) => a.order - b.order);
};

export const sortOpportunityPhasesByOrder = (
  phases: LandingOpportunityPhase[],
): LandingOpportunityPhase[] => {
  return [...phases].sort((a, b) => a.order - b.order);
};

export const sortTestimonialsByOrder = (
  testimonials: LandingTestimonial[],
): LandingTestimonial[] => {
  return [...testimonials].sort((a, b) => a.order - b.order);
};

export const sortHeaderLinksByOrder = (
  links: LandingHeaderLink[],
): LandingHeaderLink[] => {
  return [...links].sort((a, b) => a.order - b.order);
};

export const sortFooterLinksByOrder = (
  links: LandingFooterLink[],
): LandingFooterLink[] => {
  return [...links].sort((a, b) => a.order - b.order);
};

export const sortFooterSocialByOrder = (
  links: LandingFooterSocial[],
): LandingFooterSocial[] => {
  return [...links].sort((a, b) => a.order - b.order);
};
