import { z } from 'zod';

export const ContactSettingsSchema = z.object({
  id: z.string(),
  fromName: z.string().min(1).max(120),
  fromEmail: z.string().email().max(180),
  replyToEmail: z.string().email().max(180).nullable(),
  recipientEmailOverride: z.string().email().max(180).nullable(),
  ccEmails: z.array(z.string().email().max(180)),
  bccEmails: z.array(z.string().email().max(180)),
  subjectPrefix: z.string().max(120).nullable(),
  autoResponseEnabled: z.boolean(),
  autoResponseSubject: z.string().max(180).nullable(),
  autoResponseBody: z.string().max(4000).nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type ContactSettings = z.infer<typeof ContactSettingsSchema>;

export const ContactSettingsUpdateSchema = ContactSettingsSchema.pick({
  fromName: true,
  fromEmail: true,
  replyToEmail: true,
  recipientEmailOverride: true,
  ccEmails: true,
  bccEmails: true,
  subjectPrefix: true,
  autoResponseEnabled: true,
  autoResponseSubject: true,
  autoResponseBody: true,
});

export type ContactSettingsUpdateInput = z.infer<typeof ContactSettingsUpdateSchema>;

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  id: 'global',
  fromName: 'Landing Contact',
  fromEmail: 'no-reply@example.com',
  replyToEmail: null,
  recipientEmailOverride: null,
  ccEmails: [],
  bccEmails: [],
  subjectPrefix: '[Contact]',
  autoResponseEnabled: false,
  autoResponseSubject: null,
  autoResponseBody: null,
  createdAt: null,
  updatedAt: null,
};

export const ContactSettingsResponseSchema = z.object({
  settings: ContactSettingsSchema,
  environment: z.object({
    hasEmailProvider: z.boolean(),
    fromAddressConfigured: z.boolean(),
    fromNameConfigured: z.boolean(),
  }),
});

export type ContactSettingsResponse = z.infer<typeof ContactSettingsResponseSchema>;
