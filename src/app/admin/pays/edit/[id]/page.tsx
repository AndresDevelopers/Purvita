import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';

const getPlanById = (id: string, dict: any) => {
  const plans = {
    basic: {
      id: 'basic',
      title: dict.subscriptions.basic.title,
      price: '9.99',
      description: dict.subscriptions.basic.description,
      features:
        dict.subscriptions.basic.feature1 +
        '\n' +
        dict.subscriptions.basic.feature2 +
        '\n' +
        dict.subscriptions.basic.feature3,
    },
    pro: {
      id: 'pro',
      title: dict.subscriptions.pro.title,
      price: '29.99',
      description: dict.subscriptions.pro.description,
      features:
        dict.subscriptions.pro.feature1 +
        '\n' +
        dict.subscriptions.pro.feature2 +
        '\n' +
        dict.subscriptions.pro.feature3 +
        '\n' +
        dict.subscriptions.pro.feature4,
    },
    diamond: {
      id: 'diamond',
      title: dict.subscriptions.diamond.title,
      price: '99.99',
      description: dict.subscriptions.diamond.description,
      features:
        dict.subscriptions.diamond.feature1 +
        '\n' +
        dict.subscriptions.diamond.feature2 +
        '\n' +
        dict.subscriptions.diamond.feature3 +
        '\n' +
        dict.subscriptions.diamond.feature4,
    },
  };
  return plans[id as keyof typeof plans] || plans.pro;
};

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default async function EditPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: Locale }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const lang = search.lang || 'en';
  const dict = await getLocalizedDictionary(lang);
  const plan = getPlanById(id, dict);

  return (
    <div>
      <Button variant="ghost" asChild className="mb-4">
        <Link href={`/admin/pays?lang=${lang}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {dict.admin.backToPays ?? 'Back to Pays'}
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{dict.admin.editPlan}</CardTitle>
          <CardDescription>{dict.admin.editPlanDesc} &quot;{plan.title}&quot;</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">{dict.admin.planTitle}</Label>
                <Input id="title" defaultValue={plan.title} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{dict.admin.planPrice}</Label>
                <Input id="price" type="number" step="0.01" defaultValue={plan.price} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{dict.admin.planDescription}</Label>
              <Input id="description" defaultValue={plan.description} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="features">{dict.admin.planFeatures}</Label>
              <Textarea id="features" defaultValue={plan.features} rows={5} placeholder={dict.admin.planFeaturesPlaceholder} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button">{dict.admin.cancel}</Button>
              <Button type="submit">{dict.admin.saveChanges}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
