import type { TreeService } from '@/modules/multilevel/services/tree-service';
import type { TeamMessageRepository } from '../domain/contracts/team-message-repository';
import {
  TeamMessageCreateInputSchema,
  TeamMessageThreadSchema,
  type TeamMessage,
  type TeamMessageCreateInput,
  type TeamMessageThread,
} from '../domain/models/team-message';
import { TeamMessagingError } from '../domain/errors/team-messaging-error';

const normalizeThread = (thread: TeamMessageThread): TeamMessageThread => {
  return TeamMessageThreadSchema.parse(thread);
};

export class TeamMessagingService {
  constructor(
    private readonly repository: TeamMessageRepository,
    private readonly treeService: TreeService,
  ) {}

  async listThreadsForUser(userId: string): Promise<TeamMessageThread[]> {
    const messages = await this.repository.listByParticipant(userId);

    const byThread = new Map<string, TeamMessageThread>();

    messages.forEach((message) => {
      const threadId = message.parentMessageId ?? message.id;
      const thread = byThread.get(threadId) ?? {
        threadId,
        members: [],
        messages: [],
        unreadCount: 0,
        lastMessageAt: message.createdAt,
      };

      const memberIds = new Set(thread.members.map((member) => member.id));
      if (!memberIds.has(message.sender.id)) {
        thread.members.push(message.sender);
      }
      if (!memberIds.has(message.recipient.id)) {
        thread.members.push(message.recipient);
      }

      thread.messages.push(message);

      if (message.recipientId === userId && !message.readAt) {
        thread.unreadCount += 1;
      }

      if (new Date(message.createdAt).getTime() > new Date(thread.lastMessageAt).getTime()) {
        thread.lastMessageAt = message.createdAt;
      }

      byThread.set(threadId, thread);
    });

    const threads = Array.from(byThread.values()).map((thread) => {
      const sorted = {
        ...thread,
        messages: [...thread.messages].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      };

      return normalizeThread(sorted);
    });

    return threads.sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
  }

  async sendMessage(input: TeamMessageCreateInput): Promise<TeamMessage> {
    const payload = TeamMessageCreateInputSchema.parse(input);

    if (payload.senderId === payload.recipientId && !payload.parentMessageId) {
      throw new TeamMessagingError(
        'self_message_not_allowed',
        'You cannot send messages to yourself.',
      );
    }

    let recipientId = payload.recipientId;
    let parentMessageId = payload.parentMessageId ?? null;

    if (parentMessageId) {
      const parent = await this.repository.findById(parentMessageId);
      if (!parent) {
        throw new TeamMessagingError(
          'parent_message_not_found',
          'The conversation you are replying to no longer exists.',
        );
      }

      const isParticipant =
        parent.senderId === payload.senderId || parent.recipientId === payload.senderId;

      if (!isParticipant) {
        throw new TeamMessagingError(
          'not_participant',
          'You are not a participant in this conversation.',
        );
      }

      recipientId = parent.senderId === payload.senderId ? parent.recipientId : parent.senderId;
      parentMessageId = parent.parentMessageId ?? parent.id;
    } else {
      const allowed = await this.isRecipientInTeam(payload.senderId, recipientId);
      if (!allowed) {
        throw new TeamMessagingError(
          'recipient_not_in_team',
          'You can only message members in your organisation.',
        );
      }
    }

    return this.repository.createMessage({
      ...payload,
      recipientId,
      parentMessageId,
    });
  }

  async markMessagesAsRead(userId: string, messageIds: string[]) {
    if (messageIds.length === 0) {
      return 0;
    }

    return this.repository.markMessagesAsRead(messageIds, userId);
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const message = await this.repository.findById(messageId);

    if (!message) {
      throw new TeamMessagingError(
        'message_not_found',
        'The message you are trying to delete does not exist.',
      );
    }

    if (message.senderId !== userId) {
      throw new TeamMessagingError(
        'not_message_owner',
        'You can only delete your own messages.',
      );
    }

    return this.repository.deleteMessage(messageId, userId);
  }

  private async isRecipientInTeam(userId: string, recipientId: string) {
    const { level1, level2 } = await this.treeService.fetchTwoLevelTree(userId);
    const match = [...level1, ...level2].some((member) => member.id === recipientId);
    return match;
  }
}
