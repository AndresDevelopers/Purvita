'use client';

import { useState as _useState, useCallback as _useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast as _useToast } from '@/hooks/use-toast';
import { 
  CreditCard, 
  Loader2, 
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { PaymentTestInfo } from './payment-test-info';
import { TEST_SCENARIOS } from '../constants/payment-constants';
import type { TestScenarioId } from '../constants/payment-constants';
import { usePaymentTesting } from '../hooks/use-payment-testing';
import type { PaymentProvider } from '../domain/models/payment-gateway';

interface PaymentTestPanelProps {
  provider: PaymentProvider;
  isConfigured: boolean;
  onConfigurationCheck: () => Promise<boolean>;
}

export const PaymentTestPanel = ({ 
  provider, 
  isConfigured, 
  onConfigurationCheck 
}: PaymentTestPanelProps) => {
  const {
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
  } = usePaymentTesting({ provider, isConfigured, onConfigurationCheck });

  const currentScenario = TEST_SCENARIOS.find(s => s.id === selectedScenario);

  return (
    <Tabs defaultValue="testing" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="testing">Pruebas de Pago</TabsTrigger>
        <TabsTrigger value="info">Información de Testing</TabsTrigger>
      </TabsList>

      <TabsContent value="testing" className="space-y-6">
        {/* Estado de Configuración */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Configuración de {providerName}</CardTitle>
                <CardDescription>
                  Verifica y prueba tu integración de {providerName}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isConfigured ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Configurado
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    No Configurado
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConfigurationCheck}
                  disabled={isCheckingConfig}
                >
                  {isCheckingConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Verificar
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Formulario de Prueba */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Crear Pago de Prueba
            </CardTitle>
            <CardDescription>
              Selecciona un escenario o crea una prueba personalizada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-scenario">Escenario de Prueba</Label>
              <Select
                value={selectedScenario}
                onValueChange={(value) => setSelectedScenario(value as TestScenarioId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un escenario" />
                </SelectTrigger>
                <SelectContent>
                  {TEST_SCENARIOS.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name} {scenario.amount && `- $${scenario.amount}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedScenario === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-amount">Monto (USD)</Label>
                  <Input
                    id="custom-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="10.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-description">Descripción</Label>
                  <Input
                    id="custom-description"
                    placeholder="Descripción del pago"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            {currentScenario && selectedScenario !== 'custom' && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm">
                  <strong>Monto:</strong> ${currentScenario.amount} USD<br />
                  <strong>Descripción:</strong> {currentScenario.description}
                </div>
              </div>
            )}

            <Button
              onClick={() => handleTestPayment(currentScenario)}
              disabled={isLoading || !isConfigured}
              className="w-full"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLoading ? 'Creando Pago...' : `Probar Pago con ${providerName}`}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="info">
        <PaymentTestInfo provider={provider} />
      </TabsContent>
    </Tabs>
  );
};