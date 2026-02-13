/**
 * Vitest setup file for mocking browser extension APIs
 */
import { vi } from "vitest"

// Mock the browser API globally
const mockBrowser = {
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({}),
    group: vi.fn().mockResolvedValue(1),
    ungroup: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue({}),
    move: vi.fn().mockResolvedValue({})
  },
  tabGroups: {
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({})
  },
  windows: {
    WINDOW_ID_CURRENT: -2
  },
  runtime: {
    id: "test-extension-id",
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn().mockResolvedValue({}),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    }
  }
}

// Assign to global
;(globalThis as unknown as { browser: typeof mockBrowser }).browser = mockBrowser

export { mockBrowser }
