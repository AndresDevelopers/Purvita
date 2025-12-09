import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { getPublishedClassVideos } from "@/lib/services/class-video-service"
import type { MockSupabaseClient } from "@/modules/testing/mocks/mock-supabase-client"

let componentClient: MockSupabaseClient

const clients = vi.hoisted(() => ({
  component: undefined as MockSupabaseClient | undefined,
}))

vi.mock("@/lib/supabase", async () => {
  const mod = await import("@/modules/testing/mocks/mock-supabase-client")
  clients.component = new mod.MockSupabaseClient()
  return {
    supabase: clients.component,
    PRODUCTS_BUCKET: "products",
  }
})

describe("Integration: getPublishedClassVideos", () => {
  beforeEach(() => {
    getSupabase().reset()
  })

  it("parses Supabase payloads using the class video schema", async () => {
    getSupabase().queueResponse({
      data: [
        {
          id: "33a81b8c-a417-4b03-9a4e-8e1896efb5b1",
          title: "Mobility Essentials",
          description: "Warm up the body",
          youtube_id: "abc123",
          is_published: "1",
          order_index: "2",
          created_at: "2024-01-01 10:00:00",
        },
      ],
      error: null,
    }, "class_videos")

    const videos = await getPublishedClassVideos()

    expect(videos).toHaveLength(1)
    expect(videos[0]).toMatchObject({
      id: "33a81b8c-a417-4b03-9a4e-8e1896efb5b1",
      is_published: true,
      order_index: 2,
      created_at: "2024-01-01T10:00:00.000Z",
    })
    expect(getSupabase().from).toHaveBeenCalledWith("class_videos")
  })

  it("surfaces descriptive errors when Supabase reports a failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    getSupabase().queueResponse({
      data: null,
      error: { message: "Permission denied" },
    }, "class_videos")

    await expect(getPublishedClassVideos()).rejects.toThrow(
      "Error fetching class videos: Permission denied",
    )

    consoleSpy.mockRestore()
  })

  it("guards against invalid payloads that bypass schema validation", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    getSupabase().queueResponse({
      data: [
        {
          id: "broken",
          title: "",
          youtube_id: "",
          is_published: true,
          order_index: 1,
        },
      ],
      error: null,
    }, "class_videos")

    await expect(getPublishedClassVideos()).rejects.toThrow(
      "Invalid class video data received",
    )

    consoleSpy.mockRestore()
  })
})

function getSupabase(): MockSupabaseClient {
  if (!clients.component) {
    throw new Error("Component client not initialised")
  }
  return clients.component
}
