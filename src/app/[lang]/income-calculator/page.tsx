import IncomeCalculator from '@/app/components/income-calculator';
import type { Locale } from '@/i18n/config';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';

export default async function IncomeCalculatorPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const dict = await getLocalizedDictionary(lang);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {dict.incomeCalculator.title}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {dict.incomeCalculator.subtitle}
          </p>
        </div>
        <IncomeCalculator dict={dict} lang={lang} />
      </div>
    </div>
  );
}