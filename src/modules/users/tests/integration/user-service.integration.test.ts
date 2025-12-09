import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createUserProfile,
  generateReferralCode,
  getCurrentUserProfile,
  getReferredUsers,
  getRecentUsers,
  getUserById,
  getUsers,
  getUsersCount,
  setUserModule,
  updateUserProfile,
  updateUserRole,
  updateUserStatus,
} from "@/lib/services/user-service"
import { createUserModule } from "@/modules/users/factories/user-module"
import type { MockSupabaseClient } from "@/modules/testing/mocks/mock-supabase-client"
import type { SupabaseClient } from "@supabase/supabase-js"

const createClientCalls: unknown[][] = []
const clients = vi.hoisted(() => ({
  component: undefined as MockSupabaseClient | undefined,
  admin: undefined as MockSupabaseClient | undefined,
}))

vi.mock("@/lib/supabase", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  clients.component = new mod.MockSupabaseClient()
  clients.admin = new mod.MockSupabaseClient()
  return {
    supabase: clients.component,
    getServiceRoleClient: vi.fn(() => clients.admin),
    PRODUCTS_BUCKET: "products",
  }
})

vi.mock("@supabase/supabase-js", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  if (!clients.admin) {
    clients.admin = new mod.MockSupabaseClient()
  }
  return {
    createClient: (...args: unknown[]) => {
      createClientCalls.push(args)
      return getAdminClient()
    },
  }
})

