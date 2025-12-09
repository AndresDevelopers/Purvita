import { z } from 'zod';

/**
 * Schema for Affiliate Page Configuration
 * Defines the structure for affiliate page settings
 */
export const AffiliatePageConfigSchema = z.object({
  header: z.object({
    showCart: z.boolean().default(true),
    showUserMenu: z.boolean().default(true),
    allowCustomLogo: z.boolean().default(true),
    allowCustomStoreName: z.boolean().default(true),
  }),
  footer: z.object({
    showFooter: z.boolean().default(true),
    inheritSocialLinks: z.boolean().default(true),
    showBranding: z.boolean().default(true),
    showLanguageSwitcher: z.boolean().default(true),
  }),
  settings: z.object({
    allowCustomBanner: z.boolean().default(true),
    allowCustomStoreTitle: z.boolean().default(true),
    showPoweredByBadge: z.boolean().default(true),
  }),
});

export type AffiliatePageConfig = z.infer<typeof AffiliatePageConfigSchema>;

/**
 * Default configuration for affiliate pages
 */
export const defaultAffiliatePageConfig: AffiliatePageConfig = {
  header: {
    showCart: true,
    showUserMenu: true,
    allowCustomLogo: true,
    allowCustomStoreName: true,
  },
  footer: {
    showFooter: true,
    inheritSocialLinks: true,
    showBranding: true,
    showLanguageSwitcher: true,
  },
  settings: {
    allowCustomBanner: true,
    allowCustomStoreTitle: true,
    showPoweredByBadge: true,
  },
};
