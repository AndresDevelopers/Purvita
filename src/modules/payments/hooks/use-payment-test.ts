import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PaymentService } from '../services/payment-service';
import { PaymentError } from '../utils/payment-errors';
import { PAYMENT_TEST_CONSTANTS, PROVIDER_DISPLAY_NAMES } from '../constants/test-constants';
import type { PaymentProvider } from '../domain/models/payment-gateway';

export interface TestResult {
  id: string;
  scenario: string;
  provider: PaymentProvider;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  timestamp: Date;
  amount: string;
  error?: string;
  paymentUrl?: string;
}

interface PaymentTestParams {
  amount: number;
  currency: string;
  description: string;
  isTest: boolean;
}

export const usePaymentTest = (provider: PaymentProvider) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const popupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const createTestPayment = useCallback(async (
    params: PaymentTestParams,
    scenarioName: string
  ): Promise<TestResult> => {
    const testId = `test-${Date.now()}`;
    const newTest: TestResult = {
      id: testId,
      scenario: scenarioName,
      provider,
      status: 'pending',
      timestamp: new Date(),
      amount: params.amount.toString()
    };

    setTestResults(prev => [newTest, ...prev]);

    try {
      const response = await PaymentService.createPayment(provider, params);
      const paymentUrl = PaymentService.getPaymentUrl(provider, response);
      
      if (!paymentUrl) {
        throw new Error('No payment URL received from provider');
      }

      // Update test result with payment URL
      setTestResults(prev => prev.map(test => 
        test.id === testId 
          ? { ...test, paymentUrl }
          : test
      ));

      return { ...newTest, paymentUrl };
    } catch (error) {
      const paymentError = PaymentError.isPaymentError(error) 
        ? error 
        : PaymentError.fromApiError(error, provider);

      // Update test result with error
      setTestResults(prev => prev.map(test => 
        test.id === testId 
          ? { ...test, status: 'failed', error: paymentError.message }
          : test
      ));

      throw paymentError;
    }
  }, [provider]);

  const updateTestStatus = useCallback((testId: string, status: TestResult['status']) => {
    setTestResults(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, status }
        : test
    ));
  }, []);

  const executeTest = useCallback(async (
    params: PaymentTestParams,
    scenarioName: string
  ) => {
    setIsLoading(true);
    
    try {
      const testResult = await createTestPayment(params, scenarioName);
      
      // Open payment window
      const popup = window.open(
        testResult.paymentUrl!, 
        '_blank', 
        PAYMENT_TEST_CONSTANTS.POPUP_DIMENSIONS
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for payment testing.');
      }

      const providerName = PROVIDER_DISPLAY_NAMES[provider];
      toast({
        title: `${providerName} Test Payment Created`,
        description: `Test payment window opened. Complete the payment to verify integration.`,
      });

      // Clear any existing interval
      if (popupIntervalRef.current) {
        clearInterval(popupIntervalRef.current);
      }

      // Monitor popup for completion
      popupIntervalRef.current = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupIntervalRef.current!);
          popupIntervalRef.current = null;
          updateTestStatus(testResult.id, 'cancelled');
        }
      }, PAYMENT_TEST_CONSTANTS.POPUP_CHECK_INTERVAL);

    } catch (error) {
      const paymentError = error as PaymentError;
      toast({
        variant: 'destructive',
        title: 'Payment Test Failed',
        description: paymentError.message || 'Unable to create test payment.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [createTestPayment, updateTestStatus, provider, toast]);

  return {
    testResults,
    isLoading,
    executeTest,
    updateTestStatus
  };
};