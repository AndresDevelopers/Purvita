import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getRecentAuditLogs, logUserAction } from "@/lib/services/audit-log-service"
import type { MockSupabaseClient } from "@/modules/testing/mocks/mock-supabase-client"

const clients = vi.hoisted(() => ({
  component: undefined as MockSupabaseClient | undefined,
  audit: undefined as MockSupabaseClient | undefined,
}))

vi.mock("@/lib/supabase", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  clients.component = new mod.MockSupabaseClient()
  clients.audit = new mod.MockSupabaseClient()
  return {
    supabase: clients.component,
    getServiceRoleClient: vi.fn(() => clients.audit),
    PRODUCTS_BUCKET: "products",
  }
})

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({})),
}))

vi.mock("@supabase/ssr", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  if (!clients.audit) {
    clients.audit = new mod.MockSupabaseClient()
  }
  if (!clients.component) {
    clients.component = new mod.MockSupabaseClient()
  }
  return {
    createBrowserClient: vi.fn(() => getComponentClient()),
    createServerClient: vi.fn(() => getAuditClient()),
  }
})

describe("Unit: audit log service", () => {
  beforeEach(() => {
    getAuditClient().reset()
    getComponentClient().reset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("persists audit entries with the expected metadata", async () => {
    getAuditClient().queueResponse({ data: null, error: null }, "audit_logs")

    await logUserAction("PRODUCT_CREATED", "product", "prod-1", { price: 120 })

    const { query } = getAuditClient().queries[0]
    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        action: "PRODUCT_CREATED",
        entity_type: "product",
        entity_id: "prod-1",
        metadata: { price: 120 },
      }),
    ])
  })

  it("falls back to console logging when Supabase rejects the entry", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    getAuditClient().queueResponse({ data: null, error: { message: "permission denied" } }, "audit_logs")

    await logUserAction("PRODUCT_CREATED", "product", "prod-1", { price: 120 })

    expect(errorSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("AUDIT LOG FALLBACK"),
    )

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it("enriches audit log records with profile information", async () => {
    getAuditClient()
      .queueResponse({
        data: [
          {
            id: "log-1",
            created_at: "2024-03-01T10:00:00Z",
            action: "PRODUCT_CREATED",
            entity_type: "product",
            entity_id: "prod-1",
            user_id: "user-1",
            metadata: { price: 120 },
          },
        ],
        error: null,
      }, "audit_logs")
      .queueResponse({
        data: [
          { id: "user-1", name: "Jane", email: "jane@example.com" },
        ],
        error: null,
      }, "profiles")

    const logs = await getRecentAuditLogs("product", 5)

    expect(logs).toHaveLength(1)
    expect(logs[0].profiles).toEqual({
      id: "user-1",
      name: "Jane",
      email: "jane@example.com",
    })
  })

  it("returns an empty collection when Supabase errors", async () => {
    getAuditClient().queueResponse({ data: null, error: { message: "failure" } }, "audit_logs")

    const logs = await getRecentAuditLogs("product", 5)

    expect(logs).toEqual([])
  })

  it("continues when the profile lookup fails", async () => {
    getAuditClient()
      .queueResponse({
        data: [
          {
            id: "log-2",
            created_at: "2024-03-01T10:00:00Z",
            action: "PRODUCT_UPDATED",
            entity_type: "product",
            entity_id: "prod-1",
            user_id: "user-1",
            metadata: { price: 150 },
          },
        ],
        error: null,
      }, "audit_logs")
      .queueResponse({
        data: null,
        error: { message: "cannot access profiles" },
      }, "profiles")

    const logs = await getRecentAuditLogs("product", 5)

    expect(logs).toHaveLength(1)
    expect(logs[0].profiles).toBeNull()
  })

  it("skips profile lookups when audit logs do not include user references", async () => {
    getAuditClient().queueResponse({
      data: [
        {
          id: "log-3",
          created_at: "2024-03-02T09:00:00Z",
          action: "PRODUCT_VIEWED",
          entity_type: "product",
          entity_id: "prod-2",
          user_id: null,
          metadata: { source: "marketing" },
        },
      ],
      error: null,
    }, "audit_logs")

    const logs = await getRecentAuditLogs("product", 3)

    expect(logs).toHaveLength(1)
    expect(logs[0].profiles).toBeNull()
    const profileQuery = getAuditClient().queries.find((entry) => entry.table === "profiles")
    expect(profileQuery).toBeUndefined()
  })
})

function getAuditClient(): MockSupabaseClient {
  if (!clients.audit) {
    throw new Error("Audit client not initialised")
  }
  return clients.audit
}

function getComponentClient(): MockSupabaseClient {
  if (!clients.component) {
    throw new Error("Component client not initialised")
  }
  return clients.component
}
