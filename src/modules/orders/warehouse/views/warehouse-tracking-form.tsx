'use client';

import { useEffect, useMemo, useState as _useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  WarehouseTrackingCreateInputSchema,
  WarehouseTrackingUpdateInputSchema,
  type WarehouseTrackingCreateInput,
  type WarehouseTrackingDictionary,
  type WarehouseTrackingUpdateInput,
  WAREHOUSE_TRACKING_STATUSES,
  generateWarehouseTrackingCode,
} from '../domain/models/warehouse-tracking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type WarehouseTrackingFormDefaults =
  | (Partial<WarehouseTrackingCreateInput & WarehouseTrackingUpdateInput> & {
      orderId?: string | null;
    })
  | undefined;

type WarehouseTrackingFormProps =
  | {
      mode: 'create';
      dictionary: WarehouseTrackingDictionary;
      onSubmit: (input: WarehouseTrackingCreateInput) => Promise<unknown>;
      onCancel: () => void;
      defaultValues?: WarehouseTrackingFormDefaults;
      submitting: boolean;
    }
  | {
      mode: 'update';
      dictionary: WarehouseTrackingDictionary;
      onSubmit: (input: WarehouseTrackingUpdateInput) => Promise<unknown>;
      onCancel: () => void;
      defaultValues?: WarehouseTrackingFormDefaults;
      submitting: boolean;
    };

type StatusValue = WarehouseTrackingCreateInput['status'];

interface FormValues {
  orderId: string;
  status: StatusValue;
  responsibleCompany?: string | null;
  trackingCode?: string | null;
  location?: string | null;
  note?: string | null;
  estimatedDelivery?: string | null;
  eventTime?: string | null;
}

const createSchema = WarehouseTrackingCreateInputSchema;

const updateSchema = WarehouseTrackingUpdateInputSchema.extend({
  orderId: WarehouseTrackingCreateInputSchema.shape.orderId,
  status: WarehouseTrackingCreateInputSchema.shape.status,
});

const toDateInputValue = (value?: string | null, slice = 10) => {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return timestamp.toISOString().slice(0, slice);
};

const mapToFormValues = (defaults: WarehouseTrackingFormDefaults): FormValues => {
  const status = (defaults?.status as StatusValue | undefined) ?? 'pending';

  return {
    orderId: defaults?.orderId ?? '',
    status,
    responsibleCompany: (defaults?.responsibleCompany as string | null | undefined) ?? null,
    trackingCode: (defaults?.trackingCode as string | null | undefined) ?? null,
    location: (defaults?.location as string | null | undefined) ?? null,
    note: (defaults?.note as string | null | undefined) ?? null,
    estimatedDelivery: toDateInputValue(defaults?.estimatedDelivery ?? null, 10),
    eventTime: toDateInputValue(defaults?.eventTime ?? null, 16),
  };
};

const normalizeNullableText = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDateValue = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return timestamp.toISOString();
};

const normalizeCreatePayload = (values: FormValues): WarehouseTrackingCreateInput => ({
  orderId: values.orderId.trim(),
  status: values.status,
  responsibleCompany: normalizeNullableText(values.responsibleCompany) ?? undefined,
  trackingCode: normalizeNullableText(values.trackingCode) ?? undefined,
  location: normalizeNullableText(values.location) ?? undefined,
  note: normalizeNullableText(values.note) ?? undefined,
  estimatedDelivery: normalizeDateValue(values.estimatedDelivery) ?? undefined,
  eventTime: normalizeDateValue(values.eventTime) ?? undefined,
});

const normalizeUpdatePayload = (values: FormValues): WarehouseTrackingUpdateInput => ({
  status: values.status,
  responsibleCompany: normalizeNullableText(values.responsibleCompany) ?? null,
  trackingCode: normalizeNullableText(values.trackingCode) ?? null,
  location: normalizeNullableText(values.location) ?? null,
  note: normalizeNullableText(values.note) ?? null,
  estimatedDelivery: normalizeDateValue(values.estimatedDelivery),
  eventTime: normalizeDateValue(values.eventTime),
});

