import { describe, expect, it } from "vitest"

import { ProductSchema } from "@/lib/models/definitions"

describe("ProductSchema", () => {
  it("normalizes boolean, numeric and date-like inputs", () => {
    const timestamp = Date.UTC(2024, 0, 2, 3, 4, 5)

    const product = ProductSchema.parse({
      id: "prod_1",
      slug: "sample-product",
      name: "Sample Product",
      description: "A product used for schema testing.",
      price: "19.99",
      images: null,
      is_featured: "yes",
      created_at: timestamp,
      updated_at: "2024-01-03 04:05:06",
    })

    expect(product.price).toBe(19.99)
    expect(product.images).toEqual([])
    expect(product.is_featured).toBe(true)
    expect(product.stock_quantity).toBe(0)
    expect(product.created_at).toBe(new Date(timestamp).toISOString())
    expect(product.updated_at).toBe(new Date("2024-01-03T04:05:06").toISOString())
  })

  it("converts invalid date inputs into null for optional fields", () => {
    const product = ProductSchema.parse({
      id: "prod_2",
      slug: "invalid-date",
      name: "Invalid Date Product",
      description: "Demonstrates graceful date normalization.",
      price: 10,
      images: [],
      created_at: "not-a-date",
    })

    expect(product.created_at).toBeNull()
    expect(product.updated_at).toBeUndefined()
    expect(product.stock_quantity).toBe(0)
  })

  it("rejects non-positive prices to maintain data integrity", () => {
    expect(() =>
      ProductSchema.parse({
        id: "prod_invalid",
        slug: "bad-price",
        name: "Invalid Product",
        description: "Should not be persisted.",
        price: -5,
        images: [],
      }),
    ).toThrowError()
  })
})
