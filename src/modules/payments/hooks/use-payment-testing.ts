import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PAYMENT_CONSTANTS } from '../constants/payment-constants';
import type { PaymentProvider } from '../domain/models/payment-gateway';
import type { TestScenarioId } from '../constants/payment-constants';

interface UsePaymentTestingProps {
  provider: PaymentProvider;
  isConfigured: boolean;
  onConfigurationCheck: () => Promise<boolean>;
}

export const usePaymentTesting = ({
  provider,
  isConfigured,
  onConfigurationCheck,
}: UsePaymentTestingProps) => {
  const [selectedScenario, setSelectedScenario] = useState<TestScenarioId>('basic');
  const [customAmount, setCustomAmount] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(false);
  const { toast } = useToast();

  const providerName = provider === 'paypal' ? 'PayPal' : 'Stripe';

  const handleConfigurationCheck = useCallback(async () => {
    setIsCheckingConfig(true);
    try {
      const isValid = await onConfigurationCheck();
      toast({
        title: isValid ? 'Configuración Válida' : 'Configuración Inválida',
        description: isValid 
          ? `${providerName} está configurado correctamente.`
          : `${providerName} no está configurado correctamente.`,
        variant: isValid ? 'default' : 'destructive'
      });
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error de Verificación',
        description: 'No se pudo verificar la configuración.'
      });
    } finally {
      setIsCheckingConfig(false);
    }
  }, [onConfigurationCheck, providerName, toast]);

  const validatePaymentData = useCallback((amount: string): boolean => {
    if (!isConfigured) {
      toast({
        variant: 'destructive',
        title: 'Configuración Requerida',
        description: `Configura ${providerName} antes de hacer pruebas.`
      });
      return false;
    }

    if (!amount || parseFloat(amount) < PAYMENT_CONSTANTS.AMOUNTS.MIN_AMOUNT) {
      toast({
        variant: 'destructive',
        title: 'Monto Inválido',
        description: `Ingresa un monto válido mayor a $${PAYMENT_CONSTANTS.AMOUNTS.MIN_AMOUNT}`
      });
      return false;
    }

    return true;
  }, [isConfigured, providerName, toast]);

  const handleTestPayment = useCallback(async (
    currentScenario: { amount: string; description: string } | undefined
  ) => {
    const amount = selectedScenario === 'custom' ? customAmount : currentScenario?.amount || '10.00';
    const description = selectedScenario === 'custom' 
      ? customDescription || `Prueba personalizada - ${providerName}`
      : currentScenario?.description || `Prueba de pago - ${providerName}`;

    if (!validatePaymentData(amount)) {
      return;
    }

    setIsLoading(true);

    try {
      // Get current URL as origin for return after payment
      const originUrl = typeof window !== 'undefined' ? window.location.href : undefined;

      const response = await fetch(`/api/admin/payments/test/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
          description: description,
          scenario: selectedScenario,
          originUrl, // Pass the current URL for return after payment
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear el pago de prueba');
      }

      const result = await response.json();

      if (result.paymentUrl) {
        window.open(result.paymentUrl, '_blank', 'width=600,height=700');
        toast({
          title: 'Pago de Prueba Creado',
          description: 'Se abrió la ventana de pago. Completa el proceso para probar la integración.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error en Prueba de Pago',
        description: error instanceof Error ? error.message : 'No se pudo crear el pago de prueba',
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedScenario,
    customAmount,
    customDescription,
    provider,
    providerName,
    validatePaymentData,
    toast
  ]);

  return {
    selectedScenario,
    setSelectedScenario,
    customAmount,
    setCustomAmount,
    customDescription,
    setCustomDescription,
    isLoading,
    isCheckingConfig,
    providerName,
    handleConfigurationCheck,
    handleTestPayment,
  };
};