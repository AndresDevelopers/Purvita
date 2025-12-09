import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { getSafeSession, supabase } from "@/lib/supabase"
import type { MockSupabaseClient } from "@/modules/testing/mocks/mock-supabase-client"

const clients = vi.hoisted(() => ({
  component: undefined as MockSupabaseClient | undefined,
}))

vi.mock("@supabase/ssr", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  clients.component = new mod.MockSupabaseClient()
  return {
    createBrowserClient: vi.fn(() => getSupabase()),
    createServerClient: vi.fn(() => getSupabase()),
  }
})

vi.mock("@supabase/supabase-js", () => ({
  AuthApiError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = "AuthApiError"
    }
  },
}))

import { AuthApiError, type Session } from "@supabase/supabase-js"

describe("Unit: getSafeSession", () => {
  beforeEach(() => {
    getSupabase().reset()
  })

  it("returns the active session when Supabase resolves normally", async () => {
    const session = { user: { id: "abc-123" } } as unknown as Session
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session }, error: null })

    const result = await getSafeSession()

    expect(result.data.session?.user.id).toBe("abc-123")
    expect(result.error).toBeNull()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("clears stale refresh tokens and returns a null session", async () => {
    const invalidTokenError = new AuthApiError("Invalid refresh token provided", 401, "invalid_grant")
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(invalidTokenError)

    const result = await getSafeSession()
    expect(result).toEqual({ data: { session: null }, error: null })
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("rethrows unexpected failures so upstream callers can handle them", async () => {
    const unexpected = new Error("network unreachable")
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(unexpected)

    await expect(getSafeSession()).rejects.toThrow(unexpected)
  })
})

function getSupabase(): MockSupabaseClient {
  if (!clients.component) {
    throw new Error("Component client not initialised")
  }
  return clients.component
}
