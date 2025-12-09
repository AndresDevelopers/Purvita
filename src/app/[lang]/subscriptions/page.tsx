import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { getPlans } from '@/lib/services/plan-service';
import type { Plan } from '@/lib/models/definitions';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';

export default async function SubscriptionsPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const dict = await getLocalizedDictionary(lang);
  const plansData = await getPlans();

  const plans = plansData.map((plan: Plan, index: number) => {
    // Use the appropriate language based on the current locale
    const isEnglish = lang === 'en';
    const title = isEnglish ? (plan.name_en || plan.name || '') : (plan.name_es || plan.name || '');
    const description = isEnglish ? (plan.description_en || plan.description || '') : (plan.description_es || plan.description || '');
    const features = isEnglish ? (plan.features_en || plan.features || []) : (plan.features_es || plan.features || []);

    return {
      id: plan.slug,
      title,
      price: `$${plan.price.toFixed(2)}`,
      priceSuffix: dict.subscriptions.priceSuffix,
      description,
      features,
      isPopular: index === 1, // Highlight the second plan
    };
  });

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-headline">{dict.subscriptions.title}</h1>
        <p className="text-lg text-muted-foreground mt-2">{dict.subscriptions.subtitle}</p>
      </div>

      <div className={`grid gap-8 mx-auto ${
        plans.length === 1
          ? 'grid-cols-1 max-w-md place-items-center'
          : plans.length === 2
          ? 'grid-cols-1 md:grid-cols-2 max-w-4xl place-items-center'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl'
      }`}>
        {plans.map((plan) => (
          <Card key={plan.title} className={`flex flex-col ${plan.isPopular ? 'border-primary ring-2 ring-primary shadow-lg' : ''}`}>
            {plan.isPopular && (
              <div className="bg-primary text-primary-foreground text-center py-1.5 text-sm font-semibold rounded-t-lg">
                {dict.subscriptions.mostPopular}
              </div>
            )}
            <CardHeader className="items-center text-center">
              <CardTitle className="text-2xl font-headline">{plan.title}</CardTitle>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.priceSuffix}</span>
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant={plan.isPopular ? 'default' : 'outline'}>
                <Link href={`/${lang}/checkout?plan=${plan.id}`}>
                  {dict.subscriptions.selectPlan}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
