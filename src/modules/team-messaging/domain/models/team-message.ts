import { z } from 'zod';

export const TeamMessageParticipantSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
});

export type TeamMessageParticipant = z.infer<typeof TeamMessageParticipantSchema>;

export const TeamMessageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  recipientId: z.string().uuid(),
  body: z.string().min(1).max(2_000),
  parentMessageId: z.string().uuid().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  sender: TeamMessageParticipantSchema,
  recipient: TeamMessageParticipantSchema,
});

export type TeamMessage = z.infer<typeof TeamMessageSchema>;

export const TeamMessageThreadSchema = z.object({
  threadId: z.string().uuid(),
  members: z.array(TeamMessageParticipantSchema),
  messages: z.array(TeamMessageSchema),
  unreadCount: z.number().int().nonnegative(),
  lastMessageAt: z.string(),
});

export type TeamMessageThread = z.infer<typeof TeamMessageThreadSchema>;

export const TeamMessageThreadListSchema = z.array(TeamMessageThreadSchema);

export const TeamMessageCreateInputSchema = z.object({
  senderId: z.string().uuid(),
  recipientId: z.string().uuid(),
  body: z.string().min(1).max(2_000),
  parentMessageId: z.string().uuid().nullable().optional(),
});

export type TeamMessageCreateInput = z.infer<typeof TeamMessageCreateInputSchema>;

export const TeamMessageSendRequestSchema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().min(1).max(2_000),
  parentMessageId: z.string().uuid().nullable().optional(),
});

export type TeamMessageSendRequest = z.infer<typeof TeamMessageSendRequestSchema>;

export const TeamMessageMarkReadSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1),
});

export type TeamMessageMarkReadInput = z.infer<typeof TeamMessageMarkReadSchema>;
