import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getFeaturedProducts,
  getProductsCount,
  getRelatedProducts,
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
  }
})

describe("Contract: product service queries", () => {
  beforeEach(() => {
    getComponentClient().reset()
    getPublicClient().reset()
    createClientCalls.length = 0
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("requests featured products with the expected filters and ordering", async () => {
    getComponentClient().queueResponse({
      data: [baseProduct],
      error: null,
    }, "products")

    const results = await getFeaturedProducts(1)

    expect(results).toHaveLength(1)

    const { query } = getComponentClient().queries[0]
    expect(query.select).toHaveBeenCalledWith("*")
    expect(query.eq).toHaveBeenCalledWith("is_featured", true)
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(1)
  })

  it("asks Supabase for an exact count when computing inventory totals", async () => {
    getComponentClient().queueResponse({
      data: null,
      count: 5,
      error: null,
    }, "products")

    const total = await getProductsCount()

    expect(total).toBe(5)
    const { query } = getComponentClient().queries[0]
    expect(query.select).toHaveBeenCalledWith("*", { count: "exact", head: true })
  })

  it("excludes the active product while fetching related recommendations", async () => {
    // First query to get base product
    getComponentClient().queueResponse({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    }, "products")

    // Second query to get related products
    getComponentClient().queueResponse({
      data: [baseProduct],
      error: null,
    }, "products")

    const related = await getRelatedProducts("smart-mat")

    expect(related).toHaveLength(1)
    const { query } = getComponentClient().queries[1]
    expect(query.neq).toHaveBeenCalledWith("slug", "smart-mat")
    expect(query.limit).toHaveBeenCalledWith(3)
  })
})

const baseProduct = {
  id: "prod-1",
  slug: "smart-mat",
  name: "Smart Mat",
  description: "Connected training mat",
  price: 120,
  stock_quantity: 25,
  images: [],
  is_featured: true,
  created_at: "2024-02-01T10:00:00Z",
  updated_at: "2024-02-01T12:00:00Z",
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
