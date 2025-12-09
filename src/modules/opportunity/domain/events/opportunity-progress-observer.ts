export interface OpportunityProgressObserver {
  onPhaseUnlocked(memberId: string, phaseId: string): void;
}

export class OpportunityProgressNotifier {
  private readonly observers = new Set<OpportunityProgressObserver>();

  subscribe(observer: OpportunityProgressObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  notifyPhaseUnlocked(memberId: string, phaseId: string) {
    for (const observer of this.observers) {
      observer.onPhaseUnlocked(memberId, phaseId);
    }
  }
}
