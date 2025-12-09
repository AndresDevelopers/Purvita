import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

type JsonRecord = Record<string, unknown>

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[registration-access-code] Missing Supabase credentials')
}

/**
 * Generates a human-friendly registration code
 * Format: PURVITA-XXXXX (where X is alphanumeric)
 */
const generateCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous chars: I, O, 0, 1
  let code = 'PURVITA-'
  
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    code += chars[randomIndex]
  }
  
  return code
}

/**
 * Calculates the weekly window for code validity
 * Week starts on Monday at 00:00:00 UTC
 * @param reference - Reference date (defaults to now)
 * @returns Object with validFrom and validTo dates
 */
const resolveWindow = (reference = new Date()) => {
  const normalized = new Date(reference.toISOString())
  normalized.setUTCHours(0, 0, 0, 0)

  // Calculate days since Monday (0 = Sunday, 1 = Monday, etc.)
  const day = normalized.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  
  // Set to Monday of current week
  normalized.setUTCDate(normalized.getUTCDate() - daysSinceMonday)

  const validFrom = new Date(normalized)
  const validTo = new Date(validFrom)
  validTo.setUTCDate(validTo.getUTCDate() + 7)

  return { validFrom, validTo }
}

// Initialize Supabase client once (reused across invocations)
const client = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null

serve(async (req) => {
  const startTime = Date.now()
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Verify client is initialized
  if (!client) {
    console.error('[registration-access-code] Supabase client not initialized')
    return new Response(JSON.stringify({ error: 'Service unavailable' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const now = new Date()
    const { validFrom, validTo } = resolveWindow(now)
    const code = generateCode()
    const validFromIso = validFrom.toISOString()
    const validToIso = validTo.toISOString()

    console.log('[registration-access-code] Generating code for window:', {
      validFrom: validFromIso,
      validTo: validToIso,
    })

    // Close any overlapping previous windows
    const { error: updateError } = await client
      .from('registration_access_codes')
      .update({ valid_to: validFromIso })
      .lt('valid_from', validFromIso)
      .gte('valid_to', validFromIso) // Fixed: use gte instead of gt

    if (updateError) {
      console.error('[registration-access-code] Failed to close previous windows:', updateError)
      return new Response(JSON.stringify({ 
        error: 'Failed to prepare window',
        details: updateError.message 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Insert new code
    const { data, error } = await client
      .from('registration_access_codes')
      .insert({
        code,
        valid_from: validFromIso,
        valid_to: validToIso,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[registration-access-code] Failed to store new code:', error)
      return new Response(JSON.stringify({ 
        error: 'Failed to store code',
        details: error.message 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const executionTime = Date.now() - startTime
    const payload: JsonRecord = {
      success: true,
      code: data.code,
      validFrom: data.valid_from,
      validTo: data.valid_to,
      createdAt: data.created_at,
      executionTimeMs: executionTime,
    }

    console.log('[registration-access-code] ✅ Generated weekly access code:', {
      code: data.code,
      window: `${data.valid_from} → ${data.valid_to}`,
      executionTimeMs: executionTime,
    })

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error('[registration-access-code] ❌ Unexpected error:', error)
    
    return new Response(JSON.stringify({ 
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: executionTime,
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
