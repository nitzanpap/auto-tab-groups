import { afterEach, describe, expect, it, vi } from "vitest"
import { checkWebGpuCapability, isFirefoxBrowser } from "../utils/WebGpuUtils"

describe("WebGpuUtils", () => {
  const originalNavigator = globalThis.navigator

  function setNavigator(value: unknown): void {
    Object.defineProperty(globalThis, "navigator", {
      value,
      writable: true,
      configurable: true
    })
  }

  afterEach(() => {
    setNavigator(originalNavigator)
  })

  describe("checkWebGpuCapability", () => {
    it("should return available when GPU adapter is present", async () => {
      setNavigator({
        userAgent: "test",
        gpu: { requestAdapter: vi.fn().mockResolvedValue({ name: "mock-adapter" }) }
      })
      const result = await checkWebGpuCapability()
      expect(result.available).toBe(true)
      expect(result.reason).toBeNull()
    })

    it("should return unavailable when no GPU object", async () => {
      setNavigator({ userAgent: "test" })
      const result = await checkWebGpuCapability()
      expect(result.available).toBe(false)
      expect(result.reason).toContain("not supported")
    })

    it("should return unavailable when requestAdapter returns null", async () => {
      setNavigator({
        userAgent: "test",
        gpu: { requestAdapter: vi.fn().mockResolvedValue(null) }
      })
      const result = await checkWebGpuCapability()
      expect(result.available).toBe(false)
      expect(result.reason).toContain("No WebGPU adapter")
    })

    it("should handle errors gracefully", async () => {
      setNavigator({
        userAgent: "test",
        gpu: { requestAdapter: vi.fn().mockRejectedValue(new Error("GPU error")) }
      })
      const result = await checkWebGpuCapability()
      expect(result.available).toBe(false)
      expect(result.reason).toContain("Failed to detect")
    })
  })

  describe("isFirefoxBrowser", () => {
    it("should return true for Firefox user agent", () => {
      setNavigator({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
      })
      expect(isFirefoxBrowser()).toBe(true)
    })

    it("should return false for Chrome user agent", () => {
      setNavigator({
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"
      })
      expect(isFirefoxBrowser()).toBe(false)
    })
  })
})
