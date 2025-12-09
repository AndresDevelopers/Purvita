import { z } from 'zod';

/**
 * Advertising Scripts Schema
 * Stores advertising and tracking scripts for the main website
 * These scripts are injected ONLY in main public pages, NOT in affiliate pages
 */
export const AdvertisingScriptsSchema = z.object({
  id: z.string().default('global'),
  
  // Facebook Pixel
  facebookPixelEnabled: z.boolean().default(false),
  facebookPixelId: z.string().nullable().optional(),
  facebookPixelScript: z.string().nullable().optional(),
  
  // TikTok Pixel
  tiktokPixelEnabled: z.boolean().default(false),
  tiktokPixelId: z.string().nullable().optional(),
  tiktokPixelScript: z.string().nullable().optional(),
  
  // Google Tag Manager
  gtmEnabled: z.boolean().default(false),
  gtmContainerId: z.string().nullable().optional(),
  gtmScript: z.string().nullable().optional(),
  
  // Metadata
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export type AdvertisingScripts = z.infer<typeof AdvertisingScriptsSchema>;

/**
 * Update schema for advertising scripts
 */
export const AdvertisingScriptsUpdateSchema = AdvertisingScriptsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdvertisingScriptsUpdateInput = z.infer<typeof AdvertisingScriptsUpdateSchema>;

/**
 * Default advertising scripts configuration
 */
export const DEFAULT_ADVERTISING_SCRIPTS: AdvertisingScripts = {
  id: 'global',
  facebookPixelEnabled: false,
  facebookPixelId: null,
  facebookPixelScript: null,
  tiktokPixelEnabled: false,
  tiktokPixelId: null,
  tiktokPixelScript: null,
  gtmEnabled: false,
  gtmContainerId: null,
  gtmScript: null,
  createdAt: null,
  updatedAt: null,
};

