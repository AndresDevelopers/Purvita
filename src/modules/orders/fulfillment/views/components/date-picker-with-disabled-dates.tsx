'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DatePickerWithDisabledDatesProps {
  selectedDate: string; // YYYY-MM-DD format
  availableDates: string[]; // Array of YYYY-MM-DD dates
  onDateChange: (date: string) => void;
  className?: string;
  disabled?: boolean;
}

export const DatePickerWithDisabledDates = ({
  selectedDate,
  availableDates,
  onDateChange,
  className,
  disabled = false,
}: DatePickerWithDisabledDatesProps) => {
  const [open, setOpen] = useState(false);

  // Convert selectedDate string to Date object
  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined;

  // Create a Set for faster lookup
  const availableDatesSet = new Set(availableDates);

  // Function to check if a date should be disabled
  const isDateDisabled = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return !availableDatesSet.has(dateStr);
  };

  // Handle date selection
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onDateChange(dateStr);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-11 w-48 justify-start rounded-2xl border border-border/60 bg-background-light px-4 text-left text-sm font-medium shadow-sm transition-colors hover:border-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 dark:border-border/40 dark:bg-background-dark',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          {selectedDate ? (
            format(selectedDateObj!, 'PPP', { locale: es })
          ) : (
            <span>Seleccionar fecha</span>
          )}
          <CalendarDays className="ml-auto h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDateObj}
          onSelect={handleSelect}
          disabled={isDateDisabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

