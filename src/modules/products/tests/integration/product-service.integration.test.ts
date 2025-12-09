import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createProduct,
  deleteProduct,
  getFeaturedProducts,
  getProductBySlug,
  getProducts,
  getProductsCount,
  getRecentProducts,
  getRelatedProducts,
  updateProduct,
  uploadProductImage,
  uploadProductImages,
} from "@/lib/services/product-service"
import type { MockSupabaseClient } from "@/modules/testing/mocks/mock-supabase-client"

const createClientCalls: unknown[][] = []
const clients = vi.hoisted(() => ({
  component: undefined as MockSupabaseClient | undefined,
  public: undefined as MockSupabaseClient | undefined,
}))

vi.mock("@/lib/services/audit-log-service", () => ({
  logUserAction: vi.fn(),
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

describe("Integration: product service", () => {
  beforeEach(() => {
    getComponentClient().reset()
    getPublicClient().reset()
    createClientCalls.length = 0
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("retrieves and normalizes the public catalog", async () => {
    getPublicClient().queueResponse({
      data: [
        {
          id: "prod-1",
          slug: "smart-mat",
          name: "Smart Mat",
          description: "Connected training mat",
          price: "120",
          images: null,
          is_featured: "1",
          created_at: "2024-02-01 10:00:00",
          updated_at: "2024-02-01 12:00:00",
        },
      ],
      error: null,
    }, "products")

    const products = await getProducts()

    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      slug: "smart-mat",
      price: 120,
      is_featured: true,
      created_at: "2024-02-01T10:00:00.000Z",
    })
    expect(createClientCalls[0]).toEqual([
      "https://example.supabase.co",
      "anon",
    ])
  })

  it("throws when the catalog query fails", async () => {
    getPublicClient().queueResponse({
      data: null,
      error: { message: "network down" },
    }, "products")

    await expect(getProducts()).rejects.toThrow("Error fetching products: network down")
  })

  it("warns and returns an empty list when the featured column is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    getPublicClient().queueResponse({
      data: null,
      error: { code: "42703", message: "column is_featured does not exist" },
    }, "products")

    const featured = await getFeaturedProducts(3)

    expect(featured).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("is_featured"),
    )

    warnSpy.mockRestore()
  })

  it("counts inventory using exact head queries", async () => {
    getPublicClient().queueResponse({
      data: null,
      count: 5,
      error: null,
    }, "products")

    const total = await getProductsCount()

    expect(total).toBe(5)
    const { query } = getPublicClient().queries[0]
    expect(query.select).toHaveBeenCalledWith("*", { count: "exact", head: true })
  })

  it("returns null when a product slug does not exist", async () => {
    getComponentClient().queueResponse({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    }, "products")

    const product = await getProductBySlug("missing")

    expect(product).toBeNull()
  })

  it("throws when Supabase returns an unexpected error for product lookup", async () => {
    getComponentClient().queueResponse({
      data: null,
      error: { code: "PGRST201", message: "timeout" },
    }, "products")

    await expect(getProductBySlug("broken")).rejects.toThrow(
      "Error fetching product: timeout",
    )
  })

  it("builds the related products query by excluding the active slug", async () => {
    getPublicClient().queueResponse({
      data: [
        {
          id: "prod-2",
          slug: "smart-band",
          name: "Smart Band",
          description: "Wearable tracker",
          price: 80,
          images: [],
          created_at: "2024-02-03T10:00:00Z",
        },
      ],
      error: null,
    }, "products")

    const related = await getRelatedProducts("smart-mat")

    expect(related).toHaveLength(1)
    const { query } = getPublicClient().queries[0]
    expect(query.neq).toHaveBeenCalledWith("slug", "smart-mat")
    expect(query.limit).toHaveBeenCalledWith(3)
  })

  it("creates, updates and deletes products while logging audits", async () => {
    const { logUserAction } = await import("@/lib/services/audit-log-service")

    const updatedProduct = {
      ...baseProduct,
      price: 199,
      updated_at: "2024-02-02T08:00:00Z",
    }

    getComponentClient()
      .queueResponse({ data: baseProduct, error: null }, "products")
      .queueResponse({ data: updatedProduct, error: null }, "products")
      .queueResponse({
        data: {
          name: baseProduct.name,
          slug: baseProduct.slug,
          price: baseProduct.price,
        },
        error: null,
      }, "products")
      .queueResponse({ data: null, error: null }, "products")

    const created = await createProduct(baseProduct)
    expect(created.slug).toBe(baseProduct.slug)

    const updated = await updateProduct(baseProduct.id, { price: 199 })
    expect(updated).toMatchObject({
      id: baseProduct.id,
      slug: baseProduct.slug,
      price: 199,
    })

    await deleteProduct(baseProduct.id)

    expect(logUserAction).toHaveBeenCalledTimes(3)
    expect(logUserAction).toHaveBeenNthCalledWith(
      1,
      "PRODUCT_CREATED",
      "product",
      baseProduct.id,
      expect.objectContaining({ slug: baseProduct.slug })
    )
  })

  it("falls back to minimal deletion metadata when the product snapshot is unavailable", async () => {
    const { logUserAction } = await import("@/lib/services/audit-log-service")

    getComponentClient()
      .queueResponse({ data: null, error: { code: "PGRST116", message: "not found" } }, "products")
      .queueResponse({ data: null, error: null }, "products")

    await deleteProduct("prod-missing")

    expect(logUserAction).toHaveBeenCalledWith(
      "PRODUCT_DELETED",
      "product",
      "prod-missing",
      { productId: "prod-missing" }
    )
  })

  it("throws when the deletion snapshot query fails unexpectedly", async () => {
    getComponentClient().queueResponse({
      data: null,
      error: { code: "XX000", message: "boom" },
    }, "products")

    await expect(deleteProduct("prod-error")).rejects.toThrow(
      "Error fetching product for deletion: boom",
    )
  })

  it("uploads single and multiple images with generated paths", async () => {
    getComponentClient().queueStorageResponse({
      data: { path: "products/prod-1/1700000000000.png" },
    })

    const file = { name: "image.png" } as unknown as File
    const image = await uploadProductImage(file, "prod-1")

    expect(image.id).toContain("prod-1")
    expect(image.url).toContain("https://cdn.local/")

    getComponentClient()
      .queueStorageResponse({ data: { path: "products/prod-1/a.png" } })
      .queueStorageResponse({ data: { path: "products/prod-1/b.png" } })

    const files = ["a.png", "b.png"].map((name) => ({ name } as unknown as File))
    const images = await uploadProductImages(files, "prod-1")
    expect(images).toHaveLength(2)
  })

  it("translates Supabase storage errors into descriptive messages", async () => {
    getComponentClient().queueStorageResponse({
      error: { message: "Bucket not found" },
    })

    const file = { name: "missing.png" } as unknown as File
    await expect(uploadProductImage(file, "prod-404")).rejects.toThrow(
      "bucket \"products\"",
    )
  })

  it("retrieves recent products with the configured limit", async () => {
    getPublicClient().queueResponse({
      data: [baseProduct],
      error: null,
    }, "products")

    const recent = await getRecentProducts(2)

    expect(recent).toHaveLength(1)
    const { query } = getPublicClient().queries[0]
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(2)
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
  related_product_ids: [],
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
