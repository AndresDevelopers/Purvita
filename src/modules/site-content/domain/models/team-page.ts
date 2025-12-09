import { z } from 'zod';

// Team Member Schema
export const TeamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  description: z.string().max(600).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).max(100).default(0),
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;

// Team Page Content Schema
export const TeamPageContentSchema = z.object({
  locale: z.string(),
  title: z.string().min(1).max(180),
  subtitle: z.string().min(1).max(600),
  members: z.array(TeamMemberSchema).min(0).max(50),
  featuredMemberIds: z.array(z.string()).max(3).default([]),
  updatedAt: z.string().nullable().optional(),
});

export type TeamPageContent = z.infer<typeof TeamPageContentSchema>;

// Update Input Schema
export const TeamPageContentUpdateSchema = z.object({
  title: z.string().min(1).max(180),
  subtitle: z.string().min(1).max(600),
  members: z.array(TeamMemberSchema).min(0).max(50),
  featuredMemberIds: z.array(z.string()).max(3).default([]),
});

export type TeamPageContentUpdateInput = z.infer<typeof TeamPageContentUpdateSchema>;

// Partial update schema for flexible updates
export const TeamPageContentPayloadSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  subtitle: z.string().min(1).max(600).optional(),
  members: z.array(TeamMemberSchema).optional(),
  featuredMemberIds: z.array(z.string()).max(3).optional(),
});

export type TeamPageContentPayload = z.infer<typeof TeamPageContentPayloadSchema>;

// Helper function to sort team members by order
export const sortTeamMembersByOrder = (members: TeamMember[]): TeamMember[] => {
  return [...members].sort((a, b) => a.order - b.order);
};

