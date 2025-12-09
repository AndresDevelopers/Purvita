import type { RegistrationAccessObserver, RegistrationAccessValidationResult } from '../types'

export class RegistrationAccessEventBus {
  private readonly observers = new Set<RegistrationAccessObserver>()

  subscribe(observer: RegistrationAccessObserver): () => void {
    this.observers.add(observer)
    return () => {
      this.observers.delete(observer)
    }
  }

  notify(result: RegistrationAccessValidationResult): void {
    for (const observer of this.observers) {
      try {
        observer(result)
      } catch (error) {
        console.warn('[registration-access] Observer threw during notification', error)
      }
    }
  }
}
