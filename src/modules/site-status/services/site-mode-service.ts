import {
  PERSISTED_SITE_MODE_OPTIONS,
  SITE_MODE_OPTIONS,
  SiteModeConfiguration,
  SiteModeConfigurationSchema,
  SiteModeSettings,
  SiteModeType,
  SiteModeUpsertInput,
  UpdateSiteModeConfigurationInput,
  UpdateSiteModeConfigurationSchema,
  createDefaultSeoSettings,
  createDefaultAppearance,
  createDefaultComingSoonSettings,
  SiteModeComingSoonSettingsSchema,
  type SiteModeAppearance,
  type SiteModeSocialLink,
  resolveSiteModeSocialPlatform,
} from '../domain/models/site-mode';
import { createSiteModeModule } from '../factories/site-mode-module';

const normalizeKeywords = (
  value: string | Record<string, string> | Record<string, string | null> | undefined
): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return '';
};

const normalizeAppearance = (appearance: SiteModeAppearance): SiteModeAppearance => {
  const background = appearance.backgroundImageUrl ? appearance.backgroundImageUrl.trim() : '';

  const sanitizedLinks = (appearance.socialLinks ?? [])
    .map((link) => {
      const platform = resolveSiteModeSocialPlatform((link as { platform?: string }).platform ?? null);
      const url = typeof link.url === 'string' ? link.url.trim() : '';

      if (!platform || !url) {
        return null;
      }

      return { platform, url } as SiteModeSocialLink;
    })
    .filter((link): link is SiteModeSocialLink => link !== null);

  const overlayOpacity = typeof appearance.backgroundOverlayOpacity === 'number'
    ? Math.max(0, Math.min(100, appearance.backgroundOverlayOpacity))
    : 90;

  return {
    backgroundImageUrl: background.length ? background : null,
    backgroundOverlayOpacity: overlayOpacity,
    socialLinks: sanitizedLinks,
  };
};

const mergeComingSoonSettings = (
  comingSoon: Parameters<typeof SiteModeComingSoonSettingsSchema.parse>[0],
) => {
  try {
    return SiteModeComingSoonSettingsSchema.parse(
      comingSoon ?? createDefaultComingSoonSettings(),
    );
  } catch (error) {
    console.error('[SiteModeService] Failed to parse coming soon settings', error);
    return createDefaultComingSoonSettings();
  }
};

const mergeWithDefaults = (modes: SiteModeSettings[]): SiteModeConfiguration => {
  const merged = SITE_MODE_OPTIONS.map((mode) => {
    const existing = modes.find((item) => item.mode === mode);
    const defaultSeo = createDefaultSeoSettings(mode);
    const defaultAppearance = createDefaultAppearance();

    if (!existing) {
      return {
        mode,
        isActive: false,
        seo: defaultSeo,
        appearance: defaultAppearance,
        mailchimpEnabled: false,
        mailchimpAudienceId: null,
        mailchimpServerPrefix: null,
        comingSoon: createDefaultComingSoonSettings(),
      } satisfies SiteModeSettings;
    }

    return {
      mode,
      isActive: existing.isActive,
      seo: {
        ...defaultSeo,
        ...existing.seo,
        keywords: normalizeKeywords(existing.seo.keywords),
        ogTitle: existing.seo.ogTitle ?? defaultSeo.ogTitle,
        ogDescription: existing.seo.ogDescription ?? defaultSeo.ogDescription,
        ogImage: existing.seo.ogImage ?? defaultSeo.ogImage,
        twitterTitle: existing.seo.twitterTitle ?? defaultSeo.twitterTitle,
        twitterDescription: existing.seo.twitterDescription ?? defaultSeo.twitterDescription,
        twitterImage: existing.seo.twitterImage ?? defaultSeo.twitterImage,
      },
      appearance: normalizeAppearance(existing.appearance ?? defaultAppearance),
      mailchimpEnabled: existing.mailchimpEnabled ?? false,
      mailchimpAudienceId: existing.mailchimpAudienceId ?? null,
      mailchimpServerPrefix: existing.mailchimpServerPrefix ?? null,
      comingSoon: mergeComingSoonSettings(existing.comingSoon ?? undefined),
    } satisfies SiteModeSettings;
  });

  const activeMode = merged.find((item) => item.isActive)?.mode ?? 'none';

  const configuration: SiteModeConfiguration = {
    activeMode,
    modes: merged.map((item) => ({
      ...item,
      isActive: activeMode ? item.mode === activeMode : false,
    })),
  };

  return SiteModeConfigurationSchema.parse(configuration);
};

