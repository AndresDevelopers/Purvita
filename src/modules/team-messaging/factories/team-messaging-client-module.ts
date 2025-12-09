import { TeamMessagingEventBus } from '../domain/events/team-messaging-event-bus';
import { TeamMessagingClientService } from '../services/team-messaging-client-service';

export interface TeamMessagingClientModule {
  service: TeamMessagingClientService;
  eventBus: TeamMessagingEventBus;
}

class TeamMessagingClientModuleFactoryImpl {
  private eventBus: TeamMessagingEventBus | null = null;
  private service: TeamMessagingClientService | null = null;

  create(): TeamMessagingClientModule {
    if (!this.eventBus) {
      this.eventBus = new TeamMessagingEventBus();
    }

    if (!this.service) {
      this.service = new TeamMessagingClientService(this.eventBus);
    }

    return {
      service: this.service,
      eventBus: this.eventBus,
    };
  }
}

export const TeamMessagingClientModuleFactory = new TeamMessagingClientModuleFactoryImpl();
