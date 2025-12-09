import { useState, useMemo, useCallback } from 'react';
import type { TestScenario } from '../types/test-types';

const DEFAULT_SCENARIOS: TestScenario[] = [
  {
    id: 'basic',
    name: 'Basic Payment',
    amount: '10.00',
    description: 'Basic test payment',
    expectedResult: 'success'
  },
  {
    id: 'subscription',
    name: 'Subscription Test',
    amount: '29.99',
    description: 'Monthly subscription test',
    expectedResult: 'success'
  },
  {
    id: 'highValue',
    name: 'High Value Payment',
    amount: '999.99',
    description: 'High value transaction test',
    expectedResult: 'success'
  },
  {
    id: 'minimal',
    name: 'Minimal Amount',
    amount: '0.50',
    description: 'Minimum payment amount test',
    expectedResult: 'success'
  }
];

export const useTestScenarios = () => {
  const [selectedScenario, setSelectedScenario] = useState<string>('basic');
  const [customAmount, setCustomAmount] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  const scenarios = useMemo(() => DEFAULT_SCENARIOS, []);

  const currentScenario = useMemo(() => 
    scenarios.find(s => s.id === selectedScenario),
    [scenarios, selectedScenario]
  );

  const getTestParams = useCallback((providerName: string) => {
    if (selectedScenario === 'custom') {
      return {
        amount: customAmount,
        description: customDescription || `Custom test payment - ${providerName}`,
        scenarioName: 'Custom Test'
      };
    }

    return {
      amount: currentScenario?.amount || '10.00',
      description: currentScenario?.description || `Test payment - ${providerName}`,
      scenarioName: currentScenario?.name || 'Test'
    };
  }, [selectedScenario, customAmount, customDescription, currentScenario]);

  const resetCustomFields = useCallback(() => {
    setCustomAmount('');
    setCustomDescription('');
  }, []);

  return {
    scenarios,
    selectedScenario,
    setSelectedScenario,
    customAmount,
    setCustomAmount,
    customDescription,
    setCustomDescription,
    currentScenario,
    getTestParams,
    resetCustomFields
  };
};