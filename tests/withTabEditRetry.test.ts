import { describe, expect, it, vi } from "vitest"
import { withTabEditRetry } from "../utils/withTabEditRetry"

describe("withTabEditRetry", () => {
  it("should return the result on success", async () => {
    const operation = vi.fn().mockResolvedValue("result")
    const result = await withTabEditRetry(operation)
    expect(result).toBe("result")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("should retry on transient 'cannot be edited right now' errors", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
      .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
      .mockResolvedValue("success")

    const result = await withTabEditRetry(operation, 5, 1)
    expect(result).toBe("success")
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it("should throw immediately on non-transient errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Tab not found"))

    await expect(withTabEditRetry(operation, 5, 1)).rejects.toThrow("Tab not found")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("should throw after exhausting all retries", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Tabs cannot be edited right now"))

    await expect(withTabEditRetry(operation, 2, 1)).rejects.toThrow(
      "Tabs cannot be edited right now"
    )
    // 1 initial + 2 retries = 3
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it("should handle non-Error thrown values", async () => {
    const operation = vi.fn().mockRejectedValue("string error")

    await expect(withTabEditRetry(operation, 2, 1)).rejects.toBe("string error")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("should retry with transient error in string form", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce("Tabs cannot be edited right now")
      .mockResolvedValue("ok")

    // String errors still get stringified and matched
    const result = await withTabEditRetry(operation, 5, 1)
    expect(result).toBe("ok")
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
