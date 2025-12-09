import { z } from 'zod';

export const TutorialStepSchema = z.object({
  title: z.string().min(1, 'Step title is required'),
  description: z.string().min(1, 'Step description is required'),
  image_url: z.string().optional(),
  action_type: z.string().optional(),
});

export const TutorialSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable(),
  content: z.array(TutorialStepSchema).min(1, 'At least one step is required'),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const TutorialCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable(),
  content: z.array(TutorialStepSchema).min(1, 'At least one step is required'),
  is_active: z.boolean().default(true),
});

export const TutorialUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().nullable().optional(),
  content: z.array(TutorialStepSchema).min(1, 'At least one step is required').optional(),
  is_active: z.boolean().optional(),
});

export type Tutorial = z.infer<typeof TutorialSchema>;
export type TutorialStep = z.infer<typeof TutorialStepSchema>;
export type TutorialCreateInput = z.infer<typeof TutorialCreateSchema>;
export type TutorialUpdateInput = z.infer<typeof TutorialUpdateSchema>;