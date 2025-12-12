import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createProduct,
  deleteProduct,
  getFeaturedProducts,
  getProductBySlug,
  getProducts,
  getProductsCount,
} from "@/lib/services/product-service"
import type { MockSupabaseClient } from "@/modules/testing/mocks/mock-supabase-client"

const createClientCalls: unknown[][] = []
const clients = vi.hoisted(() => ({
  component: undefined as MockSupabaseClient | undefined,
  public: undefined as MockSupabaseClient | undefined,
}))

vi.mock("@/lib/supabase", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  clients.component = new mod.MockSupabaseClient()
  return {
    supabase: clients.component,
    getServiceRoleClient: vi.fn(() => clients.component),
    PRODUCTS_BUCKET: "products",
  }
})

vi.mock("@supabase/ssr", async () => {
  if (!clients.component) {
    const mod = await import("@/modules/testing/mocks/mock-supabase-client")
    clients.component = new mod.MockSupabaseClient()
  }
  return {
    createBrowserClient: vi.fn(() => getComponentClient()),
    createServerClient: vi.fn(() => getComponentClient()),
  }
})

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({})),
}))

vi.mock("@supabase/supabase-js", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  clients.public = new mod.MockSupabaseClient()
  return {
    createClient: (...args: unknown[]) => {
      createClientCalls.push(args)
      return getPublicClient()
    },
    AuthApiError: class extends Error {
      constructor(message: string) {
        super(message)
        this.name = "AuthApiError"
      }
    },
  }
})

describe("E2E: product lifecycle with audit logging", () => {
  beforeEach(() => {
    getComponentClient().reset()
    getPublicClient().reset()
    createClientCalls.length = 0
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("persists, retrieves and cleans up product records while recording audits", async () => {
    getComponentClient()
      .queueResponse({ data: baseProduct, error: null }, "products")
      .queueResponse({ data: null, error: null }, "audit_logs")
      .queueResponse({ data: baseProduct, error: null }, "products")
      .queueResponse({
        data: { name: baseProduct.name, slug: baseProduct.slug, price: baseProduct.price },
        error: null,
      }, "products")
      .queueResponse({ data: null, error: null }, "products")
      .queueResponse({ data: null, error: null }, "audit_logs")

    getPublicClient()
      .queueResponse({ data: [baseProduct], error: null }, "products")
      .queueResponse({ data: [baseProduct], error: null }, "products")
      .queueResponse({ data: null, count: 1, error: null }, "products")

    const created = await createProduct(baseProduct)
    expect(created).toMatchObject({ id: "prod-e2e", price: 199 })

    const fetched = await getProductBySlug(baseProduct.slug)
    expect(fetched).not.toBeNull()
    expect(fetched?.slug).toBe(baseProduct.slug)

    const catalog = await getProducts()
    expect(catalog).toHaveLength(1)
    expect(catalog[0].created_at).toBe("2024-03-10T10:00:00.000Z")

    const featured = await getFeaturedProducts(3)
    expect(featured[0].slug).toBe(baseProduct.slug)

    const total = await getProductsCount()
    expect(total).toBe(1)

    await deleteProduct(baseProduct.id)

    const auditLogCalls = getComponentClient().queries.filter((entry) => entry.table === "audit_logs")
    expect(auditLogCalls).toHaveLength(2)

    const creationMetadata = extractAuditMetadata(auditLogCalls, 0)
    expect(creationMetadata).toMatchObject({
      name: baseProduct.name,
      slug: baseProduct.slug,
      price: baseProduct.price,
    })

    const deletionMetadata = extractAuditMetadata(auditLogCalls, 1)
    expect(deletionMetadata).toMatchObject({
      name: baseProduct.name,
      slug: baseProduct.slug,
      price: baseProduct.price,
    })
  })
})

type AuditLogQuery = MockSupabaseClient["queries"][number]

function extractAuditMetadata(entries: AuditLogQuery[], index: number) {
  const operation = entries[index].query.operations.find((op) => op.method === "insert")
  expect(operation).toBeDefined()
  const [[row]] = operation!.args as [[{ metadata: Record<string, unknown> }]]
  return row.metadata as Record<string, unknown>
}

const baseProduct = {
  id: "prod-e2e",
  slug: "smart-trainer",
  name: "Smart Trainer",
  description: "Adaptive resistance trainer",
  price: 199,
  discount_visibility: [...(["main_store", "affiliate_store", "mlm_store"] as const)],
  stock_quantity: 40,
  images: [],
  is_featured: true,
  related_product_ids: [],
  created_at: "2024-03-10T10:00:00Z",
  updated_at: "2024-03-10T12:00:00Z",
}

function getComponentClient(): MockSupabaseClient {
  if (!clients.component) {
    throw new Error("Component client not initialised")
  }
  return clients.component
}

function getPublicClient(): MockSupabaseClient {
  if (!clients.public) {
    throw new Error("Public client not initialised")
  }
  return clients.public
}
