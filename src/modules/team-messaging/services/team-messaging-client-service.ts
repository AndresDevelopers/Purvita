import {
  TeamMessageMarkReadSchema,
  TeamMessageSchema,
  TeamMessageSendRequestSchema,
  TeamMessageThreadListSchema,
  type TeamMessage,
  type TeamMessageThread,
} from '../domain/models/team-message';
import { TeamMessagingEventBus } from '../domain/events/team-messaging-event-bus';

const handleErrorResponse = async (response: Response) => {
  try {
    const payload = await response.json();
    const message = typeof payload?.message === 'string' ? payload.message : response.statusText;
    return new Error(message || 'Request failed');
  } catch {
    return new Error(response.statusText || 'Request failed');
  }
};

export class TeamMessagingClientService {
  private threads: TeamMessageThread[] = [];
  private loadingPromise: Promise<TeamMessageThread[]> | null = null;
  private abortController: AbortController | null = null;

  constructor(private readonly eventBus: TeamMessagingEventBus) {}

  getSnapshot() {
    return this.threads;
  }

  async loadThreads(): Promise<TeamMessageThread[]> {
    // Si ya hay una carga en proceso, retornar esa promesa
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Cancelar petición anterior si existe
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    
    this.loadingPromise = this._loadThreadsInternal(this.abortController.signal)
      .finally(() => {
        this.loadingPromise = null;
        this.abortController = null;
      });

    return this.loadingPromise;
  }

  private async _loadThreadsInternal(signal: AbortSignal): Promise<TeamMessageThread[]> {
    this.eventBus.emit({ type: 'threads_loading' });

    try {
      const response = await fetch('/api/team-messages', { 
        cache: 'no-store',
        signal 
      });

      if (!response.ok) {
        throw await handleErrorResponse(response);
      }

      const payload = TeamMessageThreadListSchema.parse(await response.json());
      this.threads = payload;
      this.eventBus.emit({ type: 'threads_loaded', threads: payload });
      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return this.threads; // Retornar estado actual si se cancela
      }
      
      const normalized = error instanceof Error ? error : new Error('Failed to load messages');
      this.eventBus.emit({ type: 'threads_error', error: normalized });
      throw normalized;
    }
  }

  async sendMessage(input: { recipientId: string; body: string; parentMessageId?: string | null }): Promise<TeamMessage> {
    const payload = TeamMessageSendRequestSchema.parse(input);
    this.eventBus.emit({ type: 'message_sending', recipientId: payload.recipientId });

    try {
      const response = await fetch('/api/team-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await handleErrorResponse(response);
      }

      const message = TeamMessageSchema.parse(await response.json());
      this.eventBus.emit({ type: 'message_sent', message });
      await this.loadThreads();
      return message;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Failed to send message');
      this.eventBus.emit({ type: 'message_send_failed', error: normalized });
      throw normalized;
    }
  }

  async markMessagesAsRead(messageIds: string[]) {
    const payload = TeamMessageMarkReadSchema.parse({ messageIds });

    try {
      const response = await fetch('/api/team-messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await handleErrorResponse(response);
      }

      this.eventBus.emit({ type: 'messages_marked_read', messageIds: payload.messageIds });
      await this.loadThreads();
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Failed to mark messages as read');
      this.eventBus.emit({ type: 'mark_read_failed', error: normalized });
      throw normalized;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    this.eventBus.emit({ type: 'message_deleting', messageId });

    try {
      // ✅ SECURITY: Fetch CSRF token before DELETE request
      const csrfResponse = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });

      if (!csrfResponse.ok) {
        throw new Error('Failed to obtain CSRF token. Please refresh the page and try again.');
      }

      const { token: csrfToken } = await csrfResponse.json();

      const response = await fetch(`/api/team-messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw await handleErrorResponse(response);
      }

      this.eventBus.emit({ type: 'message_deleted', messageId });
      await this.loadThreads();
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Failed to delete message');
      this.eventBus.emit({ type: 'message_delete_failed', error: normalized });
      throw normalized;
    }
  }
}
