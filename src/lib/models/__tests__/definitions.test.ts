import { describe, expect, it } from "vitest"
import {
  ClassVideoSchema,
  CreateUserProfileSchema,
  ProductSchema,
  UpdateUserProfileSchema,
  UserProfileSchema,
} from "@/lib/models/definitions"

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
    expect(product.cart_visibility_countries).toEqual([])
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

  it("normalizes and deduplicates cart visibility countries", () => {
    const product = ProductSchema.parse({
      id: "prod_countries",
      slug: "country-product",
      name: "Country Product",
      description: "Demonstrates country normalization.",
      price: 25,
      images: [],
      cart_visibility_countries: [" us ", "ca", "US", null, "mex", "BR"],
    })

    expect(product.cart_visibility_countries).toEqual(["US", "CA", "BR"])
  })
})

describe("UserProfileSchema", () => {
  it("applies defaults while coercing boolean-like inputs", () => {
    const profile = UserProfileSchema.parse({
      id: "a2a2e3d0-6725-42d7-8afd-509e96e9e5ad",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "admin",
      status: "inactive",
      pay: "1",
      commission_rate: 0.25,
      total_earnings: 1250,
      created_at: "2024-02-10T12:00:00.000Z",
      updated_at: "2024-02-11T12:00:00.000Z",
    })

    expect(profile.pay).toBe(true)
    expect(profile.role).toBe("admin")
    expect(profile.status).toBe("inactive")
    expect(profile.commission_rate).toBe(0.25)
    expect(profile.total_earnings).toBe(1250)
  })

  it("transforms falsy pay representations to boolean false", () => {
    const profile = UserProfileSchema.parse({
      id: "5f5c5bcb-4fa0-4631-b5f0-4fe75f1f0ccc",
      name: "John Doe",
      email: "john@example.com",
      created_at: "2024-02-10T12:00:00.000Z",
      updated_at: "2024-02-11T12:00:00.000Z",
      pay: "0",
    })

    expect(profile.pay).toBe(false)
    expect(profile.role).toBe("member")
    expect(profile.status).toBe("active")
    expect(profile.commission_rate).toBeCloseTo(0.1)
    expect(profile.total_earnings).toBe(0)
  })

  it("supports creating new profiles with sanitized optional fields", () => {
    const newProfile = CreateUserProfileSchema.parse({
      name: "New Member",
      email: "new@example.com",
      referral_code: undefined,
      pay: null,
    })

    expect(newProfile.pay).toBe(false)
    expect(newProfile.role).toBe("member")
    expect(newProfile.status).toBe("active")
    expect(newProfile.commission_rate).toBeCloseTo(0.1)
    expect(newProfile.total_earnings).toBe(0)
  })

  it("validates commission rate boundaries through partial updates", () => {
    expect(() =>
      UpdateUserProfileSchema.parse({
        commission_rate: 1.5,
      }),
    ).toThrowError()

    const update = UpdateUserProfileSchema.parse({
      commission_rate: 0.35,
    })

    expect(update.commission_rate).toBe(0.35)
  })
})

describe("ClassVideoSchema", () => {
  it("uses safe defaults and coercion for publication metadata", () => {
    const video = ClassVideoSchema.parse({
      id: "33a81b8c-a417-4b03-9a4e-8e1896efb5b1",
      title: "Warmup Routine",
      description: "Gentle mobility session.",
      youtube_id: "abc123",
      order_index: "5",
      created_at: "2024-03-01T10:00:00Z",
    })

    expect(video.is_published).toBe(true)
    expect(video.order_index).toBe(5)
  })

  it("interprets numeric and string flags consistently", () => {
    const unpublished = ClassVideoSchema.parse({
      id: "f013a2f5-8fd6-4ce6-aa38-64106810fd08",
      title: "Cooldown",
      description: "Relaxing stretch.",
      youtube_id: "xyz789",
      is_published: "0",
      order_index: 2,
      created_at: "2024-03-01T10:00:00Z",
      updated_at: "invalid",
    })

    expect(unpublished.is_published).toBe(false)
    expect(unpublished.updated_at).toBeNull()
  })

  it("recognizes truthy signals from localized strings and numbers", () => {
    const fromString = ClassVideoSchema.parse({
      id: "719cde55-78c4-4f61-a6e3-95004c7f6e92",
      title: "Breathing Techniques",
      description: "Mindful breathing guidance.",
      youtube_id: "breath123",
      is_published: " YES ",
      order_index: 0,
      created_at: new Date("2024-03-02T10:00:00Z"),
    })

    expect(fromString.is_published).toBe(true)
    expect(fromString.created_at).toBe("2024-03-02T10:00:00.000Z")

    const fromNumber = ClassVideoSchema.parse({
      id: "c6f10c1d-779f-49a8-86d9-2a444d2421d4",
      title: "Strength Basics",
      description: "Entry level strength session.",
      youtube_id: "strength321",
      is_published: 1,
      order_index: 1,
      created_at: "2024-03-03T10:00:00Z",
      updated_at: 0,
    })

    expect(fromNumber.is_published).toBe(true)
    expect(fromNumber.updated_at).toBe("1970-01-01T00:00:00.000Z")
  })
})
