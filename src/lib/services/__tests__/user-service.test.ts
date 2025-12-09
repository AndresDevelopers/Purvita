import { beforeEach, describe, expect, it, vi } from "vitest"
import { generateReferralCode } from "@/lib/services/user-service"

const mocks = vi.hoisted(() => {
  const singleMock = vi.fn()
  const eqMock = vi.fn((column: string, value: string) => ({
    single: singleMock,
  }))
  const selectMock = vi.fn((columns: string) => ({
    eq: eqMock,
  }))
  const fromMock = vi.fn((table: string) => ({
    select: selectMock,
  }))

  return { singleMock, eqMock, selectMock, fromMock }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}))

const { singleMock, eqMock, selectMock, fromMock } = mocks

beforeEach(() => {
  singleMock.mockReset()
  eqMock.mockClear()
  selectMock.mockClear()
  fromMock.mockClear()
})

describe("generateReferralCode", () => {
  it("returns a sanitized base code when Supabase reports no collision", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    })

    const code = await generateReferralCode("Pūr Vita 2024")

    expect(code).toBe("prvita20")
    expect(fromMock).toHaveBeenCalledWith("profiles")
    expect(selectMock).toHaveBeenCalledWith("id")
    expect(eqMock).toHaveBeenCalledWith("referral_code", "prvita20")
  })

  it("appends a numeric suffix when the base code already exists", async () => {
    singleMock.mockResolvedValueOnce({
      data: { id: "existing-user" },
      error: null,
    })
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    })

    const code = await generateReferralCode("Team Alpha")

    expect(code).toBe("teamalph1")
    expect(eqMock).toHaveBeenNthCalledWith(1, "referral_code", "teamalph")
    expect(eqMock).toHaveBeenNthCalledWith(2, "referral_code", "teamalph1")
    expect(singleMock).toHaveBeenCalledTimes(2)
  })
})
