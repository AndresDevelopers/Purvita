import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { Locale } from '@/i18n/config';
import { ISO_COUNTRY_CODES } from '@/modules/app-settings/domain/constants/iso-country-codes';

export interface ProductCountrySelectorCopy {
  sectionTitle: string;
  sectionDescription: string;
  manageButton: string;
  dialogTitle: string;
  dialogDescription: string;
  searchPlaceholder: string;
  noResults: string;
  helper: string;
  emptySummary: string;
  summaryTemplate: string;
  badgeA11y?: string;
  clearAction: string;
  closeAction: string;
}

export interface ProductCountrySelectorProps {
  selected: string[];
  onChange: (codes: string[]) => void;
  locale: Locale;
  copy: ProductCountrySelectorCopy;
}

const normalizeCountryCode = (value: string): string | null => {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

const buildSummaryLabel = (copy: ProductCountrySelectorCopy, count: number): string => {
  if (count === 0) {
    return copy.emptySummary;
  }

  if (!copy.summaryTemplate.includes('{{count}}')) {
    return copy.summaryTemplate;
  }

  return copy.summaryTemplate.replace('{{count}}', String(count));
};

export function ProductCountrySelector({ selected, onChange, locale, copy }: ProductCountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const normalizedSelection = useMemo(() => {
    const entries = (selected ?? [])
      .map((code) => (typeof code === 'string' ? normalizeCountryCode(code) : null))
      .filter((code): code is string => Boolean(code));
    return new Set(entries);
  }, [selected]);

  const sortedSelection = useMemo(() => Array.from(normalizedSelection).sort(), [normalizedSelection]);

  const regionDisplay = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    }
  }, [locale]);

  const searchTerm = search.trim().toLowerCase();

  const countryOptions = useMemo(() => {
    return ISO_COUNTRY_CODES.map((code) => {
      const label = regionDisplay.of(code) ?? code;
      return { code, label };
    })
      .filter(({ code, label }) => {
        if (!searchTerm) {
          return true;
        }
        return label.toLowerCase().includes(searchTerm) || code.toLowerCase().includes(searchTerm);
      })
      .sort((a, b) => a.label.localeCompare(b.label, locale === 'es' ? 'es' : 'en'));
  }, [locale, regionDisplay, searchTerm]);

  const summaryLabel = useMemo(
    () => buildSummaryLabel(copy, normalizedSelection.size),
    [copy, normalizedSelection.size],
  );

  const handleToggleCountry = (code: string) => {
    const normalized = normalizeCountryCode(code);
    if (!normalized) {
      return;
    }

    const next = new Set(normalizedSelection);
    if (next.has(normalized)) {
      next.delete(normalized);
    } else {
      next.add(normalized);
    }

    onChange(Array.from(next).sort());
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{copy.sectionTitle}</h3>
        <p className="text-sm text-muted-foreground">{copy.sectionDescription}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {sortedSelection.length === 0 ? (
          <span className="text-xs text-muted-foreground">{copy.emptySummary}</span>
        ) : (
          sortedSelection.map((code) => {
            const label = regionDisplay.of(code) ?? code;
            const ariaLabel = copy.badgeA11y
              ? copy.badgeA11y.replace('{{country}}', label)
              : undefined;
            return (
              <Badge key={code} variant="secondary" className="w-fit" aria-label={ariaLabel}>
                {label} ({code})
              </Badge>
            );
          })
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" type="button">
            {copy.manageButton}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{copy.dialogTitle}</DialogTitle>
            <DialogDescription>{copy.dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={copy.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ScrollArea className="h-64 rounded-md border">
              <div className="space-y-2 p-2">
                {countryOptions.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">{copy.noResults}</p>
                ) : (
                  countryOptions.map(({ code, label }) => {
                    const checked = normalizedSelection.has(code);
                    return (
                      <label
                        key={code}
                        className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => handleToggleCountry(code)}
                            id={`product-country-${code}`}
                          />
                          <span>
                            {label}
                            <span className="ml-1 text-xs text-muted-foreground">({code})</span>
                          </span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">{copy.helper}</p>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" type="button" onClick={handleClear} className="justify-start">
              {copy.clearAction}
            </Button>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm text-muted-foreground">{summaryLabel}</span>
              <Button type="button" onClick={() => setOpen(false)}>
                {copy.closeAction}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
