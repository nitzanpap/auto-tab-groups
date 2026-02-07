/**
 * WebGPU capability detection utilities
 */

import type { WebGpuCapability } from "../types"

/**
 * Check if WebGPU is available in the current environment
 */
export async function checkWebGpuCapability(): Promise<WebGpuCapability> {
  try {
    if (typeof navigator === "undefined") {
      return { available: false, reason: "Navigator API not available" }
    }

    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu

    if (!gpu) {
      return { available: false, reason: "WebGPU is not supported in this browser" }
    }

    const adapter = await gpu.requestAdapter()
    if (!adapter) {
      return { available: false, reason: "No WebGPU adapter found" }
    }

    return { available: true, reason: null }
  } catch {
    return { available: false, reason: "Failed to detect WebGPU support" }
  }
}

/**
 * Check if the current browser is Firefox
 */
export function isFirefoxBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  return navigator.userAgent.includes("Firefox")
}
