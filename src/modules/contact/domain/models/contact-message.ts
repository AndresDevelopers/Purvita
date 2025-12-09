import { z } from 'zod';
import type { Locale } from '@/i18n/config';

export const ContactMessageSchema = z.object({
  name: z.string().min(1).max(180),
  email: z.string().email().max(180),
  message: z.string().min(1).max(4000),
});

export type ContactMessageInput = z.infer<typeof ContactMessageSchema> & { locale: Locale };

export const ContactMessageLogSchema = z.object({
  id: z.string().uuid().optional(),
  locale: z.string().min(2).max(5),
  name: z.string().min(1).max(180),
  email: z.string().email().max(180),
  message: z.string().min(1).max(4000),
  recipientEmail: z.string().email().max(180),
  subject: z.string().min(1).max(240),
  status: z.enum(['sent', 'failed']),
  errorMessage: z.string().max(1000).nullable(),
});

export type ContactMessageLogEntry = z.infer<typeof ContactMessageLogSchema>;
