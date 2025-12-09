import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RegistrationAccessService } from '../services/registration-access-service'
import type { RegistrationAccessCode } from '../types'
import { RegistrationAccessCodeRepository } from '../repositories/registration-access-code-repository'
import { RegistrationAccessEventBus } from '../events/registration-access-event-bus'

const createCode = (overrides: Partial<RegistrationAccessCode> = {}): RegistrationAccessCode => ({
  id: overrides.id ?? 1,
  code: overrides.code ?? 'ABC123',
  validFrom: overrides.validFrom ?? '2025-01-06T00:00:00.000Z',
  validTo: overrides.validTo ?? '2025-01-13T00:00:00.000Z',
  createdAt: overrides.createdAt ?? '2025-01-06T00:00:01.000Z',
})

describe('RegistrationAccessService', () => {
  let repository: RegistrationAccessCodeRepository
  let eventBus: RegistrationAccessEventBus
  let service: RegistrationAccessService
  let fetchActiveCodeMock: ReturnType<typeof vi.fn>
  let notifyMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchActiveCodeMock = vi.fn()
    notifyMock = vi.fn()

    repository = {
      fetchActiveCode: fetchActiveCodeMock,
      saveGeneratedCode: vi.fn(),
      closePreviousWindows: vi.fn(),
    } as unknown as RegistrationAccessCodeRepository

    eventBus = {
      notify: notifyMock,
      subscribe: vi.fn(),
    } as unknown as RegistrationAccessEventBus

    service = new RegistrationAccessService(repository, eventBus)
  })

  it('flags missing codes as invalid', async () => {
    const result = await service.validateCode('  ')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('missing')
    expect(notifyMock).toHaveBeenCalled()
  })

  it('flags validation when no active window exists', async () => {
    fetchActiveCodeMock.mockResolvedValueOnce(null)

    const result = await service.validateCode('ABC123')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('expired')
  })

  it('flags mismatched code', async () => {
    fetchActiveCodeMock.mockResolvedValueOnce(createCode({ code: 'DIFF' }))

    const result = await service.validateCode('ABC123')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('mismatch')
  })

  it('passes validation when code matches active window', async () => {
    const payload = createCode({ code: 'CODE2025' })
    fetchActiveCodeMock.mockResolvedValueOnce(payload)

    const result = await service.validateCode('code2025')

    expect(result.valid).toBe(true)
    expect(result.code).toEqual(payload)
  })
})
