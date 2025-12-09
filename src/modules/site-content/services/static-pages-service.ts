import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createSiteContentModule } from '../factories/site-content-module';
import {
  StaticPagesSchema,
  type StaticPages,
  type StaticPagesUpdateInput,
} from '../domain/models/static-pages';

const getRepository = () => createSiteContentModule().repository;

/**
 * Creates default static pages content from dictionary
 */
export const createDefaultStaticPages = (locale: Locale, appName: string): StaticPages => {
  const dict = getDictionary(locale, appName);

  return {
    locale,
    contact: {
      title: dict.contact?.title ?? 'Contact Us',
      subtitle: dict.contact?.subtitle ?? 'Get in touch with us',
      contactInfo: {
        title: dict.contact?.infoTitle ?? 'Contact Information',
        email: 'info@ejemplo.com',
        phone: '+123 456 7890',
        hours: dict.contact?.defaultHours ?? 'Monday to Friday, 9:00 - 18:00',
      },
      whyReachOut: {
        title: dict.contact?.whyContactTitle ?? 'Why Reach Out?',
        items: dict.contact?.whyContactItems ? [...dict.contact.whyContactItems] : [
          'General inquiries',
          'Product support',
          'Partnership opportunities',
        ],
      },
    },
    privacy: {
      title: dict.footer?.privacyTitle ?? 'Privacy Policy',
      intro: dict.landing?.privacy?.intro?.replace('{{appName}}', appName) ?? '',
      sections: {
        informationWeCollect: {
          title: dict.landing?.privacy?.sections?.informationWeCollect?.title ?? '1. Information We Collect',
          content: dict.landing?.privacy?.sections?.informationWeCollect?.content ?? '',
          details: dict.landing?.privacy?.sections?.informationWeCollect?.details ?? '',
        },
        howWeUseInformation: {
          title: dict.landing?.privacy?.sections?.howWeUseInformation?.title ?? '2. How We Use Information',
          content: dict.landing?.privacy?.sections?.howWeUseInformation?.content ?? '',
        },
        dataProtection: {
          title: '3. Data Protection',
          content: 'We take precautions to protect your information. When you submit sensitive information via the website, your information is protected both online and offline.',
        },
      },
    },
    terms: {
      title: dict.footer?.termsTitle ?? 'Terms of Service',
      intro: dict.landing?.terms?.intro?.replace('{{appName}}', appName) ?? '',
      sections: {
        license: {
          title: dict.landing?.terms?.sections?.license?.title ?? '1. License to Use the Website',
          content: dict.landing?.terms?.sections?.license?.content?.replace(/\{\{appName\}\}/g, appName) ?? '',
          restrictions: {
            title: dict.landing?.terms?.sections?.license?.restrictions?.title ?? 'You must not:',
            items: dict.landing?.terms?.sections?.license?.restrictions?.items?.map((item: string) => 
              item.replace(/\{\{appName\}\}/g, appName)
            ) ?? [],
          },
        },
        userContent: {
          title: dict.landing?.terms?.sections?.userContent?.title ?? '2. User Content',
          content: dict.landing?.terms?.sections?.userContent?.content?.replace(/\{\{appName\}\}/g, appName) ?? '',
        },
        limitationOfLiability: {
          title: dict.landing?.terms?.sections?.limitationOfLiability?.title ?? '3. Limitation of Liability',
          content: dict.landing?.terms?.sections?.limitationOfLiability?.content?.replace(/\{\{appName\}\}/g, appName) ?? '',
        },
      },
    },
    updatedAt: null,
  };
};

/**
 * Merges stored static pages with defaults
 */
const mergeStaticPages = (
  locale: Locale,
  appName: string,
  stored: Partial<StaticPages> | null,
): StaticPages => {
  const defaults = createDefaultStaticPages(locale, appName);

  if (!stored) {
    return defaults;
  }

  return StaticPagesSchema.parse({
    locale,
    contact: stored.contact ?? defaults.contact,
    privacy: stored.privacy ?? defaults.privacy,
    terms: stored.terms ?? defaults.terms,
    updatedAt: stored.updatedAt ?? null,
  });
};

/**
 * Gets static pages content for a locale
 */
export const getStaticPages = async (locale: Locale, appName: string): Promise<StaticPages> => {
  const repository = getRepository();
  const stored = await repository.fetchStaticPages(locale);
  return mergeStaticPages(locale, appName, stored);
};

/**
 * Updates static pages content
 */
export const updateStaticPages = async (
  locale: Locale,
  payload: StaticPagesUpdateInput,
): Promise<StaticPages> => {
  const repository = getRepository();
  
  const updateData = {
    contact: {
      title: payload.contact.title.trim(),
      subtitle: payload.contact.subtitle.trim(),
      contactInfo: {
        title: payload.contact.contactInfo.title.trim(),
        email: payload.contact.contactInfo.email.trim(),
        phone: payload.contact.contactInfo.phone.trim(),
        hours: payload.contact.contactInfo.hours.trim(),
      },
      whyReachOut: {
        title: payload.contact.whyReachOut.title.trim(),
        items: payload.contact.whyReachOut.items.map(item => item.trim()),
      },
    },
    privacy: {
      title: payload.privacy.title.trim(),
      intro: payload.privacy.intro.trim(),
      sections: {
        informationWeCollect: {
          title: payload.privacy.sections.informationWeCollect.title.trim(),
          content: payload.privacy.sections.informationWeCollect.content.trim(),
          details: payload.privacy.sections.informationWeCollect.details.trim(),
        },
        howWeUseInformation: {
          title: payload.privacy.sections.howWeUseInformation.title.trim(),
          content: payload.privacy.sections.howWeUseInformation.content.trim(),
        },
        dataProtection: {
          title: payload.privacy.sections.dataProtection.title.trim(),
          content: payload.privacy.sections.dataProtection.content.trim(),
        },
      },
    },
    terms: {
      title: payload.terms.title.trim(),
      intro: payload.terms.intro.trim(),
      sections: {
        license: {
          title: payload.terms.sections.license.title.trim(),
          content: payload.terms.sections.license.content.trim(),
          restrictions: {
            title: payload.terms.sections.license.restrictions.title.trim(),
            items: payload.terms.sections.license.restrictions.items.map(item => item.trim()),
          },
        },
        userContent: {
          title: payload.terms.sections.userContent.title.trim(),
          content: payload.terms.sections.userContent.content.trim(),
        },
        limitationOfLiability: {
          title: payload.terms.sections.limitationOfLiability.title.trim(),
          content: payload.terms.sections.limitationOfLiability.content.trim(),
        },
      },
    },
  };

  await repository.updateStaticPages(locale, updateData);
  
  const updated = await repository.fetchStaticPages(locale);
  return StaticPagesSchema.parse({
    ...updated,
    locale,
  });
};

