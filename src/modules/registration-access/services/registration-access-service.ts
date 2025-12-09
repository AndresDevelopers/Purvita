import { z } from 'zod'
import { RegistrationAccessEventBus } from '../events/registration-access-event-bus'
import type { RegistrationAccessCode, RegistrationAccessValidationResult } from '../types'
import { RegistrationAccessCodeRepository } from '../repositories/registration-access-code-repository'

const codeSchema = z
  .string()
  .min(1, 'Registration code is required')
  .max(64, 'Registration code is too long')

export class RegistrationAccessService {
  constructor(
    private readonly repository: RegistrationAccessCodeRepository,
    private readonly eventBus: RegistrationAccessEventBus,
  ) {}

  async validateCode(rawCode: string): Promise<RegistrationAccessValidationResult> {
    const parseResult = codeSchema.safeParse(rawCode?.trim())

    if (!parseResult.success) {
      const result: RegistrationAccessValidationResult = { valid: false, reason: 'missing' }
      this.eventBus.notify(result)
      return result
    }

    const normalizedCode = parseResult.data.toUpperCase()

    const active = await this.repository.fetchActiveCode()

    if (!active) {
      const result: RegistrationAccessValidationResult = { valid: false, reason: 'expired' }
      this.eventBus.notify(result)
      return result
    }

    const isValid = active.code.toUpperCase() === normalizedCode

    const result: RegistrationAccessValidationResult = {
      valid: isValid,
      code: active,
      reason: isValid ? undefined : 'mismatch',
    }

    this.eventBus.notify(result)

    return result
  }

  async getActiveCode(): Promise<RegistrationAccessCode | null> {
    return this.repository.fetchActiveCode()
  }

  async recordGeneratedCode(payload: { code: string; validFrom: string; validTo: string }): Promise<RegistrationAccessCode> {
    await this.repository.closePreviousWindows(payload.validFrom)
    return this.repository.saveGeneratedCode(payload)
  }
}