export const getSiteModeConfiguration = async (): Promise<SiteModeConfiguration> => {
  const { repository } = createSiteModeModule();

  try {
    const storedModes = await repository.fetchAll();

    if (!storedModes.length) {
      return repository.getDefaultConfiguration();
    }

    return mergeWithDefaults(storedModes);
  } catch (error) {
    console.error('[SiteModeService] Failed to fetch configuration', error);
    return repository.getDefaultConfiguration();
  }
};

export const updateSiteModeConfiguration = async (
  input: UpdateSiteModeConfigurationInput,
): Promise<SiteModeConfiguration> => {
  const payload = UpdateSiteModeConfigurationSchema.parse(input);
  const { repository } = createSiteModeModule();

  const upsertPayload: SiteModeUpsertInput[] = PERSISTED_SITE_MODE_OPTIONS.map((mode) => {
    const provided = payload.modes.find((item) => item.mode === mode);
    const defaultSeo = createDefaultSeoSettings(mode);
    const defaultAppearance = createDefaultAppearance();

    if (!provided) {
      return {
        mode,
        isActive: payload.activeMode === mode,
        seo: defaultSeo,
        appearance: defaultAppearance,
        mailchimpEnabled: false,
        mailchimpAudienceId: null,
        mailchimpServerPrefix: null,
        comingSoon: createDefaultComingSoonSettings(),
      } satisfies SiteModeUpsertInput;
    }

    return {
      mode,
      isActive: payload.activeMode === mode,
      seo: {
        ...defaultSeo,
        ...provided.seo,
        keywords: normalizeKeywords(provided.seo.keywords),
        ogTitle: provided.seo.ogTitle ?? defaultSeo.ogTitle,
        ogDescription: provided.seo.ogDescription ?? defaultSeo.ogDescription,
        ogImage: provided.seo.ogImage ?? defaultSeo.ogImage,
        twitterTitle: provided.seo.twitterTitle ?? defaultSeo.twitterTitle,
        twitterDescription: provided.seo.twitterDescription ?? defaultSeo.twitterDescription,
        twitterImage: provided.seo.twitterImage ?? defaultSeo.twitterImage,
      },
      appearance: normalizeAppearance(provided.appearance ?? defaultAppearance),
      mailchimpEnabled: provided.mailchimpEnabled ?? false,
      mailchimpAudienceId: provided.mailchimpAudienceId ?? null,
      mailchimpServerPrefix: provided.mailchimpServerPrefix ?? null,
      comingSoon: mergeComingSoonSettings(provided.comingSoon ?? undefined),
    } satisfies SiteModeUpsertInput;
  });

  const savedModes = await repository.upsertMany(upsertPayload);

  return mergeWithDefaults(savedModes);
};

export const deactivateSiteMode = async (_mode: SiteModeType): Promise<SiteModeConfiguration> => {
  const { repository } = createSiteModeModule();

  const currentConfig = await getSiteModeConfiguration();

  // Desactivar todos los modos
  const updatedModes = currentConfig.modes.map((item) => ({
    ...item,
    isActive: false,
  }));

  const upsertPayload: SiteModeUpsertInput[] = updatedModes
    .filter((item) => item.mode !== 'none')
    .map((item) => ({
      mode: item.mode,
      isActive: item.isActive,
      seo: item.seo,
      appearance: item.appearance,
      mailchimpEnabled: item.mailchimpEnabled,
      mailchimpAudienceId: item.mailchimpAudienceId,
      mailchimpServerPrefix: item.mailchimpServerPrefix,
      comingSoon: item.comingSoon,
    }));

  const savedModes = await repository.upsertMany(upsertPayload);

  return mergeWithDefaults(savedModes);
};
