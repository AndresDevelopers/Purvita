import { describe, expect, it } from "vitest"

import { ClassVideoSchema } from "@/lib/models/definitions"

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