describe("Integration: user service", () => {
  const auditLoggerMock = vi.fn<
    (action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) => Promise<void>
  >(() => Promise.resolve())

  beforeEach(() => {
    getComponentClient().reset()
    getAdminClient().reset()
    createClientCalls.length = 0
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role")
    setUserModule(
      createUserModule({
        componentClient: getComponentClient() as unknown as SupabaseClient,
        adminClient: getAdminClient() as unknown as SupabaseClient,
        auditLogger: auditLoggerMock,
      }),
    )
    auditLoggerMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setUserModule(null)
  })

  it("counts users using an exact head query", async () => {
    getComponentClient().queueResponse({ data: null, count: 42, error: null }, "profiles")

    const total = await getUsersCount()

    expect(total).toBe(42)
    const { query } = getComponentClient().queries[0]
    expect(query.select).toHaveBeenCalledWith("*", { count: "exact", head: true })
  })

  it("retrieves users via the admin client", async () => {
    getAdminClient().queueResponse({
      data: [
        {
          id: "user-1",
          name: "Jane",
          email: "jane@example.com",
          created_at: "2024-03-01T10:00:00Z",
        },
      ],
      error: null,
    }, "profiles")

    const users = await getUsers()

    expect(users).toHaveLength(1)
    expect(createClientCalls[0]).toEqual([
      "https://example.supabase.co",
      "service-role",
      { auth: { autoRefreshToken: false, persistSession: false } },
    ])
  })

  it("returns null when a profile lookup misses", async () => {
    getAdminClient().queueResponse({ data: null, error: { code: "PGRST116", message: "not found" } }, "profiles")

    const profile = await getUserById("missing")

    expect(profile).toBeNull()
  })

  it("surfaces unexpected errors from profile lookups", async () => {
    getAdminClient().queueResponse({ data: null, error: { code: "XX000", message: "boom" } }, "profiles")

    await expect(getUserById("broken")).rejects.toThrow("Error fetching user: boom")
  })

  it("fetches the current user profile using the session", async () => {
    getComponentClient().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "jane@example.com" } },
      error: null,
    })

    getComponentClient().queueResponse({
      data: {
        id: "user-1",
        name: "Jane",
        email: "jane@example.com",
      },
      error: null,
    }, "profiles")

    const profile = await getCurrentUserProfile()

    expect(profile).toMatchObject({ id: "user-1", name: "Jane" })
  })

  it("returns null when no authenticated user is present", async () => {
    getComponentClient().auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const profile = await getCurrentUserProfile()

    expect(profile).toBeNull()
    expect(getComponentClient().queries).toHaveLength(0)
  })

  it("returns null when the current user profile is missing", async () => {
    getComponentClient().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-3", email: "sam@example.com" } },
      error: null,
    })

    getComponentClient().queueResponse({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    }, "profiles")

    const profile = await getCurrentUserProfile()

    expect(profile).toBeNull()
  })

  it("returns null when the session is missing", async () => {
    getComponentClient().auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const profile = await getCurrentUserProfile()

    expect(profile).toBeNull()
  })

  it("creates and updates user profiles", async () => {
    getComponentClient().queueResponse({
      data: {
        id: "user-2",
        name: "Alex",
        email: "alex@example.com",
      },
      error: null,
    }, "profiles")

    const created = await createUserProfile({
      name: "Alex",
      email: "alex@example.com",
      referral_code: "alex123",
      pay: true,
      role: "member",
      status: "active",
      commission_rate: 0.1,
      total_earnings: 0,
    })

    expect(created).toMatchObject({ id: "user-2", name: "Alex" })
    // USER_REGISTERED audit log has been removed as per user request

    getAdminClient().queueResponse({
      data: {
        id: "user-2",
        name: "Alex",
        email: "alex@example.com",
        status: "inactive",
      },
      error: null,
    }, "profiles")

    const updated = await updateUserProfile("user-2", { status: "inactive" })
    expect(updated.status).toBe("inactive")
    // USER_PROFILE_UPDATED audit log has been removed as per user request
  })

  it("retrieves referred users ordered by recency", async () => {
    getAdminClient().queueResponse({
      data: [
        {
          id: "user-3",
          name: "Sam",
          referred_by: "user-1",
          created_at: "2024-03-02T10:00:00Z",
        },
      ],
      error: null,
    }, "profiles")

    const referred = await getReferredUsers("user-1")

    expect(referred).toHaveLength(1)
    const { query } = getAdminClient().queries[0]
    expect(query.eq).toHaveBeenCalledWith("referred_by", "user-1")
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false })
  })

  it("generates a unique referral code by iterating existing values", async () => {
    getComponentClient()
      .queueResponse({ data: { id: "user-4" }, error: null }, "profiles")
      .queueResponse({ data: null, error: { code: "PGRST116", message: "not found" } }, "profiles")

    const code = await generateReferralCode("Awesome Coach")

    expect(code).toBe("awesomec1")
  })

  it("throws when referral code lookups fail unexpectedly", async () => {
    getComponentClient().queueResponse({
      data: null,
      error: { code: "42501", message: "denied" },
    }, "profiles")

    await expect(generateReferralCode("Coach"))
      .rejects.toThrow("Error checking referral code: denied")
  })

  it("updates user status and role via the admin client", async () => {
    getAdminClient()
      .queueResponse({
        data: {
          id: "user-5",
          status: "suspended",
          role: "admin",
        },
        error: null,
      }, "profiles")
      .queueResponse({
        data: {
          id: "user-5",
          status: "active",
          role: "admin",
        },
        error: null,
      }, "profiles")

    const status = await updateUserStatus("user-5", "suspended")
    expect(status.status).toBe("suspended")

    const role = await updateUserRole("user-5", "admin")
    expect(role.role).toBe("admin")
  })

  it("fetches recent users with limit control", async () => {
    getComponentClient().queueResponse({
      data: [
        {
          id: "user-6",
          name: "Taylor",
          created_at: "2024-03-02T10:00:00Z",
        },
      ],
      error: null,
    }, "profiles")

    const recent = await getRecentUsers(3)

    expect(recent).toHaveLength(1)
    const { query } = getComponentClient().queries[0]
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(3)
  })

  it("propagates errors when listing users via the admin client fails", async () => {
    getAdminClient().queueResponse({
      data: null,
      error: { message: "service offline" },
    }, "profiles")

    await expect(getUsers()).rejects.toThrow("Error fetching users: service offline")
  })
})

function getComponentClient(): MockSupabaseClient {
  if (!clients.component) {
    throw new Error("Component client not initialised")
  }
  return clients.component
}

function getAdminClient(): MockSupabaseClient {
  if (!clients.admin) {
    throw new Error("Admin client not initialised")
  }
  return clients.admin
}
