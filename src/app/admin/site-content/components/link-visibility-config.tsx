'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, Eye, Info } from 'lucide-react';
import type { LinkVisibilityRules } from '@/modules/site-content/domain/models/landing-content';
import { defaultVisibilityRules } from '@/modules/site-content/domain/models/landing-content';

interface LinkVisibilityConfigProps {
  visibility: LinkVisibilityRules | undefined;
  onChange: (visibility: LinkVisibilityRules) => void;
  disabled?: boolean;
  copy?: {
    title?: string;
    description?: string;
    showToGuests?: string;
    showToGuestsDescription?: string;
    showToAuthenticated?: string;
    showToAuthenticatedDescription?: string;
    showToActiveSubscription?: string;
    showToActiveSubscriptionDescription?: string;
    showToInactiveSubscription?: string;
    showToInactiveSubscriptionDescription?: string;
    showToMlm?: string;
    showToMlmDescription?: string;
    showToAffiliate?: string;
    showToAffiliateDescription?: string;
    showToAdmin?: string;
    showToAdminDescription?: string;
  };
}

const defaultCopy = {
  title: 'Configuración de visibilidad',
  description: 'Controla quién puede ver este enlace',
  showToGuests: 'Visitantes (no autenticados)',
  showToGuestsDescription: 'Mostrar a usuarios que no han iniciado sesión',
  showToAuthenticated: 'Usuarios autenticados',
  showToAuthenticatedDescription: 'Mostrar a usuarios que han iniciado sesión',
  showToActiveSubscription: 'Suscripción activa',
  showToActiveSubscriptionDescription: 'Mostrar a usuarios con suscripción activa',
  showToInactiveSubscription: 'Sin suscripción activa',
  showToInactiveSubscriptionDescription: 'Mostrar a usuarios sin suscripción o con suscripción inactiva',
  showToMlm: 'Suscripción MLM',
  showToMlmDescription: 'Mostrar a usuarios con suscripción tipo MLM (multinivel)',
  showToAffiliate: 'Suscripción Afiliado',
  showToAffiliateDescription: 'Mostrar a usuarios con suscripción tipo Afiliado',
  showToAdmin: 'Administradores',
  showToAdminDescription: 'Mostrar a usuarios con rol de administrador',
};

export function LinkVisibilityConfig({
  visibility,
  onChange,
  disabled = false,
  copy = defaultCopy,
}: LinkVisibilityConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentVisibility = visibility ?? defaultVisibilityRules;
  const labels = { ...defaultCopy, ...copy };

  const handleChange = (field: keyof LinkVisibilityRules, value: boolean) => {
    onChange({
      ...currentVisibility,
      [field]: value,
    });
  };

  // Check if any visibility rule is different from default (all true)
  const hasCustomVisibility = Object.values(currentVisibility).some((v) => v === false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between p-2 h-auto"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{labels.title}</span>
            {hasCustomVisibility && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                Personalizado
              </span>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{labels.description}</p>
          
          {/* Authentication Section */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Autenticación
            </p>
            <VisibilityToggle
              label={labels.showToGuests}
              description={labels.showToGuestsDescription}
              checked={currentVisibility.showToGuests}
              onChange={(checked) => handleChange('showToGuests', checked)}
              disabled={disabled}
            />
            <VisibilityToggle
              label={labels.showToAuthenticated}
              description={labels.showToAuthenticatedDescription}
              checked={currentVisibility.showToAuthenticated}
              onChange={(checked) => handleChange('showToAuthenticated', checked)}
              disabled={disabled}
            />
          </div>

          {/* Subscription Status Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Estado de suscripción
            </p>
            <VisibilityToggle
              label={labels.showToActiveSubscription}
              description={labels.showToActiveSubscriptionDescription}
              checked={currentVisibility.showToActiveSubscription}
              onChange={(checked) => handleChange('showToActiveSubscription', checked)}
              disabled={disabled || !currentVisibility.showToAuthenticated}
            />
            <VisibilityToggle
              label={labels.showToInactiveSubscription}
              description={labels.showToInactiveSubscriptionDescription}
              checked={currentVisibility.showToInactiveSubscription}
              onChange={(checked) => handleChange('showToInactiveSubscription', checked)}
              disabled={disabled || !currentVisibility.showToAuthenticated}
            />
          </div>

          {/* Subscription Type Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tipo de suscripción
            </p>
            <VisibilityToggle
              label={labels.showToMlm}
              description={labels.showToMlmDescription}
              checked={currentVisibility.showToMlm}
              onChange={(checked) => handleChange('showToMlm', checked)}
              disabled={disabled || !currentVisibility.showToAuthenticated}
            />
            <VisibilityToggle
              label={labels.showToAffiliate}
              description={labels.showToAffiliateDescription}
              checked={currentVisibility.showToAffiliate}
              onChange={(checked) => handleChange('showToAffiliate', checked)}
              disabled={disabled || !currentVisibility.showToAuthenticated}
            />
          </div>

          {/* Admin Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Roles especiales
            </p>
            <VisibilityToggle
              label={labels.showToAdmin}
              description={labels.showToAdminDescription}
              checked={currentVisibility.showToAdmin}
              onChange={(checked) => handleChange('showToAdmin', checked)}
              disabled={disabled || !currentVisibility.showToAuthenticated}
            />
          </div>

          {/* Reset Button */}
          {hasCustomVisibility && (
            <div className="pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onChange(defaultVisibilityRules)}
                disabled={disabled}
              >
                Restablecer a valores por defecto
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface VisibilityToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function VisibilityToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: VisibilityToggleProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-normal cursor-pointer" htmlFor={label}>
          {label}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Switch
        id={label}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

export default LinkVisibilityConfig;
