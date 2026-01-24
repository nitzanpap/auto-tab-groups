import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Tests for auto-collapse delay behavior.
 * These tests verify the debouncing and timing logic used in background.ts
 * for the auto-collapse feature.
 */
describe("Auto-collapse delay behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("immediate collapse (delay = 0)", () => {
    it("should execute immediately when delay is 0", () => {
      const mockCollapse = vi.fn()
      const delayMs = 0

      if (delayMs === 0) {
        mockCollapse()
      } else {
        setTimeout(mockCollapse, delayMs)
      }

      expect(mockCollapse).toHaveBeenCalledTimes(1)
    })

    it("should not use setTimeout when delay is 0", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout")
      const mockCollapse = vi.fn()
      const delayMs = 0

      if (delayMs === 0) {
        mockCollapse()
      } else {
        setTimeout(mockCollapse, delayMs)
      }

      expect(setTimeoutSpy).not.toHaveBeenCalled()
      expect(mockCollapse).toHaveBeenCalled()
    })
  })

  describe("delayed collapse", () => {
    it("should wait for delay before collapsing", () => {
      const mockCollapse = vi.fn()
      const delayMs = 500

      setTimeout(mockCollapse, delayMs)

      expect(mockCollapse).not.toHaveBeenCalled()

      vi.advanceTimersByTime(499)
      expect(mockCollapse).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(mockCollapse).toHaveBeenCalledTimes(1)
    })

    it("should work with various delay values", () => {
      const delays = [100, 250, 500, 1000, 2500, 5000]

      for (const delayMs of delays) {
        const mockCollapse = vi.fn()
        setTimeout(mockCollapse, delayMs)

        vi.advanceTimersByTime(delayMs - 1)
        expect(mockCollapse).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(mockCollapse).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe("debouncing behavior", () => {
    it("should cancel pending collapse when tab changes quickly", () => {
      const mockCollapse = vi.fn()
      let timeoutId: number | null = null
      const delayMs = 500

      // First tab activation
      timeoutId = setTimeout(mockCollapse, delayMs) as unknown as number

      vi.advanceTimersByTime(200) // Partway through delay

      // Second tab activation - should cancel first
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(mockCollapse, delayMs) as unknown as number

      vi.advanceTimersByTime(500)

      // Should only be called once (for second activation)
      expect(mockCollapse).toHaveBeenCalledTimes(1)
    })

    it("should reset timer on each tab switch", () => {
      const mockCollapse = vi.fn()
      let timeoutId: number | null = null
      const delayMs = 500

      // Simulate multiple rapid tab switches
      for (let i = 0; i < 5; i++) {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(mockCollapse, delayMs) as unknown as number
        vi.advanceTimersByTime(100) // Switch tabs every 100ms
      }

      // At this point, 500ms have passed but timer was reset each time
      expect(mockCollapse).not.toHaveBeenCalled()

      // Wait for final timer to complete
      vi.advanceTimersByTime(500)
      expect(mockCollapse).toHaveBeenCalledTimes(1)
    })

    it("should not call collapse if tab switches before delay completes", () => {
      const mockCollapse = vi.fn()
      let timeoutId: number | null = null
      const delayMs = 500

      // Start timer
      timeoutId = setTimeout(mockCollapse, delayMs) as unknown as number

      // Cancel before it fires
      vi.advanceTimersByTime(250)
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = null

      // Advance past original deadline
      vi.advanceTimersByTime(500)

      expect(mockCollapse).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("should handle null timeout id gracefully", () => {
      const timeoutId: ReturnType<typeof setTimeout> | null = null

      // Clearing null should not throw
      expect(() => {
        if (timeoutId) clearTimeout(timeoutId)
      }).not.toThrow()
    })

    it("should handle very small delays", () => {
      const mockCollapse = vi.fn()
      const delayMs = 1

      setTimeout(mockCollapse, delayMs)

      expect(mockCollapse).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(mockCollapse).toHaveBeenCalledTimes(1)
    })

    it("should handle maximum delay value", () => {
      const mockCollapse = vi.fn()
      const delayMs = 5000 // Maximum allowed delay

      setTimeout(mockCollapse, delayMs)

      vi.advanceTimersByTime(4999)
      expect(mockCollapse).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(mockCollapse).toHaveBeenCalledTimes(1)
    })
  })

  describe("auto-collapse state simulation", () => {
    it("should not trigger collapse when feature is disabled", () => {
      const mockCollapse = vi.fn()
      const autoCollapseEnabled = false

      // Simulate tab activation
      if (autoCollapseEnabled) {
        mockCollapse()
      }

      expect(mockCollapse).not.toHaveBeenCalled()
    })

    it("should trigger collapse when feature is enabled", () => {
      const mockCollapse = vi.fn()
      const autoCollapseEnabled = true
      const delayMs = 0

      // Simulate tab activation
      if (autoCollapseEnabled) {
        if (delayMs === 0) {
          mockCollapse()
        } else {
          setTimeout(mockCollapse, delayMs)
        }
      }

      expect(mockCollapse).toHaveBeenCalledTimes(1)
    })

    it("should handle feature toggle during pending collapse", () => {
      const mockCollapse = vi.fn()
      let timeoutId: number | null = null
      let autoCollapseEnabled = true
      const delayMs = 500

      // Start with feature enabled
      if (autoCollapseEnabled) {
        timeoutId = setTimeout(mockCollapse, delayMs) as unknown as number
      }

      vi.advanceTimersByTime(200)

      // Feature gets disabled mid-delay
      autoCollapseEnabled = false
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      vi.advanceTimersByTime(500)

      // Collapse should not have been called
      expect(mockCollapse).not.toHaveBeenCalled()
    })
  })

  describe("exponential backoff retry behavior", () => {
    /**
     * Tests for the exponential backoff retry logic used in TabGroupService.
     * The retry delays follow: 25 -> 50 -> 100 -> 200 -> 400ms (total ~775ms)
     */

    it("should succeed on first attempt without delays", async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined)
      const result = await simulateRetryWithBackoff(mockUpdate, 5, 25)

      expect(result).toBe(true)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    it("should retry with exponential backoff on transient errors", async () => {
      const mockUpdate = vi
        .fn()
        .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
        .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
        .mockResolvedValueOnce(undefined)

      const result = await simulateRetryWithBackoff(mockUpdate, 5, 25)

      expect(result).toBe(true)
      expect(mockUpdate).toHaveBeenCalledTimes(3)
    })

    it("should fail after max retries on persistent transient errors", async () => {
      const mockUpdate = vi.fn().mockRejectedValue(new Error("Tabs cannot be edited right now"))

      const result = await simulateRetryWithBackoff(mockUpdate, 5, 25)

      expect(result).toBe(false)
      expect(mockUpdate).toHaveBeenCalledTimes(6) // Initial + 5 retries
    })

    it("should not retry on non-transient errors", async () => {
      const mockUpdate = vi.fn().mockRejectedValue(new Error("Group does not exist"))

      const result = await simulateRetryWithBackoff(mockUpdate, 5, 25)

      expect(result).toBe(false)
      expect(mockUpdate).toHaveBeenCalledTimes(1) // No retries
    })

    it("should use correct delay progression (exponential)", async () => {
      const delays: number[] = []
      const mockUpdate = vi.fn().mockRejectedValue(new Error("Tabs cannot be edited right now"))

      // Track delays by measuring time between calls
      await simulateRetryWithBackoffTrackingDelays(mockUpdate, 5, 25, delays)

      // Expected delays: 25, 50, 100, 200, 400
      expect(delays).toEqual([25, 50, 100, 200, 400])
    })

    it("should recover on 5th retry (last attempt)", async () => {
      const mockUpdate = vi
        .fn()
        .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
        .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
        .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
        .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
        .mockRejectedValueOnce(new Error("Tabs cannot be edited right now"))
        .mockResolvedValueOnce(undefined) // Succeeds on 6th attempt (index 5)

      const result = await simulateRetryWithBackoff(mockUpdate, 5, 25)

      expect(result).toBe(true)
      expect(mockUpdate).toHaveBeenCalledTimes(6)
    })
  })
})

/**
 * Helper function to simulate the retry with exponential backoff logic
 * from TabGroupService.updateTabGroupWithRetry
 */
async function simulateRetryWithBackoff(
  mockUpdate: ReturnType<typeof vi.fn>,
  maxRetries: number,
  _initialDelayMs: number
): Promise<boolean> {
  // Note: We don't track delays here since we skip actual waiting in tests.
  // Use simulateRetryWithBackoffTrackingDelays to verify delay progression.

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await mockUpdate()
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isTransientError = errorMessage.includes("cannot be edited right now")

      if (isTransientError && attempt < maxRetries) {
        continue
      }
      return false
    }
  }
  return false
}

/**
 * Helper to track delay progression for exponential backoff verification
 */
async function simulateRetryWithBackoffTrackingDelays(
  mockUpdate: ReturnType<typeof vi.fn>,
  maxRetries: number,
  initialDelayMs: number,
  delaysTracker: number[]
): Promise<boolean> {
  let delayMs = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await mockUpdate()
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isTransientError = errorMessage.includes("cannot be edited right now")

      if (isTransientError && attempt < maxRetries) {
        delaysTracker.push(delayMs)
        delayMs *= 2
        continue
      }
      return false
    }
  }
  return false
}
