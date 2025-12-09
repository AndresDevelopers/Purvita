import { describe, expect, it } from "vitest"

import {
  CreateUserProfileSchema,
  UpdateUserProfileSchema,
  UserProfileSchema,
} from "@/lib/models/definitions"

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
