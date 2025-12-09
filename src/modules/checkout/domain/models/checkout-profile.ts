import { z } from 'zod';
import { PaymentProviderSchema, type PaymentProvider } from '@/modules/payments/domain/models/payment-gateway';

const normalizeRequired = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const normalizeOptional = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const normalizeTimestamp = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      // Handle Supabase timestamp format (YYYY-MM-DD HH:MM:SS.ssssss+00)
      // Convert to ISO format by replacing space with 'T' and handling timezone
      let normalized = trimmed;

      // Replace space with 'T' if present
      if (normalized.includes(' ') && !normalized.includes('T')) {
        normalized = normalized.replace(' ', 'T');
      }

      // Ensure it ends with 'Z' if it has +00 timezone
      if (normalized.includes('+00')) {
        normalized = normalized.split('+')[0] + 'Z';
      }

      // Validate that the string is a valid datetime
      const date = new Date(normalized);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  return new Date().toISOString();
};

export const CheckoutProfileSchema = z.object({
  id: z.string().uuid(),
  fullName: z.preprocess(normalizeRequired, z.string()),
  addressLine1: z.preprocess(normalizeRequired, z.string()),
  city: z.preprocess(normalizeRequired, z.string()),
  state: z.preprocess(normalizeOptional, z.string()),
  postalCode: z.preprocess(normalizeOptional, z.string()),
  country: z.preprocess(normalizeRequired, z.string()),
  phone: z.preprocess(normalizeOptional, z.string()),
  paymentProvider: z
    .preprocess((value) => {
      if (typeof value !== 'string') {
        return null;
      }
      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized : null;
    }, PaymentProviderSchema.nullable()),
  updatedAt: z.preprocess(normalizeTimestamp, z.string().datetime()),
});

export type CheckoutProfile = z.infer<typeof CheckoutProfileSchema>;

export const CheckoutProfileUpdateSchema = z.object({
  fullName: z.string().min(1, 'fullName_required').max(200),
  addressLine1: z.string().min(1, 'address_required').max(300),
  city: z.string().min(1, 'city_required').max(120),
  state: z.string().max(120).optional(),
  postalCode: z.string().min(1, 'postal_required').max(30),
  country: z.string().min(1, 'country_required').max(120),
  phone: z.string().max(30).optional(),
  paymentProvider: PaymentProviderSchema.nullable(),
});

export type CheckoutProfileUpdateInput = z.infer<typeof CheckoutProfileUpdateSchema>;

export const emptyCheckoutProfile = (): CheckoutProfile => ({
  id: '',
  fullName: '',
  addressLine1: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  phone: '',
  paymentProvider: null,
  updatedAt: new Date().toISOString(),
});

export type CheckoutPaymentProvider = PaymentProvider;
