import { z } from 'zod';

// Contact Page Schema
export const ContactPageSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  contactInfo: z.object({
    title: z.string(),
    email: z.string(),
    phone: z.string(),
    hours: z.string(),
  }),
  whyReachOut: z.object({
    title: z.string(),
    items: z.array(z.string()),
  }),
});

export type ContactPage = z.infer<typeof ContactPageSchema>;

export const ContactPageUpdateSchema = ContactPageSchema;

export type ContactPageUpdateInput = z.infer<typeof ContactPageUpdateSchema>;

// Privacy Policy Schema
export const PrivacyPolicySchema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.object({
    informationWeCollect: z.object({
      title: z.string(),
      content: z.string(),
      details: z.string(),
    }),
    howWeUseInformation: z.object({
      title: z.string(),
      content: z.string(),
    }),
    dataProtection: z.object({
      title: z.string(),
      content: z.string(),
    }),
  }),
});

export type PrivacyPolicy = z.infer<typeof PrivacyPolicySchema>;

export const PrivacyPolicyUpdateSchema = PrivacyPolicySchema;

export type PrivacyPolicyUpdateInput = z.infer<typeof PrivacyPolicyUpdateSchema>;

// Terms of Service Schema
export const TermsOfServiceSchema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.object({
    license: z.object({
      title: z.string(),
      content: z.string(),
      restrictions: z.object({
        title: z.string(),
        items: z.array(z.string()),
      }),
    }),
    userContent: z.object({
      title: z.string(),
      content: z.string(),
    }),
    limitationOfLiability: z.object({
      title: z.string(),
      content: z.string(),
    }),
  }),
});

export type TermsOfService = z.infer<typeof TermsOfServiceSchema>;

export const TermsOfServiceUpdateSchema = TermsOfServiceSchema;

export type TermsOfServiceUpdateInput = z.infer<typeof TermsOfServiceUpdateSchema>;

// Combined Static Pages Schema
export const StaticPagesSchema = z.object({
  locale: z.string(),
  contact: ContactPageSchema,
  privacy: PrivacyPolicySchema,
  terms: TermsOfServiceSchema,
  updatedAt: z.string().nullable().optional(),
});

export type StaticPages = z.infer<typeof StaticPagesSchema>;

export const StaticPagesUpdateSchema = z.object({
  contact: ContactPageUpdateSchema,
  privacy: PrivacyPolicyUpdateSchema,
  terms: TermsOfServiceUpdateSchema,
});

export type StaticPagesUpdateInput = z.infer<typeof StaticPagesUpdateSchema>;

