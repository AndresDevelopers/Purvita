import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import {
  LandingContentSchema,
  LandingFaqSchema,
  LandingStepSchema,
  sortFaqsByOrder,
  sortStepsByOrder,
  type LandingContent,
  type LandingContentPayload,
  type LandingContentRecord,
} from '../domain/models/landing-content';

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1464639351491-a172c2aa2911?auto=format&fit=crop&w=1400&q=80';
const DEFAULT_ABOUT_IMAGE =
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80';

const normalizeOptional = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const createDefaultLandingContent = (locale: Locale, _appName: string): LandingContent => {
  const dictionary = getDictionary(locale);

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

  return LandingContentSchema.parse({
    locale,
    hero: {
      title: dictionary.landing.heroTitle,
      subtitle: dictionary.landing.heroSubtitle,
      backgroundImageUrl: DEFAULT_HERO_IMAGE,
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
    faqs: [],
    updatedAt: null,
  });
};

const mergeHeroSection = (payload: LandingContentPayload, defaults: LandingContent) => {
  return payload.hero
    ? {
        title: payload.hero.title ?? defaults.hero.title,
        subtitle: payload.hero.subtitle ?? defaults.hero.subtitle,
        backgroundImageUrl: normalizeOptional(payload.hero.backgroundImageUrl) ?? defaults.hero.backgroundImageUrl,
      }
    : defaults.hero;
};

const mergeAboutSection = (payload: LandingContentPayload, defaults: LandingContent) => {
  return payload.about
    ? {
        title: payload.about.title ?? defaults.about.title,
        description: payload.about.description ?? defaults.about.description,
        secondaryDescription:
          normalizeOptional(payload.about.secondaryDescription) ?? defaults.about.secondaryDescription,
        imageUrl: normalizeOptional(payload.about.imageUrl) ?? defaults.about.imageUrl,
      }
    : defaults.about;
};

const mergeHowItWorksSection = (payload: LandingContentPayload, defaults: LandingContent) => {
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

  return {
    title: payload.howItWorks?.title ?? defaults.howItWorks.title,
    subtitle: payload.howItWorks?.subtitle ?? defaults.howItWorks.subtitle,
    steps,
  };
};

const mergeFaqsSection = (payload: LandingContentPayload, defaults: LandingContent) => {
  return payload.faqs?.length
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
};

export const mergeLandingContent = (
  locale: Locale,
  appName: string,
  record: LandingContentRecord | null,
): LandingContent => {
  const defaults = createDefaultLandingContent(locale, appName);

  if (!record) {
    return defaults;
  }

  const payload: LandingContentPayload = {
    hero: record.hero ?? undefined,
    about: record.about ?? undefined,
    howItWorks: record.how_it_works ?? undefined,
    faqs: record.faqs ?? undefined,
  };

  const hero = mergeHeroSection(payload, defaults);
  const about = mergeAboutSection(payload, defaults);
  const howItWorks = mergeHowItWorksSection(payload, defaults);
  const faqs = mergeFaqsSection(payload, defaults);

  return LandingContentSchema.parse({
    locale,
    hero,
    about,
    howItWorks,
    faqs,
    updatedAt: record.updated_at,
  });
};