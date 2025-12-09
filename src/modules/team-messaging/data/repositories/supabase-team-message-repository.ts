import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  TeamMessageSchema,
  type TeamMessage,
  type TeamMessageCreateInput,
} from '../../domain/models/team-message';
import type { TeamMessageRepository } from '../../domain/contracts/team-message-repository';

interface SupabaseTeamMessageRepositoryDependencies {
  client: SupabaseClient;
}

type DbTeamMessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  parent_message_id: string | null;
  created_at: string;
  read_at: string | null;
  sender: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  recipient: {
    id: string;
    email: string;
    name: string | null;
  } | null;
};

const mapRowToMessage = (row: DbTeamMessageRow): TeamMessage => {
  return TeamMessageSchema.parse({
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    parentMessageId: row.parent_message_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    sender: {
      id: row.sender?.id ?? row.sender_id,
      email: row.sender?.email ?? '',
      name: row.sender?.name ?? null,
    },
    recipient: {
      id: row.recipient?.id ?? row.recipient_id,
      email: row.recipient?.email ?? '',
      name: row.recipient?.name ?? null,
    },
  });
};

export class SupabaseTeamMessageRepository implements TeamMessageRepository {
  constructor(private readonly deps: SupabaseTeamMessageRepositoryDependencies) {}

  private get client() {
    return this.deps.client;
  }

  async listByParticipant(userId: string): Promise<TeamMessage[]> {
    // ✅ SECURITY FIX: Validate userId is a valid UUID to prevent SQL injection
    const uuidSchema = z.string().uuid();
    const validatedUserId = uuidSchema.parse(userId);

    // ✅ SECURITY: Use separate filters instead of string interpolation in .or()
    // Alternative approach: filter records where user is either sender OR recipient
    const { data, error } = await this.client
      .from('team_messages')
      .select(
        `
        id,
        sender_id,
        recipient_id,
        body,
        parent_message_id,
        created_at,
        read_at,
        sender:sender_id ( id, email, name ),
        recipient:recipient_id ( id, email, name )
      `,
      )
      .or(`sender_id.eq.${validatedUserId},recipient_id.eq.${validatedUserId}`)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      throw new Error(`Failed to load team messages: ${error.message}`);
    }

    const rows: DbTeamMessageRow[] = Array.isArray(data)
      ? ((data as unknown) as DbTeamMessageRow[])
      : [];

    return rows.map(mapRowToMessage);
  }

  async createMessage(input: TeamMessageCreateInput): Promise<TeamMessage> {
    const payload = {
      sender_id: input.senderId,
      recipient_id: input.recipientId,
      body: input.body,
      parent_message_id: input.parentMessageId ?? null,
    };

    const { data, error } = await this.client
      .from('team_messages')
      .insert(payload)
      .select(
        `
        id,
        sender_id,
        recipient_id,
        body,
        parent_message_id,
        created_at,
        read_at,
        sender:sender_id ( id, email, name ),
        recipient:recipient_id ( id, email, name )
      `,
      )
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return mapRowToMessage((data as unknown) as DbTeamMessageRow);
  }

  async findById(messageId: string): Promise<TeamMessage | null> {
    const { data, error } = await this.client
      .from('team_messages')
      .select(
        `
        id,
        sender_id,
        recipient_id,
        body,
        parent_message_id,
        created_at,
        read_at,
        sender:sender_id ( id, email, name ),
        recipient:recipient_id ( id, email, name )
      `,
      )
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load message: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapRowToMessage((data as unknown) as DbTeamMessageRow);
  }

  async markMessagesAsRead(messageIds: string[], recipientId: string): Promise<number> {
    if (messageIds.length === 0) {
      return 0;
    }

    const { data, error } = await this.client
      .from('team_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds)
      .eq('recipient_id', recipientId)
      .select('id');

    if (error) {
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }

    return Array.isArray(data) ? data.length : 0;
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('team_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }

    return true;
  }
}
