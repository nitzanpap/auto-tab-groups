import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabDiscardService } from "../services/TabDiscardService"
import { tabGroupService } from "../services/TabGroupService"
import { mockBrowser } from "./setup"

describe("TabDiscardService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupService.endStartupGracePeriod()
  })

  afterEach(() => {
    tabDiscardService.stop()
    vi.clearAllMocks()
  })

  it("should discard tabs inactive for 1 minute or more", async () => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000
    mockBrowser.tabs.query.mockResolvedValue([
      {
        id: 1,
        active: false,
        discarded: false,
        pinned: false,
        audible: false,
        lastAccessed: twoMinutesAgo,
        url: "https://example.com"
      }
    ])

    const discarded = await tabDiscardService.checkAndDiscardInactiveTabs()
    expect(discarded).toBe(1)
    expect(mockBrowser.tabs.discard).toHaveBeenCalledWith(1)
  })

  it("should NOT discard tabs that are playing audio (audible = true)", async () => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000
    mockBrowser.tabs.query.mockResolvedValue([
      {
        id: 2,
        active: false,
        discarded: false,
        pinned: false,
        audible: true, // Playing music/audio
        lastAccessed: twoMinutesAgo,
        url: "https://youtube.com/watch?v=123"
      }
    ])

    const discarded = await tabDiscardService.checkAndDiscardInactiveTabs()
    expect(discarded).toBe(0)
    expect(mockBrowser.tabs.discard).not.toHaveBeenCalled()
  })

  it("should NOT discard active or pinned or already discarded tabs", async () => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000
    mockBrowser.tabs.query.mockResolvedValue([
      {
        id: 3,
        active: true, // Active tab
        discarded: false,
        pinned: false,
        audible: false,
        lastAccessed: twoMinutesAgo
      },
      {
        id: 4,
        active: false,
        discarded: false,
        pinned: true, // Pinned tab
        audible: false,
        lastAccessed: twoMinutesAgo
      },
      {
        id: 5,
        active: false,
        discarded: true, // Already discarded
        pinned: false,
        audible: false,
        lastAccessed: twoMinutesAgo
      }
    ])

    const discarded = await tabDiscardService.checkAndDiscardInactiveTabs()
    expect(discarded).toBe(0)
    expect(mockBrowser.tabs.discard).not.toHaveBeenCalled()
  })

  it("should NOT discard tabs when startup grace period is active", async () => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000
    mockBrowser.tabs.query.mockResolvedValue([
      {
        id: 6,
        active: false,
        discarded: false,
        pinned: false,
        audible: false,
        lastAccessed: twoMinutesAgo,
        url: "https://example.com"
      }
    ])

    tabGroupService.startStartupGracePeriod(3000)
    const discarded = await tabDiscardService.checkAndDiscardInactiveTabs()
    expect(discarded).toBe(0)
    expect(mockBrowser.tabs.discard).not.toHaveBeenCalled()

    tabGroupService.endStartupGracePeriod()
  })
})
