'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsUpdateInput,
} from '@/modules/app-settings/domain/models/app-settings';
import type { PhaseLevel } from '@/modules/phase-levels/domain/models/phase-level';
import type { Locale } from '@/i18n/config';
import { CurrencyCountrySelector } from './components/currency-country-selector';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface AppSettingsFormProps {
  copy: Record<string, any>;
  locale: Locale;
}

interface EditableCapacity {
  level: number;
  maxMembers: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatPercentage = (value: number) => (value * 100).toFixed(2);

const centsToCurrency = (value: number) => (value / 100).toFixed(2);

const currencyToCents = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

const parsePercentageInput = (value: string) => {
  const normalized = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(normalized)) {
    return null;
  }
  return clamp(normalized / 100, 0, 1);
};

const normalizeSettings = (settings: AppSettings | null): AppSettings => {
  if (!settings) {
    return DEFAULT_APP_SETTINGS;
  }

  return {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    maxMembersPerLevel:
      settings.maxMembersPerLevel.length > 0
        ? settings.maxMembersPerLevel
        : DEFAULT_APP_SETTINGS.maxMembersPerLevel,
    currencies:
      settings.currencies.length > 0 ? settings.currencies : DEFAULT_APP_SETTINGS.currencies,
  };
};

interface EditablePhaseLevel {
  id: string;
  level: number;
  name: string;
  nameEn: string;
  nameEs: string;
  commissionRate: string;
  subscriptionDiscountRate: string;
  creditCents: string;
  freeProductValueCents: string;
  displayOrder: number;
}

interface EditableCurrencyVisibility {
  code: string;
  countries: string[];
  useAllCountries: boolean;
}

