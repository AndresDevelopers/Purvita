'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  isActive: boolean;
  isDefault?: boolean;
}

interface PlanSelectorProps {
  userId: string;
  locale?: string;
  onPlanSelected?: (plan: Plan) => void;
}

export function PlanSelector({ userId, locale = 'en', onPlanSelected }: PlanSelectorProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const { toast } = useToast();

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription/checkout');
      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }
      const data = await response.json();
      setPlans(data);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los planes disponibles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handlePlanSelection = (plan: Plan) => {
    setSelectedPlan(plan);
    onPlanSelected?.(plan);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un plan primero.',
        variant: 'destructive',
      });
      return;
    }

    setProcessingPayment(true);
    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          planId: selectedPlan.id,
          locale,
          originUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: 'Error',
        description: 'No se pudo iniciar el proceso de pago.',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando planes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Selecciona tu Plan</h2>
        <p className="text-muted-foreground">
          Elige el plan que mejor se adapte a tus necesidades
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-all ${
              plan.isDefault
                ? 'ring-2 ring-yellow-500 border-yellow-500 shadow-lg'
                : selectedPlan?.id === plan.id
                ? 'ring-2 ring-primary border-primary'
                : 'hover:shadow-lg'
            }`}
            onClick={() => handlePlanSelection(plan)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  {plan.name}
                  {plan.isDefault && (
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  )}
                </CardTitle>
                {plan.isDefault ? (
                  <Badge className="bg-yellow-500 hover:bg-yellow-600">Recomendado</Badge>
                ) : plan.isActive ? (
                  <Badge variant="secondary">Activo</Badge>
                ) : null}
              </div>
              <CardDescription>{plan.description}</CardDescription>
              <div className="text-3xl font-bold text-primary">
                ${plan.price.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/mes</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.slice(0, 4).map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
                {plan.features.length > 4 && (
                  <li className="text-sm text-muted-foreground">
                    +{plan.features.length - 4} características más...
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPlan && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleSubscribe}
            disabled={processingPayment}
            className="px-8"
          >
            {processingPayment ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              `Suscribirse a ${selectedPlan.name} - $${selectedPlan.price.toFixed(2)}/mes`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
