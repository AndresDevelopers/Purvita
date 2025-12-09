import { z } from 'zod';

export const SiteBrandingSchema = z.object({
  appName: z.string().min(1, 'App name is required').max(100),
  logoUrl: z.string().max(500).nullable().optional(),
  faviconUrl: z.string().max(500).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  showLogo: z.boolean().default(true),
  logoPosition: z.enum(['beside', 'above', 'below']).default('beside'),
  showAppName: z.boolean().default(true),
  updatedAt: z.string().nullable().optional(),
});

export type SiteBranding = z.infer<typeof SiteBrandingSchema>;

export const SiteBrandingUpdateSchema = SiteBrandingSchema.omit({
  updatedAt: true,
}).extend({
  logoUrl: z.string().max(500).nullable().optional(),
  faviconUrl: z.string().max(500).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export type SiteBrandingUpdateInput = z.infer<typeof SiteBrandingUpdateSchema>;

export const createDefaultBranding = (appName: string): SiteBranding => ({
  appName,
  logoUrl: null,
  faviconUrl: null,
  description: null,
  showLogo: true,
  logoPosition: 'beside',
  showAppName: true,
  updatedAt: null,
});