export function AppSettingsForm({ copy, locale }: AppSettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => DEFAULT_APP_SETTINGS);
  const [phaseLevels, setPhaseLevels] = useState<EditablePhaseLevel[]>([]);
  const [capacities, setCapacities] = useState<EditableCapacity[]>(() =>
    DEFAULT_APP_SETTINGS.maxMembersPerLevel.map((entry) => ({
      level: entry.level,
      maxMembers: entry.maxMembers.toString(),
    })),
  );

  const [payoutFrequency, setPayoutFrequency] = useState<AppSettings['payoutFrequency']>(
    DEFAULT_APP_SETTINGS.payoutFrequency,
  );
  const [currency, setCurrency] = useState(DEFAULT_APP_SETTINGS.currency);
  const [currencies, setCurrencies] = useState<EditableCurrencyVisibility[]>(() =>
    DEFAULT_APP_SETTINGS.currencies.map((entry) => ({
      code: entry.code,
      countries: entry.countryCodes.map((country) => country.toUpperCase()),
      useAllCountries: entry.countryCodes.length === 0,
    })),
  );
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(DEFAULT_APP_SETTINGS.autoAdvanceEnabled);
  const [teamLevelsVisible, setTeamLevelsVisible] = useState(
    DEFAULT_APP_SETTINGS.teamLevelsVisible.toString(),
  );

  const normalizedLocale = locale ?? 'en';

  const currencyAvailability = useMemo(() => {
    return currencies.map((entry, index) => {
      const unavailable = new Set<string>();
      let globalTakenElsewhere = false;

      currencies.forEach((other, otherIndex) => {
        if (otherIndex === index) {
          return;
        }

        if (other.useAllCountries) {
          globalTakenElsewhere = true;
        }

        if (!other.useAllCountries) {
          other.countries.forEach((country) => unavailable.add(country.toUpperCase()));
        }
      });

      return {
        unavailable,
        globalTakenElsewhere,
      };
    });
  }, [currencies]);

  const currencyCopy = copy.compensation ?? {};
  const countrySelectorCopy = useMemo(
    () => ({
      emptySummary: currencyCopy.countriesEmpty,
      allSummary: currencyCopy.countriesAll,
      summaryTemplate: currencyCopy.countriesSummary,
      dialogTitle: currencyCopy.countriesDialogTitle,
      dialogDescription: currencyCopy.countriesDialogDescription ?? currencyCopy.countriesHint,
      searchPlaceholder: currencyCopy.countriesSearchPlaceholder,
      allLabel: currencyCopy.countriesAllLabel ?? currencyCopy.countriesAll,
      allDescription: currencyCopy.countriesAllDescription,
      unavailableLabel: currencyCopy.countriesUnavailable,
      doneLabel: currencyCopy.countriesDone,
    }),
    [currencyCopy.countriesAll,
    currencyCopy.countriesAllDescription,
    currencyCopy.countriesAllLabel,
    currencyCopy.countriesDialogDescription,
    currencyCopy.countriesDialogTitle,
    currencyCopy.countriesDone,
    currencyCopy.countriesEmpty,
    currencyCopy.countriesHint,
    currencyCopy.countriesSearchPlaceholder,
    currencyCopy.countriesSummary,
    currencyCopy.countriesUnavailable],
  );

  const frequencyOptions = useMemo(
    () => [
      { value: 'weekly', label: copy.frequency?.weekly ?? 'Weekly' },
      { value: 'biweekly', label: copy.frequency?.biweekly ?? 'Biweekly' },
      { value: 'monthly', label: copy.frequency?.monthly ?? 'Monthly' },
    ],
    [copy.frequency?.biweekly, copy.frequency?.monthly, copy.frequency?.weekly],
  );

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        // Using adminApi.get() for consistency (GET requests don't need CSRF token)
        const [settingsRes, phaseLevelsRes] = await Promise.all([
          adminApi.get('/api/admin/app-settings', { cache: 'no-store' }),
          adminApi.get('/api/admin/phase-levels', { cache: 'no-store' }),
        ]);

        if (!settingsRes.ok || !phaseLevelsRes.ok) {
          throw new Error(copy.errors?.loadFailed ?? 'Unable to load the configuration.');
        }

        const settingsData = (await settingsRes.json()) as { settings: AppSettings };
        const phaseLevelsData = (await phaseLevelsRes.json()) as { phaseLevels: PhaseLevel[] };

        const normalized = normalizeSettings(settingsData.settings);
        setSettings(normalized);

        setPhaseLevels(
          phaseLevelsData.phaseLevels.map((phase) => ({
            id: phase.id,
            level: phase.level,
            name: phase.name,
            nameEn: phase.nameEn || phase.name,
            nameEs: phase.nameEs || phase.name,
            commissionRate: formatPercentage(phase.commissionRate),
            subscriptionDiscountRate: formatPercentage(phase.subscriptionDiscountRate ?? 0),
            creditCents: centsToCurrency(phase.creditCents),
            freeProductValueCents: centsToCurrency(phase.freeProductValueCents ?? (phase.level === 1 ? 6500 : 0)),
            displayOrder: phase.displayOrder,
          })),
        );

        setCapacities(
          normalized.maxMembersPerLevel.map((entry) => ({
            level: entry.level,
            maxMembers: entry.maxMembers.toString(),
          })),
        );
        setPayoutFrequency(normalized.payoutFrequency);
        setCurrency(normalized.currency);
        setCurrencies(
          normalized.currencies.map((entry) => ({
            code: entry.code,
            countries: entry.countryCodes.map((country) => country.toUpperCase()),
            useAllCountries: entry.countryCodes.length === 0,
          })),
        );
        setAutoAdvanceEnabled(normalized.autoAdvanceEnabled);
        setTeamLevelsVisible(normalized.teamLevelsVisible.toString());
      } catch (error) {
        console.error('[AdminAppSettings] Failed to load settings', error);
        toast({
          title: copy.errors?.title ?? 'We detected an issue',
          description: copy.errors?.loadFailed ?? 'Unable to load the configuration.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [copy.errors?.loadFailed, copy.errors?.title, toast]);

  useEffect(() => {
    setCurrencies((prev) => {
      const normalizedCode = currency.toUpperCase();
      if (prev.length === 0) {
        return [{ code: normalizedCode, countries: [], useAllCountries: true }];
      }

      const existingIndex = prev.findIndex((entry) => entry.code.toUpperCase() === normalizedCode);
      if (existingIndex === -1) {
        return [{ code: normalizedCode, countries: [], useAllCountries: true }, ...prev];
      }

      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], code: normalizedCode };
      return next;
    });
  }, [currency]);

  // Synchronize capacities with phaseLevels
  useEffect(() => {
    const currentLevels = phaseLevels.map((phase) => phase.level).sort((a, b) => a - b);

    setCapacities((prev) => {
      const capacityMap = new Map(prev.map((entry) => [entry.level, entry.maxMembers]));
      return currentLevels.map((level) => ({
        level,
        maxMembers: capacityMap.get(level) ?? '0',
      }));
    });
  }, [phaseLevels]);

  const handleCapacityChange = (index: number, value: string) => {
    setCapacities((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], maxMembers: value };
      return next;
    });
  };

  const handleCurrencyCodeChange = (index: number, value: string) => {
    setCurrencies((prev) => {
      const next = [...prev];
      const target = { ...next[index] };
      target.code = value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
      next[index] = target;
      return next;
    });
  };

  const handleCurrencyVisibilityChange = (
    index: number,
    payload: { countries: string[]; useAllCountries: boolean },
  ) => {
    setCurrencies((prev) => {
      const next = [...prev];
      const sanitizedCountries = payload.countries
        .map((country) => country.trim().toUpperCase())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      next[index] = {
        ...next[index],
        countries: payload.useAllCountries ? [] : sanitizedCountries,
        useAllCountries: payload.useAllCountries,
      };
      return next;
    });
  };

  const handleAddCurrency = () => {
    setCurrencies((prev) => [...prev, { code: '', countries: [], useAllCountries: false }]);
  };

  const handleRemoveCurrency = (index: number) => {
    setCurrencies((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
  };

  const handlePhaseLevelChange = (index: number, field: keyof EditablePhaseLevel, value: string) => {
    setPhaseLevels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddPhaseLevel = () => {
    const nextLevel = (phaseLevels[phaseLevels.length - 1]?.level ?? -1) + 1;
    const nextDisplayOrder = (phaseLevels[phaseLevels.length - 1]?.displayOrder ?? -1) + 1;

    setPhaseLevels((prev) => [
      ...prev,
      {
        id: '', // Will be assigned by the server
        level: clamp(nextLevel, 0, 10),
        name: `Level ${nextLevel}`,
        nameEn: `Level ${nextLevel}`,
        nameEs: `Nivel ${nextLevel}`,
        commissionRate: '0.00',
        subscriptionDiscountRate: '0.00',
        creditCents: '0.00',
        freeProductValueCents: '0.00',
        displayOrder: nextDisplayOrder,
      } as EditablePhaseLevel & { displayOrder: number },
    ]);
    // capacities will be automatically synchronized via useEffect
  };

  const handleRemovePhaseLevel = (index: number) => {
    setPhaseLevels((prev) => prev.filter((_, i) => i !== index));
    // capacities will be automatically synchronized via useEffect
  };

  const resetForm = () => {
    const normalized = normalizeSettings(settings);
    setCapacities(
      normalized.maxMembersPerLevel.map((entry) => ({
        level: entry.level,
        maxMembers: entry.maxMembers.toString(),
      })),
    );
    setPayoutFrequency(normalized.payoutFrequency);
    setCurrency(normalized.currency);
    setCurrencies(
      normalized.currencies.map((entry) => ({
        code: entry.code,
        countries: entry.countryCodes.map((country) => country.toUpperCase()),
        useAllCountries: entry.countryCodes.length === 0,
      })),
    );
    setAutoAdvanceEnabled(normalized.autoAdvanceEnabled);
    setTeamLevelsVisible(normalized.teamLevelsVisible.toString());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      // Get current phase levels from server to detect deletions
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const currentPhaseLevelsRes = await adminApi.get('/api/admin/phase-levels', { cache: 'no-store' });
      if (!currentPhaseLevelsRes.ok) {
        throw new Error(copy.errors?.loadFailed ?? 'Unable to load the configuration.');
      }
      const currentPhaseLevelsData = (await currentPhaseLevelsRes.json()) as { phaseLevels: PhaseLevel[] };
      const currentPhaseIds = new Set(currentPhaseLevelsData.phaseLevels.map((p) => p.id));

      // Only consider IDs that are in the current form state as "new" IDs to keep
      const formPhaseIds = new Set(phaseLevels.filter((p) => p.id).map((p) => p.id));

      // Detect deleted phase levels: IDs in DB but NOT in form
      const deletedPhaseIds = Array.from(currentPhaseIds).filter((id) => !formPhaseIds.has(id));

      // Delete removed phase levels
      const phaseLevelDeletions = deletedPhaseIds.map(async (id) => {
        return adminApi.delete(`/api/admin/phase-levels/${id}`);
      });

      // Update or create phase levels
      // We only process phases that are currently in the form state
      const phaseLevelUpdates = phaseLevels.map(async (phase) => {
        const commissionRate = parsePercentageInput(phase.commissionRate);
        if (commissionRate === null) {
          const template = copy.errors?.invalidCommissionRate ?? 'Team earnings percentage must be a valid value between 0 and 100.';
          throw new Error(template.replace('{{phase}}', phase.name));
        }

        const subscriptionDiscountRate = parsePercentageInput(phase.subscriptionDiscountRate);
        if (subscriptionDiscountRate === null) {
          const template = copy.errors?.invalidDiscountRate ?? 'Subscription discount must be a valid value between 0 and 100.';
          throw new Error(template.replace('{{phase}}', phase.name));
        }

        const creditCents = currencyToCents(phase.creditCents);
        const freeProductValueCents = currencyToCents(phase.freeProductValueCents);

        // If phase has no ID or the ID is not in the database, it's a new phase level
        if (!phase.id || !currentPhaseIds.has(phase.id)) {
          return adminApi.post('/api/admin/phase-levels', {
            level: phase.level,
            name: phase.name,
            nameEn: phase.nameEn,
            nameEs: phase.nameEs,
            commissionRate,
            subscriptionDiscountRate,
            creditCents,
            freeProductValueCents,
            isActive: true,
            displayOrder: phase.displayOrder,
          });
        }

        // Otherwise, update existing phase level
        // Double check it's not in the deletion list (redundant but safe)
        if (deletedPhaseIds.includes(phase.id)) {
          return Promise.resolve({ ok: true } as Response);
        }

        return adminApi.put(`/api/admin/phase-levels/${phase.id}`, {
          name: phase.name,
          nameEn: phase.nameEn,
          nameEs: phase.nameEs,
          commissionRate,
          subscriptionDiscountRate,
          creditCents,
          freeProductValueCents,
          displayOrder: phase.displayOrder,
        });
      });

      const capacityEntries = capacities.map((entry) => {
        const maxMembers = Number.parseInt(entry.maxMembers, 10);
        if (!Number.isFinite(maxMembers) || maxMembers < 0) {
          throw new Error(copy.errors?.invalidCapacity ?? 'Each level must define a valid capacity.');
        }
        return {
          level: entry.level,
          maxMembers,
        };
      });

      const capacitySet = new Set<number>();
      for (const entry of capacityEntries) {
        if (capacitySet.has(entry.level)) {
          throw new Error(copy.errors?.duplicateLevels ?? 'Each level must be unique.');
        }
        capacitySet.add(entry.level);
      }

      const parsedTeamLevelsVisible = Number.parseInt(teamLevelsVisible, 10);
      if (!Number.isFinite(parsedTeamLevelsVisible) || parsedTeamLevelsVisible < 1 || parsedTeamLevelsVisible > 10) {
        throw new Error(copy.errors?.invalidTeamLevelsVisible ?? 'Team levels visible must be between 1 and 10.');
      }

      const sanitizedCurrenciesWithFlags = currencies
        .map((entry) => {
          const code = entry.code.trim().toUpperCase();

          if (!code) {
            if (entry.countries.length > 0 || entry.useAllCountries) {
              throw new Error(copy.errors?.missingCurrencyCode ?? 'Provide a currency code for the selected countries.');
            }
            return null;
          }

          if (!/^[A-Z]{3}$/.test(code)) {
            throw new Error(copy.errors?.invalidCurrencyCode ?? 'Each currency must be a 3-letter ISO code.');
          }

          if (entry.useAllCountries) {
            return { code, countryCodes: [], useAllCountries: true };
          }

          const normalizedCountries = Array.from(
            new Set(entry.countries.map((country) => country.trim().toUpperCase()).filter(Boolean)),
          );

          if (normalizedCountries.length === 0) {
            throw new Error(
              copy.errors?.missingCountrySelection ??
              'Select at least one country or enable the "All countries" option for this currency.',
            );
          }

          const invalidCountry = normalizedCountries.some((token) => !/^[A-Z]{2}$/.test(token));
          if (invalidCountry) {
            throw new Error(copy.errors?.invalidCountryCode ?? 'Country codes must use the 2-letter ISO standard.');
          }

          return { code, countryCodes: normalizedCountries, useAllCountries: false };
        })
        .filter((entry): entry is { code: string; countryCodes: string[]; useAllCountries: boolean } => Boolean(entry));

      const baseCurrencyCode = currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(baseCurrencyCode)) {
        throw new Error(copy.errors?.invalidCurrencyCode ?? 'Each currency must be a 3-letter ISO code.');
      }

      const seenCodes = new Set<string>();
      const seenCountries = new Set<string>();
      let globalCurrencyCode: string | null = null;

      for (const entry of sanitizedCurrenciesWithFlags) {
        if (seenCodes.has(entry.code)) {
          throw new Error(copy.errors?.duplicateCurrencyCode ?? 'Currency codes must be unique.');
        }
        seenCodes.add(entry.code);

        if (entry.useAllCountries || entry.countryCodes.length === 0) {
          if (globalCurrencyCode && globalCurrencyCode !== entry.code) {
            throw new Error(
              copy.errors?.multipleGlobalCurrencies ?? 'Only one currency can target all remaining countries.',
            );
          }
          globalCurrencyCode = entry.code;
        }

        for (const country of entry.countryCodes) {
          if (seenCountries.has(country)) {
            throw new Error(
              copy.errors?.duplicateCountryAssignment ?? 'Each country can only belong to one currency.',
            );
          }
          seenCountries.add(country);
        }
      }

      if (!seenCodes.has(baseCurrencyCode)) {
        if (globalCurrencyCode && globalCurrencyCode !== baseCurrencyCode) {
          throw new Error(
            copy.errors?.multipleGlobalCurrencies ?? 'Only one currency can target all remaining countries.',
          );
        }
        sanitizedCurrenciesWithFlags.unshift({ code: baseCurrencyCode, countryCodes: [], useAllCountries: true });
        globalCurrencyCode = baseCurrencyCode;
        seenCodes.add(baseCurrencyCode);
      }

      const hasGlobalCurrency = sanitizedCurrenciesWithFlags.some(
        (entry) => entry.useAllCountries || entry.countryCodes.length === 0,
      );

      if (!hasGlobalCurrency) {
        throw new Error(
          copy.errors?.missingGlobalCurrency ??
          'Enable the "All countries" option for at least one currency to cover the remaining countries.',
        );
      }

      const sanitizedCurrencies = sanitizedCurrenciesWithFlags.map(({ code, countryCodes }) => ({
        code,
        countryCodes,
      }));

      // Filter out level 0 entries (phase levels use 0-based indexing, but capacity levels use 1-10)
      const validCapacities = capacityEntries.filter(c => c.level >= 1 && c.level <= 10);

      const payload: AppSettingsUpdateInput = {
        maxMembersPerLevel: [...validCapacities].sort((a, b) => a.level - b.level),
        payoutFrequency,
        currency: currency.trim().toUpperCase(),
        currencies: sanitizedCurrencies,
        autoAdvanceEnabled,
        ecommerceCommissionRate: settings.ecommerceCommissionRate ?? 0.08,
        teamLevelsVisible: parsedTeamLevelsVisible,
      };

      // Execute deletions first to avoid conflicts
      if (phaseLevelDeletions.length > 0) {
        await Promise.all(phaseLevelDeletions);
      }

      const [settingsResponse, ...phaseResponses] = await Promise.all([
        adminApi.put('/api/admin/app-settings', payload),
        ...phaseLevelUpdates,
      ]);

      // Check for errors in settings response
      if (!settingsResponse.ok) {
        let errorMessage = copy.errors?.saveFailed ?? 'Unable to save the configuration.';
        try {
          const errorData = await settingsResponse.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Failed to parse error response
        }
        throw new Error(errorMessage);
      }

      // Check for errors in phase responses
      // Check for errors in phase responses
      const failedPhaseResponses = phaseResponses.filter((r) => !r.ok);
      if (failedPhaseResponses.length > 0) {
        // Try to get the error message from the first failed response
        let errorMessage = copy.errors?.saveFailed ?? 'Unable to save phase level updates.';
        try {
          const errorData = await failedPhaseResponses[0].json();
          if (errorData?.error) {
            errorMessage = `Phase update failed: ${errorData.error}`;
            if (errorData.details) {
              // If details is an object (like Zod issues), stringify it for better visibility
              const detailsStr = typeof errorData.details === 'object'
                ? JSON.stringify(errorData.details)
                : String(errorData.details);
              console.error('Phase update error details:', errorData.details);
              errorMessage += ` (${detailsStr})`;
            }
          }
        } catch (e) {
          console.error('Failed to parse phase error response', e);
        }
        throw new Error(errorMessage);
      }

      // Reload phase levels to get updated IDs for newly created levels
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const updatedPhaseLevelsRes = await adminApi.get('/api/admin/phase-levels', { cache: 'no-store' });
      if (updatedPhaseLevelsRes.ok) {
        const updatedPhaseLevelsData = (await updatedPhaseLevelsRes.json()) as { phaseLevels: PhaseLevel[] };
        setPhaseLevels(
          updatedPhaseLevelsData.phaseLevels.map((phase) => ({
            id: phase.id,
            level: phase.level,
            name: phase.name,
            nameEn: phase.nameEn || phase.name,
            nameEs: phase.nameEs || phase.name,
            commissionRate: formatPercentage(phase.commissionRate),
            subscriptionDiscountRate: formatPercentage(phase.subscriptionDiscountRate ?? 0),
            creditCents: centsToCurrency(phase.creditCents),
            freeProductValueCents: centsToCurrency(phase.freeProductValueCents ?? (phase.level === 1 ? 6500 : 0)),
            displayOrder: phase.displayOrder,
          })),
        );
      }

      const data = (await settingsResponse.json()) as { settings: AppSettings };
      const normalized = normalizeSettings(data.settings);
      setSettings(normalized);

      setCapacities(
        normalized.maxMembersPerLevel.map((entry) => ({
          level: entry.level,
          maxMembers: entry.maxMembers.toString(),
        })),
      );
      setPayoutFrequency(normalized.payoutFrequency);
      setCurrency(normalized.currency);
      setCurrencies(
        normalized.currencies.map((entry) => ({
          code: entry.code,
          countries: entry.countryCodes.map((country) => country.toUpperCase()),
          useAllCountries: entry.countryCodes.length === 0,
        })),
      );
      setAutoAdvanceEnabled(normalized.autoAdvanceEnabled);
      setTeamLevelsVisible(normalized.teamLevelsVisible.toString());

      toast({
        title: copy.toast?.successTitle ?? 'Configuration updated',
        description: copy.toast?.successDescription ?? 'The application settings were saved successfully.',
      });
    } catch (error) {
      console.error('[AdminAppSettings] Failed to save settings', error);
      const description = error instanceof Error ? error.message : copy.errors?.saveFailed;
      toast({
        title: copy.toast?.errorTitle ?? 'Update failed',
        description: description ?? 'Unable to save the configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p className="text-sm text-muted-foreground">{copy.loading ?? 'Loading current configuration...'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{copy.phaseLevels?.title ?? 'Multi-Level Network Configuration'}</h2>
                <p className="text-sm text-muted-foreground">
                  {copy.phaseLevels?.description ?? 'Configure commission rates and rewards for each phase of your multi-level network.'}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleAddPhaseLevel} className="self-start">
                <Plus className="mr-2 h-4 w-4" />
                {copy.phaseLevels?.add ?? 'Add level'}
              </Button>
            </div>
            <div className="grid gap-4">
              {phaseLevels.map((phase, index) => (
                <div
                  key={phase.id || `new-${index}`}
                  className="grid gap-3 rounded-lg border border-border/60 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`phase-name-${index}`}>
                        {copy.phaseLevels?.nameLabel ?? 'Phase Name'} (Level {phase.level})
                      </Label>
                      <Input
                        id={`phase-name-${index}`}
                        value={phase.name}
                        onChange={(e) => handlePhaseLevelChange(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`phase-commission-${index}`}>
                        {copy.phaseLevels?.commissionLabel ?? 'Eccomerce Earnings (%)'}
                      </Label>
                      <Input
                        id={`phase-commission-${index}`}
                        inputMode="decimal"
                        value={phase.commissionRate}
                        onChange={(e) => handlePhaseLevelChange(index, 'commissionRate', e.target.value.replace(/[^0-9.,]/g, ''))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`phase-discount-${index}`}>
                        {copy.phaseLevels?.discountLabel ?? 'Group Gain (%)'}
                      </Label>
                      <Input
                        id={`phase-discount-${index}`}
                        inputMode="decimal"
                        aria-describedby={`phase-group-gain-hint-${index}`}
                        value={phase.subscriptionDiscountRate}
                        onChange={(e) =>
                          handlePhaseLevelChange(
                            index,
                            'subscriptionDiscountRate',
                            e.target.value.replace(/[^0-9.,]/g, ''),
                          )
                        }
                      />
                      <p
                        id={`phase-group-gain-hint-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        {copy.phaseLevels?.groupGainHint ??
                          'Percentage earned by the sponsor from each product sold by this level. Example: enter 10 for 10%.'}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor={`phase-name-en-${index}`}>
                        {copy.phaseLevels?.nameEnLabel ?? 'Name (English)'}
                      </Label>
                      <Input
                        id={`phase-name-en-${index}`}
                        value={phase.nameEn}
                        onChange={(e) => handlePhaseLevelChange(index, 'nameEn', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`phase-name-es-${index}`}>
                        {copy.phaseLevels?.nameEsLabel ?? 'Name (Spanish)'}
                      </Label>
                      <Input
                        id={`phase-name-es-${index}`}
                        value={phase.nameEs}
                        onChange={(e) => handlePhaseLevelChange(index, 'nameEs', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`phase-credit-${index}`}>
                        {copy.phaseLevels?.creditLabel ?? 'Reward Credit'}
                      </Label>
                      <Input
                        id={`phase-credit-${index}`}
                        inputMode="decimal"
                        value={phase.creditCents}
                        onChange={(e) => handlePhaseLevelChange(index, 'creditCents', e.target.value.replace(/[^0-9.,]/g, ''))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`phase-free-product-${index}`}>
                        {copy.phaseLevels?.freeProductLabel ?? 'Free Product Value'}
                      </Label>
                      <Input
                        id={`phase-free-product-${index}`}
                        inputMode="decimal"
                        value={phase.freeProductValueCents}
                        onChange={(e) =>
                          handlePhaseLevelChange(index, 'freeProductValueCents', e.target.value.replace(/[^0-9.,]/g, ''))
                        }
                      />
                    </div>
                  </div>
                  {phaseLevels.length > 1 && (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemovePhaseLevel(index)}
                        aria-label={copy.phaseLevels?.remove ?? 'Remove level'}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {copy.phaseLevels?.remove ?? 'Remove level'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{copy.teamVisibility?.title ?? 'Team page configuration'}</h2>
              <p className="text-sm text-muted-foreground">
                {copy.teamVisibility?.description ??
                  'Control how many downline levels are displayed on the Team page by default. Administrators can expand this range later as the network grows.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-levels-visible">
                {copy.teamVisibility?.levelsLabel ?? 'Visible levels'}
              </Label>
              <Input
                id="team-levels-visible"
                inputMode="numeric"
                value={teamLevelsVisible}
                onChange={(event) => setTeamLevelsVisible(event.target.value.replace(/[^0-9]/g, ''))}
                aria-describedby="team-levels-visible-hint"
              />
              <p id="team-levels-visible-hint" className="text-xs text-muted-foreground">
                {copy.teamVisibility?.levelsHint ??
                  'Members with active subscriptions see this number of levels in their organization overview.'}
              </p>
            </div>
          </section>

          <Separator />

          <section className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currency">{copy.compensation?.currencyLabel ?? 'Default currency'}</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.slice(0, 3).toUpperCase())}
                className="uppercase"
                aria-describedby="currency-hint"
              />
              <p id="currency-hint" className="text-xs text-muted-foreground">
                {copy.compensation?.currencyHint ??
                  'Primary payout currency used when no regional preference matches the member country.'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {copy.compensation?.visibilityTitle ?? 'Regional currencies'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {copy.compensation?.visibilityDescription ??
                    'Map currencies to the countries where they should appear across plans, product prices, and earnings dashboards.'}
                </p>
              </div>

              <div className="space-y-4">
                {currencies.map((entry, index) => {
                  const isDefault = entry.code.toUpperCase() === currency.toUpperCase();
                  const availability = currencyAvailability[index];
                  return (
                    <div
                      key={`currency-${entry.code}-${index}`}
                      className="space-y-4 rounded-lg border border-border/60 p-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,160px)_1fr_auto] sm:items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`currency-code-${index}`}>
                              {copy.compensation?.codeLabel ?? 'Currency code'}
                            </Label>
                            {isDefault ? (
                              <Badge variant="secondary">
                                {copy.compensation?.defaultBadge ?? 'Default'}
                              </Badge>
                            ) : null}
                          </div>
                          <Input
                            id={`currency-code-${index}`}
                            value={entry.code}
                            onChange={(event) => handleCurrencyCodeChange(index, event.target.value)}
                            className="uppercase"
                            aria-describedby={`currency-code-hint-${index}`}
                            disabled={isDefault}
                          />
                          <p id={`currency-code-hint-${index}`} className="text-xs text-muted-foreground">
                            {isDefault
                              ? copy.compensation?.codeDefaultHint ??
                              'Update the default code above to change this value.'
                              : copy.compensation?.codeHint ?? 'Use a valid ISO 4217 currency code (e.g., USD).'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`currency-countries-${index}`}>
                            {copy.compensation?.countriesLabel ?? 'Visible in countries'}
                          </Label>
                          <CurrencyCountrySelector
                            selectedCountries={entry.countries}
                            useAllCountries={entry.useAllCountries}
                            unavailableCountries={Array.from(availability?.unavailable ?? [])}
                            allDisabled={Boolean(availability?.globalTakenElsewhere && !entry.useAllCountries)}
                            locale={normalizedLocale}
                            copy={countrySelectorCopy}
                            id={`currency-countries-${index}`}
                            ariaDescribedBy={`currency-countries-hint-${index}`}
                            onChange={(payload) => handleCurrencyVisibilityChange(index, payload)}
                          />
                          <p id={`currency-countries-hint-${index}`} className="text-xs text-muted-foreground">
                            {copy.compensation?.countriesHint ??
                              'Each country can only belong to one currency. Enable "All countries" to cover every remaining region automatically.'}
                          </p>
                        </div>

                        {isDefault ? (
                          <div className="mt-6 text-right text-xs text-muted-foreground">
                            {copy.compensation?.defaultInfo ??
                              'The default currency is automatically available worldwide unless another mapping overrides it.'}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            className="mt-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveCurrency(index)}
                            aria-label={copy.compensation?.remove ?? 'Remove currency'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="outline" onClick={handleAddCurrency} className="self-start">
                <Plus className="mr-2 h-4 w-4" />
                {copy.compensation?.addCurrency ?? 'Add currency'}
              </Button>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{copy.capacity?.title ?? 'Capacity per level'}</h2>
              <p className="text-sm text-muted-foreground">{copy.capacity?.description}</p>
            </div>
            <div className="grid gap-4">
              {capacities.map((entry, index) => (
                <div
                  key={`capacity-${entry.level}-${index}`}
                  className="grid gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-[80px_1fr] sm:items-center"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`capacity-level-${index}`}>{copy.capacity?.levelLabel ?? 'Level'}</Label>
                    <Input
                      id={`capacity-level-${index}`}
                      inputMode="numeric"
                      value={entry.level.toString()}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`capacity-max-${index}`}>
                      {copy.capacity?.maxMembersLabel ?? 'Maximum members'}
                    </Label>
                    <Input
                      id={`capacity-max-${index}`}
                      inputMode="numeric"
                      value={entry.maxMembers}
                      onChange={(event) =>
                        handleCapacityChange(index, event.target.value.replace(/[^0-9]/g, ''))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{copy.frequency?.title ?? 'Payout frequency'}</Label>
              <Select value={payoutFrequency} onValueChange={(value) => setPayoutFrequency(value as AppSettings['payoutFrequency'])}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={copy.frequency?.placeholder ?? 'Select frequency'} />
                </SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{copy.autoAdvance?.label ?? 'Automatic rank advance'}</p>
                <p className="text-xs text-muted-foreground">{copy.autoAdvance?.description}</p>
              </div>
              <Switch checked={autoAdvanceEnabled} onCheckedChange={setAutoAdvanceEnabled} aria-label="Toggle auto advance" />
            </div>
          </section>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" onClick={resetForm} className="order-2 sm:order-1">
          {copy.actions?.reset ?? 'Reset changes'}
        </Button>
        <Button type="submit" className="order-1 sm:order-2" disabled={saving}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {copy.actions?.saving ?? 'Saving...'}
            </span>
          ) : (
            copy.actions?.save ?? 'Save changes'
          )}
        </Button>
      </div>
    </form>
  );
}