export const WarehouseTrackingForm = (props: WarehouseTrackingFormProps) => {
  const { mode, dictionary, onSubmit, onCancel, defaultValues, submitting } = props;
  const formDefaults = useMemo(() => mapToFormValues(defaultValues), [defaultValues]);

  const form = useForm<FormValues>({
    resolver: zodResolver(mode === 'create' ? createSchema : updateSchema) as any,
    defaultValues: formDefaults,
  });

  useEffect(() => {
    form.reset(formDefaults);
  }, [formDefaults, form, mode]);

  useEffect(() => {
    if (mode !== 'create') {
      return;
    }

    const currentTracking = form.getValues('trackingCode');
    if (!currentTracking) {
      form.setValue('trackingCode', generateWarehouseTrackingCode(), {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [form, mode]);


  const handleSubmit = form.handleSubmit(async (values) => {
    if (mode === 'create') {
      await onSubmit(normalizeCreatePayload(values));
    } else {
      await onSubmit(normalizeUpdatePayload(values));
    }
  });

  const disableSubmit = mode === 'create' && !form.watch('orderId');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'create' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="orderId">
            {dictionary.form.orderLookup.label}
          </label>
          <Input
            id="orderId"
            {...form.register('orderId', {
              setValueAs: (value: string) => value?.trim() ?? '',
            })}
            placeholder={dictionary.form.orderLookup.placeholder}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {dictionary.form.orderLookup.helper}
          </p>
          {form.formState.errors.orderId && (
            <p className="text-xs text-rose-500">{form.formState.errors.orderId.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="status">
          {dictionary.form.fields.status}
        </label>
        <Select
          value={form.watch('status')}
          onValueChange={(value) =>
            form.setValue('status', value as FormValues['status'], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="status">
            <SelectValue placeholder={dictionary.form.fields.status} />
          </SelectTrigger>
          <SelectContent>
            {WAREHOUSE_TRACKING_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {dictionary.statusBadges[status] ?? status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="responsibleCompany">
          {dictionary.form.fields.responsibleCompany}
        </label>
        <Input
          id="responsibleCompany"
          {...form.register('responsibleCompany', {
            setValueAs: (value: string) => value?.trim() || null,
          })}
          placeholder="PurVita Logistics"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="trackingCode">
          {dictionary.form.fields.trackingCode}
        </label>
        <Input
          id="trackingCode"
          {...form.register('trackingCode', {
            setValueAs: (value: string) => value?.trim() || null,
          })}
          placeholder="TRK-123456"
          readOnly={mode === 'create'}
          className={cn(mode === 'create' ? 'bg-zinc-100 dark:bg-zinc-800/70' : '', 'font-mono')}
        />
        {mode === 'create' && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{dictionary.form.autoTrackingNote}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="location">
          {dictionary.form.fields.location}
        </label>
        <Input
          id="location"
          {...form.register('location', {
            setValueAs: (value: string) => value?.trim() || null,
          })}
          placeholder="San José, CR"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="note">
          {dictionary.form.fields.note}
        </label>
        <Textarea
          id="note"
          rows={3}
          {...form.register('note', {
            setValueAs: (value: string) => value?.trim() || null,
          })}
          placeholder="Lote listo para despacho"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="estimatedDelivery">
            {dictionary.form.fields.estimatedDelivery}
          </label>
          <Input
            id="estimatedDelivery"
            type="date"
            {...form.register('estimatedDelivery', {
              setValueAs: (value: string) => (value ? value : null),
            })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="eventTime">
            {dictionary.form.fields.eventTime}
          </label>
          <Input
            id="eventTime"
            type="datetime-local"
            {...form.register('eventTime', {
              setValueAs: (value: string) => (value ? value : null),
            })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          {dictionary.form.cancel}
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting || disableSubmit}>
          {submitting
            ? mode === 'create'
              ? dictionary.form.submitting
              : dictionary.form.updating
            : mode === 'create'
              ? dictionary.form.submit
              : dictionary.form.update}
        </Button>
      </div>
    </form>
  );
};
