import { z } from 'zod';
import type { Locale as _Locale } from '@/i18n/config';

export const VideoTranslationSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  locale: z.string(),
  title: z.string().min(1),
  description: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type VideoTranslation = z.infer<typeof VideoTranslationSchema>;

export const VideoWithTranslationsSchema = z.object({
  id: z.string().uuid(),
  youtube_id: z.string().min(1),
  category: z.string().optional().nullable(),
  visibility: z.enum(['subscription', 'product', 'all']),
  allowed_levels: z.array(z.number().int()).nullable().optional(),
  is_published: z.boolean(),
  is_featured: z.boolean(),
  order_index: z.number().int().min(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  translations: z.record(z.string(), VideoTranslationSchema),
});

export type VideoWithTranslations = z.infer<typeof VideoWithTranslationsSchema>;
