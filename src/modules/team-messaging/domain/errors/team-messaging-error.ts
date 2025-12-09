export type TeamMessagingErrorCode =
  | 'recipient_not_in_team'
  | 'parent_message_not_found'
  | 'not_participant'
  | 'self_message_not_allowed'
  | 'message_not_found'
  | 'not_message_owner';

export class TeamMessagingError extends Error {
  constructor(
    public readonly code: TeamMessagingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TeamMessagingError';
  }
}
