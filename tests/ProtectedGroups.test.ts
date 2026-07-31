import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import { DEFAULT_STATE } from "../types/storage"
import { mockBrowser } from "./setup"

vi.mock("../utils/storage", () => ({
  saveAllStorage: vi.fn().mockResolvedValue(undefined),
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: {
    getValue: vi.fn().mockResolvedValue({})
  }
}))

import { tabGroupService } from "../services/TabGroupService"

/**
 * Tests for groups the user excluded from auto-grouping.
 *
 * The extension never infers which groups are the user's own — protection is
 * an explicit list of titles, so these tests are about the list being honored
 * on every path that could otherwise move a tab.
 */
describe("Protected groups", () => {
  const PROTECTED_GROUP_ID = 42

  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    tabGroupState.autoGroupingEnabled = true
    mockBrowser.tabGroups.query.mockResolvedValue([])
    mockBrowser.tabs.group.mockResolvedValue(100)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function protect(...titles: string[]): void {
    tabGroupState.updateFromStorage({ ...DEFAULT_STATE, protectedGroupTitles: titles })
    tabGroupState.autoGroupingEnabled = true
  }

  function tabInProtectedGroup(url = "https://example.com") {
    mockBrowser.tabGroups.get.mockResolvedValue({ id: PROTECTED_GROUP_ID, title: "Shopping" })
    mockBrowser.tabs.get.mockResolvedValue({
      id: 1,
      url,
      pinned: false,
      windowId: 1,
      groupId: PROTECTED_GROUP_ID
    })
    mockBrowser.tabs.query.mockResolvedValue([
      { id: 1, url, pinned: false, windowId: 1, groupId: PROTECTED_GROUP_ID }
    ])
  }

  describe("isProtectedTitle", () => {
    it("should be false when nothing is protected", () => {
      expect(tabGroupService.isProtectedTitle("Shopping")).toBe(false)
    })

    it("should match a protected title", () => {
      protect("Shopping")
      expect(tabGroupService.isProtectedTitle("Shopping")).toBe(true)
      expect(tabGroupService.isProtectedTitle("Reading")).toBe(false)
    })

    it("should ignore a sort-index prefix", () => {
      protect("Shopping")
      expect(tabGroupService.isProtectedTitle("3. Shopping")).toBe(true)
    })

    it("should handle an untitled group", () => {
      protect("Shopping")
      expect(tabGroupService.isProtectedTitle(undefined)).toBe(false)
    })
  })

  describe("handleTabUpdate", () => {
    it("should leave a tab in a protected group alone", async () => {
      protect("Shopping")
      tabInProtectedGroup()

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should leave it alone even when a custom rule matches", async () => {
      protect("Shopping")
      tabGroupState.updateFromStorage({
        ...DEFAULT_STATE,
        protectedGroupTitles: ["Shopping"],
        customRules: {
          "rule-1": {
            id: "rule-1",
            name: "Examples",
            domains: ["example.com"],
            color: "blue",
            enabled: true,
            priority: 1,
            createdAt: "2026-01-01T00:00:00.000Z"
          }
        }
      })
      tabGroupState.autoGroupingEnabled = true
      tabInProtectedGroup()

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })

    it("should leave it alone when grouping is forced", async () => {
      protect("Shopping")
      tabInProtectedGroup()

      const result = await tabGroupService.handleTabUpdate(1, true)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })

    it("should not ungroup it when the group is below the minimum size", async () => {
      protect("Shopping")
      tabGroupState.minimumTabsForGroup = 5
      tabInProtectedGroup()

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should still group tabs that are not in a protected group", async () => {
      protect("Shopping")
      mockBrowser.tabGroups.get.mockResolvedValue({ id: 7, title: "Something Else" })
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://example.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://example.com", pinned: false, windowId: 1, groupId: -1 }
      ])

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(true)
      expect(mockBrowser.tabs.group).toHaveBeenCalled()
    })

    it("should not query groups at all when nothing is protected", async () => {
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://example.com",
        pinned: false,
        windowId: 1,
        groupId: 9
      })
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://example.com", pinned: false, windowId: 1, groupId: 9 }
      ])

      await tabGroupService.handleTabUpdate(1)

      expect(mockBrowser.tabGroups.get).not.toHaveBeenCalled()
    })
  })

  describe("ungroupAllTabs", () => {
    it("should skip tabs in protected groups", async () => {
      protect("Shopping")
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: PROTECTED_GROUP_ID, title: "Shopping" },
        { id: 7, title: "Example" }
      ])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, groupId: PROTECTED_GROUP_ID },
        { id: 2, groupId: 7 }
      ])

      await tabGroupService.ungroupAllTabs()

      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([2])
    })

    it("should ungroup everything when nothing is protected", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 7, title: "Example" }])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, groupId: 7 },
        { id: 2, groupId: 7 }
      ])

      await tabGroupService.ungroupAllTabs()

      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([1, 2])
    })
  })
})
