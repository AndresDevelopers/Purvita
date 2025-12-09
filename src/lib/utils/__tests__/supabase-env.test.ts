import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  detectMissingSupabaseEnv,
  hasSupabaseEnv,
  formatMissingSupabaseEnvMessage,
  type SupabaseEnvKey
} from '../supabase-env'

describe('supabase-env utilities', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  describe('detectMissingSupabaseEnv', () => {
    it('should return empty array when all env vars are set', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://myproject.supabase.co')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'real-anon-key-123')
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'real-service-role-key-456')

      const keys: SupabaseEnvKey[] = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
      ]
      const missing = detectMissingSupabaseEnv(keys)

      expect(missing).toEqual([])
    })

    it('should detect placeholder URL', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://your_supabase_url.supabase.co')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'real-anon-key-123')

      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      const missing = detectMissingSupabaseEnv(keys)

      expect(missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(missing).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    })

    it('should detect example.supabase.co as placeholder', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')

      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL']
      const missing = detectMissingSupabaseEnv(keys)

      expect(missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    })

    it('should detect undefined env vars', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined)
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined)

      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      const missing = detectMissingSupabaseEnv(keys)

      expect(missing).toHaveLength(2)
      expect(missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    })

    it('should detect empty string as missing', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')

      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL']
      const missing = detectMissingSupabaseEnv(keys)

      expect(missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    })

    it('should detect whitespace-only string as missing', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '   ')

      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL']
      const missing = detectMissingSupabaseEnv(keys)

      expect(missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    })
  })

  describe('hasSupabaseEnv', () => {
    it('should return true when all env vars are set', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://realproject.supabase.co')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'real-key')

      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      const result = hasSupabaseEnv(keys)

      expect(result).toBe(true)
    })

    it('should return false when any env var is missing', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://your_supabase_url.supabase.co')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'real-key')

      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      const result = hasSupabaseEnv(keys)

      expect(result).toBe(false)
    })

    it('should return true for empty array', () => {
      const result = hasSupabaseEnv([])
      expect(result).toBe(true)
    })
  })

  describe('formatMissingSupabaseEnvMessage', () => {
    it('should format single missing key', () => {
      const keys: SupabaseEnvKey[] = ['NEXT_PUBLIC_SUPABASE_URL']
      const message = formatMissingSupabaseEnvMessage(keys)

      expect(message).toBe('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL')
    })

    it('should format multiple missing keys', () => {
      const keys: SupabaseEnvKey[] = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
      ]
      const message = formatMissingSupabaseEnvMessage(keys)

      expect(message).toBe(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY'
      )
    })

    it('should handle empty array', () => {
      const message = formatMissingSupabaseEnvMessage([])
      expect(message).toBe('Missing Supabase environment variables: ')
    })
  })
})
