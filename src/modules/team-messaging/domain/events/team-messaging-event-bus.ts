import type { TeamMessage, TeamMessageThread } from '../models/team-message';

export type TeamMessagingEvent =
  | { type: 'threads_loading' }
  | { type: 'threads_loaded'; threads: TeamMessageThread[] }
  | { type: 'threads_error'; error: Error }
  | { type: 'message_sending'; recipientId: string }
  | { type: 'message_sent'; message: TeamMessage }
  | { type: 'message_send_failed'; error: Error }
  | { type: 'messages_marked_read'; messageIds: string[] }
  | { type: 'mark_read_failed'; error: Error }
  | { type: 'message_deleting'; messageId: string }
  | { type: 'message_deleted'; messageId: string }
  | { type: 'message_delete_failed'; error: Error };

export type TeamMessagingObserver = (event: TeamMessagingEvent) => void;

export class TeamMessagingEventBus {
  private observers = new Set<TeamMessagingObserver>();

  subscribe(observer: TeamMessagingObserver) {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  emit(event: TeamMessagingEvent) {
    this.observers.forEach((observer) => {
      observer(event);
    });
  }
}
