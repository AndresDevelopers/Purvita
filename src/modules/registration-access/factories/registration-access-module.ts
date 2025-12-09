import { RegistrationAccessEventBus } from '../events/registration-access-event-bus'
import { RegistrationAccessCodeRepository } from '../repositories/registration-access-code-repository'
import { RegistrationAccessService } from '../services/registration-access-service'

export const createRegistrationAccessModule = () => {
  const eventBus = new RegistrationAccessEventBus()
  const repository = new RegistrationAccessCodeRepository()
  const service = new RegistrationAccessService(repository, eventBus)

  return {
    eventBus,
    repository,
    service,
  }
}
