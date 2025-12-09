import { getServiceRoleClient } from '@/lib/supabase'
import type { RegistrationAccessCode } from '../types'

const TABLE = 'registration_access_codes'

type RegistrationAccessCodeRow = {
  id: number
  code: string
  valid_from: string
  valid_to: string
  created_at: string
}

const mapRecord = (row: RegistrationAccessCodeRow): RegistrationAccessCode => ({
  id: row.id,
  code: row.code,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  createdAt: row.created_at,
})

export class RegistrationAccessCodeRepository {
  async fetchActiveCode(referenceDate: Date = new Date()): Promise<RegistrationAccessCode | null> {
    const client = getServiceRoleClient()

    if (!client) {
      throw new Error('Supabase service role client is unavailable')
    }

    const isoDate = referenceDate.toISOString()

    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .lte('valid_from', isoDate)
      .gte('valid_to', isoDate)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return null
    }

    return mapRecord(data)
  }

  async saveGeneratedCode(input: {
    code: string
    validFrom: string
    validTo: string
  }): Promise<RegistrationAccessCode> {
    const client = getServiceRoleClient()

    if (!client) {
      throw new Error('Supabase service role client is unavailable')
    }

    const { data, error } = await client
      .from(TABLE)
      .insert({
        code: input.code,
        valid_from: input.validFrom,
        valid_to: input.validTo,
      })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return mapRecord(data)
  }

  async closePreviousWindows(beforeIsoDate: string): Promise<void> {
    const client = getServiceRoleClient()

    if (!client) {
      throw new Error('Supabase service role client is unavailable')
    }

    const { error } = await client
      .from(TABLE)
      .update({ valid_to: beforeIsoDate })
      .lt('valid_from', beforeIsoDate)
      .gt('valid_to', beforeIsoDate)

    if (error) {
      throw error
    }
  }
}
