import { z } from 'zod';

export const UserTutorialProgressSchema = z.object({
  user_id: z.string().uuid(),
  tutorial_id: z.string().uuid(),
  current_step: z.number().int().min(0),
  completed: z.boolean(),
  skipped: z.boolean(),
  completed_at: z.string().nullable(),
  skipped_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const UserTutorialProgressCreateSchema = z.object({
  user_id: z.string().uuid(),
  tutorial_id: z.string().uuid(),
  current_step: z.number().int().min(0).default(0),
  completed: z.boolean().default(false),
  skipped: z.boolean().default(false),
});

export const UserTutorialProgressUpdateSchema = z.object({
  current_step: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

export const UserTutorialStatusSchema = z.object({
  tutorial_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  current_step: z.number().int().min(0),
  total_steps: z.number().int().min(1),
  completed: z.boolean(),
  skipped: z.boolean(),
  show_tutorial: z.boolean(),
});

export type UserTutorialProgress = z.infer<typeof UserTutorialProgressSchema>;
export type UserTutorialProgressCreateInput = z.infer<typeof UserTutorialProgressCreateSchema>;
export type UserTutorialProgressUpdateInput = z.infer<typeof UserTutorialProgressUpdateSchema>;
export type UserTutorialStatus = z.infer<typeof UserTutorialStatusSchema>;