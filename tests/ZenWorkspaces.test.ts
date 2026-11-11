import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import { DEFAULT_STATE } from "../types/storage"
import { resetZenDetection } from "../utils/ZenWorkspaces"
import { mockBrowser } from "./setup"

vi.mock("../utils/storage", () => ({
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: { getValue: vi.fn().mockResolvedValue({}) }
}))

import { tabGroupService } from "../services/TabGroupService"

type MockRuntime = typeof mockBrowser.runtime & { getBrowserInfo?: () => Promise<{ name: string }> }
const runtime = mockBrowser.runtime as MockRuntime

/**
 * Zen in space B: tabs.query sees only space B's tabs, tabGroups.query
 * returns the groups of both spaces.
 */
const spaceAGroups = [
  { id: 10, title: "System", windowId: 1, collapsed: false },
  { id: 11, title: "Facebook", windowId: 1, collapsed: false }
]
const spaceBGroups = [{ id: 20, title: "Youtube", windowId: 1, collapsed: false }]
const spaceBTabs = [
  { id: 1, url: "https://www.youtube.com/watch?v=x", groupId: 20, windowId: 1, active: true },
  { id: 2, url: "https://www.facebook.com/", groupId: -1, windowId: 1, active: false }
]

describe("Zen workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetZenDetection()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    tabGroupState.autoGroupingEnabled = true
    mockBrowser.tabGroups.query.mockResolvedValue([...spaceAGroups, ...spaceBGroups])
    mockBrowser.tabs.query.mockResolvedValue(spaceBTabs)
  })

  afterEach(() => {
    delete runtime.getBrowserInfo
    resetZenDetection()
  })

  describe("in Zen", () => {
    beforeEach(() => {
      runtime.getBrowserInfo = vi.fn().mockResolvedValue({ name: "Zen" })
    })

    it("does not find a group that lives in another space", async () => {
      expect(await tabGroupService.findGroupByTitle("Facebook", 1)).toBe(null)
      expect(await tabGroupService.findGroupByTitle("Youtube", 1)).toEqual(spaceBGroups[0])
    })

    it("creates a group in the current space instead of moving the tab to another space", async () => {
      mockBrowser.tabs.get.mockResolvedValue(spaceBTabs[1])
      mockBrowser.tabs.group.mockResolvedValue(30)

      await tabGroupService.handleTabUpdate(2)

      expect(mockBrowser.tabs.group).not.toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 11 })
      )
      expect(mockBrowser.tabs.group).toHaveBeenCalledWith({ tabIds: [2] })
    })

    it("leaves a tab from another space alone", async () => {
      mockBrowser.tabs.get.mockResolvedValue({
        id: 99,
        url: "https://www.facebook.com/",
        groupId: -1,
        windowId: 1
      })

      expect(await tabGroupService.handleTabUpdate(99)).toBe(false)
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })

    it("only collapses groups in the current space", async () => {
      mockBrowser.tabs.get.mockResolvedValue(spaceBTabs[0])
      mockBrowser.tabGroups.query.mockResolvedValue([
        ...spaceAGroups,
        ...spaceBGroups,
        { id: 21, title: "Github", windowId: 1, collapsed: false }
      ])
      mockBrowser.tabs.query.mockImplementation(async (q: { active?: boolean }) =>
        q.active ? [spaceBTabs[0]] : [...spaceBTabs, { id: 3, groupId: 21, windowId: 1 }]
      )

      await tabGroupService.collapseOtherGroups(1)

      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(21, { collapsed: true })
      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalledWith(10, expect.anything())
      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalledWith(11, expect.anything())
    })
  })

  describe("outside Zen", () => {
    it("keeps every group of the window", async () => {
      runtime.getBrowserInfo = vi.fn().mockResolvedValue({ name: "Firefox" })
      expect(await tabGroupService.findGroupByTitle("Facebook", 1)).toEqual(spaceAGroups[1])
    })

    it("works without runtime.getBrowserInfo (Chrome)", async () => {
      expect(await tabGroupService.findGroupByTitle("Facebook", 1)).toEqual(spaceAGroups[1])
    })
  })
})
