import { z } from 'zod';

const optionalField = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length === 0 ? null : value))
    .optional();

const referralCodeField = z
  .string()
  .trim()
  .min(4, { message: 'referral_code_min_length' })
  .max(32, { message: 'referral_code_max_length' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, { message: 'referral_code_pattern' })
  .transform((value) => value.toLowerCase());

const optionalUrlField = z
  .union([z.string().trim().url(), z.literal('').transform(() => null), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    return value;
  });

export const ProfileUpdateSchema = z.object({
  name: optionalField(120),
  phone: optionalField(32),
  address: optionalField(255),
  city: optionalField(120),
  state: optionalField(120),
  postal_code: optionalField(32),
  country: optionalField(120),
  avatar_url: optionalUrlField,
  fulfillment_company: optionalField(120),
  referral_code: z
    .union([referralCodeField, z.literal('').transform(() => null), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      return value;
    }),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
