import type {
  TeamMessage,
  TeamMessageCreateInput,
} from '../models/team-message';

export interface TeamMessageRepository {
  listByParticipant(userId: string): Promise<TeamMessage[]>;
  createMessage(input: TeamMessageCreateInput): Promise<TeamMessage>;
  findById(messageId: string): Promise<TeamMessage | null>;
  markMessagesAsRead(messageIds: string[], recipientId: string): Promise<number>;
  deleteMessage(messageId: string, userId: string): Promise<boolean>;
}
