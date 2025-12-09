export interface RegistrationAccessCode {
  id: number
  code: string
  validFrom: string
  validTo: string
  createdAt: string
}

export interface RegistrationAccessValidationResult {
  valid: boolean
  code?: RegistrationAccessCode
  reason?: 'missing' | 'expired' | 'mismatch'
}

export type RegistrationAccessObserver = (result: RegistrationAccessValidationResult) => void
