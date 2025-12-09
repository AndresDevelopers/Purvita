export type TestScenarioId =
  | 'basic'
  | 'subscription'
  | 'highValue'
  | 'minimal'
  | 'custom';

export type TestScenarioOutcome = 'success' | 'failure';

export interface TestScenario {
  id: TestScenarioId;
  name: string;
  amount: string;
  description: string;
  expectedResult: TestScenarioOutcome;
}
