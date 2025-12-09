import { z } from 'zod'

export const createRegistrationCodeSchema = z.object({
  code: z.string()
    .min(3, 'Code must be at least 3 characters')
    .max(50, 'Code must be less than 50 characters')
    .regex(/^[A-Z0-9-]+$/, 'Code must contain only uppercase letters, numbers, and hyphens')
    .transform(val => val.toUpperCase()),
  validFrom: z.string().datetime('Invalid date format'),
  validTo: z.string().datetime('Invalid date format')
}).refine(
  data => new Date(data.validFrom) < new Date(data.validTo),
  { message: 'validFrom must be before validTo', path: ['validTo'] }
)

export type CreateRegistrationCodeInput = z.infer<typeof createRegistrationCodeSchema>
