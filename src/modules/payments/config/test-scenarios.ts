export interface TestScenario {
  id: string;
  name: string;
  amount: string;
  description: string;
  expectedResult: string;
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'basic',
    name: 'Basic Payment',
    amount: '10.00',
    description: 'Basic test payment',
    expectedResult: 'Payment should complete successfully'
  },
  {
    id: 'subscription',
    name: 'Subscription Test',
    amount: '29.99',
    description: 'Monthly subscription test',
    expectedResult: 'Recurring payment setup should succeed'
  },
  {
    id: 'highValue',
    name: 'High Value Payment',
    amount: '500.00',
    description: 'High value transaction test',
    expectedResult: 'Large payment should process with additional verification'
  },
  {
    id: 'minimal',
    name: 'Minimal Amount',
    amount: '0.50',
    description: 'Minimum payment amount test',
    expectedResult: 'Small payment should complete without issues'
  }
];