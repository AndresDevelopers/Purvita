import { Facebook, Instagram, Youtube, Twitter, MessageCircle, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SITE_MODE_SOCIAL_PLATFORM_LABELS,
  SITE_MODE_SOCIAL_PLATFORMS,
  type SiteModeSocialPlatform,
} from '@/modules/site-status/domain/models/site-mode';

const SOCIAL_ICON_MAP: Record<SiteModeSocialPlatform, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  x: Twitter,
  whatsapp: MessageCircle,
};

export const getSocialIconForPlatform = (platform: SiteModeSocialPlatform): LucideIcon => {
  return SOCIAL_ICON_MAP[platform] ?? Globe;
};

export const buildSocialPlatformLabelMap = (
  overrides?: Partial<Record<SiteModeSocialPlatform, string>>,
): Record<SiteModeSocialPlatform, string> => {
  return SITE_MODE_SOCIAL_PLATFORMS.reduce<Record<SiteModeSocialPlatform, string>>((acc, platform) => {
    const override = overrides?.[platform];
    const fallback = SITE_MODE_SOCIAL_PLATFORM_LABELS[platform];
    acc[platform] =
      typeof override === 'string' && override.trim().length > 0 ? override : fallback;
    return acc;
  }, {} as Record<SiteModeSocialPlatform, string>);
};
