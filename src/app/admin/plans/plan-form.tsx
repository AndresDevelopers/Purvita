'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import type { Plan } from '@/lib/models/definitions';
import { PlanFormSchema } from '@/lib/models/definitions';
import { useToast } from '@/hooks/use-toast';
import { usePlanFeatures } from '@/hooks/use-plan-features';
import { getPlanValidationMessage } from '@/lib/utils/plan-validation-messages';
import { FeatureListInput } from '@/components/admin/feature-list-input';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface PlanFormProps {
  lang: Locale;
  plan?: Plan;
  onSuccess?: () => void;
}

export function PlanForm({ lang, plan, onSuccess }: PlanFormProps) {
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [isAffiliatePlan, setIsAffiliatePlan] = useState(plan?.is_affiliate_plan ?? false);
  const [isMlmPlan, setIsMlmPlan] = useState(plan?.is_mlm_plan ?? true);
  const [isDefault, setIsDefault] = useState(plan?.is_default ?? false);

  // Controlled form fields
  const [slug, setSlug] = useState(plan?.slug ?? '');
  const [price, setPrice] = useState(plan?.price?.toString() ?? '');
  const [displayOrder, setDisplayOrder] = useState(plan?.display_order?.toString() ?? '0');
  const [nameEn, setNameEn] = useState(plan?.name_en || plan?.name || '');
  const [nameEs, setNameEs] = useState(plan?.name_es || plan?.name || '');
  const [descriptionEn, setDescriptionEn] = useState(plan?.description_en || plan?.description || '');
  const [descriptionEs, setDescriptionEs] = useState(plan?.description_es || plan?.description || '');

  const featuresEn = usePlanFeatures(plan?.features_en ?? ['']);
  const featuresEs = usePlanFeatures(plan?.features_es ?? ['']);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const planFormData = {
        slug: slug.trim(),
        name_en: nameEn.trim(),
        name_es: nameEs.trim(),
        description_en: descriptionEn.trim(),
        description_es: descriptionEs.trim(),
        price: price.trim(),
        features_en: featuresEn.getSanitized(),
        features_es: featuresEs.getSanitized(),
        is_active: isActive,
        is_affiliate_plan: isAffiliatePlan,
        is_mlm_plan: isMlmPlan,
        is_default: isDefault,
        display_order: displayOrder.trim(),
      };

      const parseResult = PlanFormSchema.safeParse(planFormData);

      if (!parseResult.success) {
        const [firstIssue] = parseResult.error.issues;
        const issuePath = firstIssue?.path.join('.') ?? '';
        const issueMessage = getPlanValidationMessage(issuePath, dict);

        toast({
          title: dict.admin.planForm.toast.incompleteData,
          description: issueMessage,
          variant: 'destructive',
        });
        return;
      }

      const planData = parseResult.data;

      if (plan) {
        const response = await adminApi.put(`/api/admin/plans/${plan.id}`, planData);

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'No se pudo actualizar el plan.' }));
          const message = body?.error || body?.message || 'No se pudo actualizar el plan.';
          throw new Error(message);
        }

        toast({
          title: dict.admin.planForm.toast.planUpdated,
          description: dict.admin.planForm.toast.planUpdatedDescription,
        });
      } else {
        const response = await adminApi.post('/api/admin/plans', planData);

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'No se pudo crear el plan.' }));
          const message = body?.error || body?.message || 'No se pudo crear el plan.';
          throw new Error(message);
        }

        toast({
          title: dict.admin.planForm.toast.planCreated,
          description: dict.admin.planForm.toast.planCreatedDescription,
        });
      }

      onSuccess?.();

      // Navigate back to plans list
      router.push(`/admin/plans?lang=${lang}`);
    } catch (error) {
      console.error('Error saving plan:', error);
      toast({
        title: dict.admin.planForm.toast.error,
        description: error instanceof Error ? error.message : dict.admin.planForm.toast.errorSaving,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold">{dict.admin.planForm.basicInfo}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm font-medium">
              {dict.admin.planForm.slug} <span className="text-destructive">{dict.admin.planForm.slugRequired}</span>
            </Label>
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={dict.admin.planForm.slugPlaceholder}
              className="h-10"
              required
            />
            <p className="text-xs text-muted-foreground">
              {dict.admin.planForm.slugHelp}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price" className="text-sm font-medium">
              {dict.admin.planForm.price} <span className="text-destructive">{dict.admin.planForm.priceRequired}</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={dict.admin.planForm.pricePlaceholder}
                className="h-10 pl-7"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {dict.admin.planForm.priceHelp}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="display_order" className="text-sm font-medium">
            Orden de visualización
          </Label>
          <Input
            id="display_order"
            name="display_order"
            type="number"
            step="1"
            min="0"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            placeholder="0"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Número que determina el orden en que se muestran los planes (menor número = primero)
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold">{dict.admin.planForm.multilingualContent}</h3>
        <Tabs defaultValue="en" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="en" className="text-sm font-medium">🇺🇸 English</TabsTrigger>
            <TabsTrigger value="es" className="text-sm font-medium">🇪🇸 Español</TabsTrigger>
          </TabsList>

          <TabsContent value="en" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="name_en" className="text-sm font-medium">
                {dict.admin.planForm.planName} <span className="text-destructive">{dict.admin.planForm.planNameRequired}</span>
              </Label>
              <Input
                id="name_en"
                name="name_en"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Basic Plan"
                className="h-10"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_en" className="text-sm font-medium">
                {dict.admin.planForm.description} <span className="text-destructive">{dict.admin.planForm.descriptionRequired}</span>
              </Label>
              <Textarea
                id="description_en"
                name="description_en"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                placeholder="Description of the subscription plan"
                className="min-h-[100px] resize-none"
                required
              />
            </div>

            <FeatureListInput
              features={featuresEn.features}
              onChange={featuresEn.handleChange}
              onAdd={featuresEn.add}
              onRemove={featuresEn.remove}
              label={dict.admin.planForm.features}
              placeholder={(index) => `${dict.admin.planForm.featurePlaceholder} ${index + 1}`}
              addButtonText={dict.admin.planForm.addFeature}
            />
          </TabsContent>

          <TabsContent value="es" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="name_es" className="text-sm font-medium">
                {dict.admin.planForm.planName} <span className="text-destructive">{dict.admin.planForm.planNameRequired}</span>
              </Label>
              <Input
                id="name_es"
                name="name_es"
                value={nameEs}
                onChange={(e) => setNameEs(e.target.value)}
                placeholder="Plan Básico"
                className="h-10"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_es" className="text-sm font-medium">
                {dict.admin.planForm.description} <span className="text-destructive">{dict.admin.planForm.descriptionRequired}</span>
              </Label>
              <Textarea
                id="description_es"
                name="description_es"
                value={descriptionEs}
                onChange={(e) => setDescriptionEs(e.target.value)}
                placeholder="Descripción del plan de suscripción"
                className="min-h-[100px] resize-none"
                required
              />
            </div>

            <FeatureListInput
              features={featuresEs.features}
              onChange={featuresEs.handleChange}
              onAdd={featuresEs.add}
              onRemove={featuresEs.remove}
              label={dict.admin.planForm.features}
              placeholder={(index) => `${dict.admin.planForm.featurePlaceholder} ${index + 1}`}
              addButtonText={dict.admin.planForm.addFeature}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="is_active" className="text-base font-semibold">{dict.admin.planForm.planStatus}</Label>
            <p className="text-sm text-muted-foreground">
              {dict.admin.planForm.planStatusHelp}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:shrink-0">
            <input type="hidden" name="is_active" value={isActive ? 'true' : 'false'} />
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => {
                setIsActive(checked);
              }}
            />
            <span className={`text-sm font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
              {isActive ? dict.admin.planForm.active : dict.admin.planForm.inactive}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-6 border-t pt-6">
          <h3 className="text-lg font-semibold">Capacidades del Plan</h3>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="is_mlm_plan" className="text-base font-semibold">Red Multinivel</Label>
              <p className="text-sm text-muted-foreground">
                Habilita la construcción de equipo, árbol genealógico y comisiones de red.
              </p>
            </div>
            <div className="flex items-center gap-3 sm:shrink-0">
              <input type="hidden" name="is_mlm_plan" value={isMlmPlan ? 'true' : 'false'} />
              <Switch
                id="is_mlm_plan"
                checked={isMlmPlan}
                onCheckedChange={(checked) => {
                  setIsMlmPlan(checked);
                }}
              />
              <span className={`text-sm font-medium ${isMlmPlan ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                {isMlmPlan ? 'Activado' : 'Desactivado'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
            <div className="space-y-1">
              <Label htmlFor="is_affiliate_plan" className="text-base font-semibold">Sistema de Afiliados</Label>
              <p className="text-sm text-muted-foreground">
                Habilita enlaces de referido y comisiones por venta directa (sin estructura de red compleja).
              </p>
            </div>
            <div className="flex items-center gap-3 sm:shrink-0">
              <input type="hidden" name="is_affiliate_plan" value={isAffiliatePlan ? 'true' : 'false'} />
              <Switch
                id="is_affiliate_plan"
                checked={isAffiliatePlan}
                onCheckedChange={(checked) => {
                  setIsAffiliatePlan(checked);
                }}
              />
              <span className={`text-sm font-medium ${isAffiliatePlan ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                {isAffiliatePlan ? 'Activado' : 'Desactivado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t pt-6">
          <div className="space-y-1">
            <Label htmlFor="is_default" className="text-base font-semibold">Plan por defecto</Label>
            <p className="text-sm text-muted-foreground">
              Marcar este plan como la opción predeterminada para nuevos usuarios
            </p>
          </div>
          <div className="flex items-center gap-3 sm:shrink-0">
            <input type="hidden" name="is_default" value={isDefault ? 'true' : 'false'} />
            <Switch
              id="is_default"
              checked={isDefault}
              onCheckedChange={(checked) => {
                setIsDefault(checked);
              }}
            />
            <span className={`text-sm font-medium ${isDefault ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
              {isDefault ? 'Predeterminado' : 'No predeterminado'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
        <Button
          variant="outline"
          type="button"
          disabled={isSubmitting}
          onClick={() => router.push(`/admin/plans?lang=${lang}`)}
          className="h-11"
        >
          {dict.admin.planForm.cancel}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 min-w-[140px]"
        >
          {isSubmitting ? (
            <>
              <span className="mr-2">⏳</span>
              {dict.admin.planForm.saving}
            </>
          ) : (
            plan ? dict.admin.planForm.update : dict.admin.planForm.create
          )}
        </Button>
      </div>
    </form>
  );
}