'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ISO_COUNTRY_CODES } from '@/modules/app-settings/domain/constants/iso-country-codes';

interface CurrencyCountrySelectorCopy {
  emptySummary?: string;
  allSummary?: string;
  summaryTemplate?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  allDescription?: string;
  unavailableLabel?: string;
  doneLabel?: string;
}

interface CurrencyCountrySelectorProps {
  selectedCountries: string[];
  useAllCountries: boolean;
  unavailableCountries: string[];
  locale: string;
  copy: CurrencyCountrySelectorCopy;
  disabled?: boolean;
  allDisabled?: boolean;
  id?: string;
  ariaDescribedBy?: string;
  onChange: (payload: { countries: string[]; useAllCountries: boolean }) => void;
}

export function CurrencyCountrySelector({
  selectedCountries,
  useAllCountries,
  unavailableCountries,
  locale,
  copy,
  disabled = false,
  allDisabled = false,
  id,
  ariaDescribedBy,
  onChange,
}: CurrencyCountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const regionDisplay = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' });
    } catch (error) {
      console.warn('[CurrencyCountrySelector] Falling back to English display names', error);
      return new Intl.DisplayNames(['en'], { type: 'region' });
    }
  }, [locale]);

  const normalizedSelection = useMemo(
    () => Array.from(new Set(selectedCountries.map((country) => country.trim().toUpperCase()))),
    [selectedCountries],
  );

  const unavailableSet = useMemo(
    () => new Set(unavailableCountries.map((country) => country.trim().toUpperCase())),
    [unavailableCountries],
  );

  const sortedSelection = useMemo(
    () => [...normalizedSelection].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [normalizedSelection],
  );

  const summary = useMemo(() => {
    if (useAllCountries) {
      return copy.allSummary ?? 'All countries';
    }

    if (sortedSelection.length === 0) {
      return copy.emptySummary ?? 'Select countries';
    }

    if (sortedSelection.length === 1) {
      const label = regionDisplay.of(sortedSelection[0]) ?? sortedSelection[0];
      return `${label} (${sortedSelection[0]})`;
    }

    const template = copy.summaryTemplate ?? '{{count}} countries selected';
    return template.replace('{{count}}', String(sortedSelection.length));
  }, [copy.allSummary, copy.emptySummary, copy.summaryTemplate, regionDisplay, sortedSelection, useAllCountries]);

  const countryOptions = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    const base = ISO_COUNTRY_CODES.map((code) => ({
      code,
      label: regionDisplay.of(code) ?? code,
    }));

    const filtered = normalizedQuery
      ? base.filter((entry) =>
          entry.code.toLowerCase().includes(normalizedQuery) || entry.label.toLowerCase().includes(normalizedQuery),
        )
      : base;

    return filtered.sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
  }, [locale, regionDisplay, search]);

  const handleToggleCountry = (countryCode: string) => {
    const normalized = countryCode.trim().toUpperCase();
    const selection = new Set(normalizedSelection);
    if (selection.has(normalized)) {
      selection.delete(normalized);
    } else {
      selection.add(normalized);
    }

    onChange({ countries: Array.from(selection), useAllCountries: false });
  };

  const handleToggleAll = (next: boolean) => {
    onChange({ countries: next ? [] : normalizedSelection, useAllCountries: next });
  };

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between text-left font-normal',
              useAllCountries || sortedSelection.length > 0 ? 'text-foreground' : 'text-muted-foreground',
            )}
            disabled={disabled}
            id={id}
            aria-describedby={ariaDescribedBy}
          >
            <span className="truncate">{summary}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{copy.dialogTitle ?? 'Assign visibility by country'}</DialogTitle>
            <DialogDescription>
              {copy.dialogDescription ??
                'Choose the countries where this currency should be visible. Each country can only belong to one currency.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder ?? 'Search by name or code'}
              autoFocus
            />

            <div className="space-y-2 rounded-lg border p-3">
              <label
                className={cn(
                  'flex items-start gap-3 rounded-md border border-border/40 p-3',
                  allDisabled && !useAllCountries ? 'opacity-60' : '',
                )}
              >
                <Checkbox
                  checked={useAllCountries}
                  onCheckedChange={(checked) => handleToggleAll(Boolean(checked))}
                  disabled={allDisabled && !useAllCountries}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">{copy.allLabel ?? 'All countries'}</span>
                  <p className="text-xs text-muted-foreground">
                    {copy.allDescription ??
                      'Applies this currency to every country that is not explicitly assigned to another currency.'}
                  </p>
                </div>
              </label>

              <ScrollArea className="h-64 rounded-md border border-dashed">
                <div className="divide-y">
                  {countryOptions.map((option) => {
                    const isSelected = normalizedSelection.includes(option.code);
                    const isDisabled = useAllCountries || (!isSelected && unavailableSet.has(option.code));

                    return (
                      <label
                        key={option.code}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                          isDisabled ? 'cursor-not-allowed opacity-50' : '',
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleCountry(option.code)}
                          disabled={isDisabled}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.code}</span>
                          {!isSelected && unavailableSet.has(option.code) ? (
                            <span className="text-xs text-destructive">{copy.unavailableLabel ?? 'Already assigned'}</span>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {copy.doneLabel ?? 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {useAllCountries ? (
        <Badge variant="secondary" className="w-fit">
          {copy.allSummary ?? 'All countries'}
        </Badge>
      ) : sortedSelection.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sortedSelection.map((country) => (
            <Badge key={country} variant="secondary" className="w-fit">
              {country}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
