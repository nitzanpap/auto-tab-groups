import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import { DEFAULT_STATE } from "../types/storage"
import { mockBrowser } from "./setup"

// Mock storage utilities before importing TabGroupService
vi.mock("../utils/storage", () => ({
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: {
    getValue: vi.fn().mockResolvedValue({})
  }
}))

// Import TabGroupService after mocking
import { tabGroupService } from "../services/TabGroupService"

describe("TabGroupService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("isNewTabUrl", () => {
    it("should return true for chrome://newtab/", () => {
      expect(tabGroupService.isNewTabUrl("chrome://newtab/")).toBe(true)
    })

    it("should return true for about:blank", () => {
      expect(tabGroupService.isNewTabUrl("about:blank")).toBe(true)
    })

    it("should return true for about:newtab", () => {
      expect(tabGroupService.isNewTabUrl("about:newtab")).toBe(true)
    })

    it("should return true for about:home", () => {
      expect(tabGroupService.isNewTabUrl("about:home")).toBe(true)
    })

    it("should return true for chrome-extension:// URLs", () => {
      expect(tabGroupService.isNewTabUrl("chrome-extension://abcd1234/newtab.html")).toBe(true)
    })

    it("should return true for moz-extension:// URLs", () => {
      expect(tabGroupService.isNewTabUrl("moz-extension://abcd1234/newtab.html")).toBe(true)
    })

    it("should return true for edge://newtab/", () => {
      expect(tabGroupService.isNewTabUrl("edge://newtab/")).toBe(true)
    })

    it("should return false for regular URLs", () => {
      expect(tabGroupService.isNewTabUrl("https://example.com")).toBe(false)
    })

    it("should return false for empty string", () => {
      expect(tabGroupService.isNewTabUrl("")).toBe(false)
    })

    it("should return false for undefined", () => {
      expect(tabGroupService.isNewTabUrl(undefined as unknown as string)).toBe(false)
    })

    it("should return false for null", () => {
      expect(tabGroupService.isNewTabUrl(null as unknown as string)).toBe(false)
    })
  })

  describe("getEffectiveMinimumTabs", () => {
    it("should return global minimum when no custom rule", () => {
      tabGroupState.minimumTabsForGroup = 3
      expect(tabGroupService.getEffectiveMinimumTabs(null)).toBe(3)
    })

    it("should return rule minimum when custom rule has minimumTabs", () => {
      tabGroupState.minimumTabsForGroup = 3
      const customRule = {
        id: "rule-1",
        name: "Test Rule",
        domains: ["example.com"],
        color: "blue" as const,
        enabled: true,
        priority: 1,
        minimumTabs: 5,
        createdAt: new Date().toISOString()
      }
      expect(tabGroupService.getEffectiveMinimumTabs(customRule)).toBe(5)
    })

    it("should return global minimum when custom rule has undefined minimumTabs", () => {
      tabGroupState.minimumTabsForGroup = 3
      const customRule = {
        id: "rule-1",
        name: "Test Rule",
        domains: ["example.com"],
        color: "blue" as const,
        enabled: true,
        priority: 1,
        createdAt: new Date().toISOString()
      }
      expect(tabGroupService.getEffectiveMinimumTabs(customRule)).toBe(3)
    })

    it("should return 1 when global minimum is not set", () => {
      tabGroupState.minimumTabsForGroup = 0
      expect(tabGroupService.getEffectiveMinimumTabs(null)).toBe(1)
    })
  })

  describe("checkGroupThreshold", () => {
    it("should return false when tabGroups API is not available", async () => {
      const originalTabGroups = mockBrowser.tabGroups
      // @ts-expect-error - intentionally setting to undefined for testing
      mockBrowser.tabGroups = undefined
      const result = await tabGroupService.checkGroupThreshold(1)
      expect(result).toBe(false)
      mockBrowser.tabGroups = originalTabGroups
    })

    it("should return false when group is not found", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([])
      const result = await tabGroupService.checkGroupThreshold(999)
      expect(result).toBe(false)
    })

    it("should return false when minimum is 1 or less", async () => {
      tabGroupState.minimumTabsForGroup = 1
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Test" }])
      const result = await tabGroupService.checkGroupThreshold(1)
      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should ungroup tabs when group is below threshold", async () => {
      tabGroupState.minimumTabsForGroup = 3
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Test" }])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 101, groupId: 1, pinned: false },
        { id: 102, groupId: 1, pinned: false }
      ])

      const result = await tabGroupService.checkGroupThreshold(1)
      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([101, 102])
    })

    it("should not ungroup tabs when group meets threshold", async () => {
      tabGroupState.minimumTabsForGroup = 2
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Test" }])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 101, groupId: 1, pinned: false },
        { id: 102, groupId: 1, pinned: false },
        { id: 103, groupId: 1, pinned: false }
      ])

      const result = await tabGroupService.checkGroupThreshold(1)
      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should exclude pinned tabs from count", async () => {
      tabGroupState.minimumTabsForGroup = 3
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Test" }])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 101, groupId: 1, pinned: false },
        { id: 102, groupId: 1, pinned: false },
        { id: 103, groupId: 1, pinned: true }
      ])

      const result = await tabGroupService.checkGroupThreshold(1)
      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([101, 102, 103])
    })
  })

  describe("checkAllGroupsThreshold", () => {
    it("should check threshold for all groups", async () => {
      tabGroupState.minimumTabsForGroup = 3
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Group1" },
        { id: 2, title: "Group2" }
      ])
      mockBrowser.tabs.query.mockResolvedValue([{ id: 101, groupId: 1, pinned: false }])

      await tabGroupService.checkAllGroupsThreshold()

      expect(mockBrowser.tabGroups.query).toHaveBeenCalledWith({
        windowId: mockBrowser.windows.WINDOW_ID_CURRENT
      })
    })
  })

  describe("ungroupSystemTabs", () => {
    it("should return true when no System group exists", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Other" }])

      const result = await tabGroupService.ungroupSystemTabs()
      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should ungroup all tabs from System group", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "System" },
        { id: 2, title: "Other" }
      ])
      mockBrowser.tabs.query.mockResolvedValue([{ id: 101 }, { id: 102 }, { id: 103 }])

      const result = await tabGroupService.ungroupSystemTabs()
      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([101, 102, 103])
    })

    it("should handle empty System group", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "System" }])
      mockBrowser.tabs.query.mockResolvedValue([])

      const result = await tabGroupService.ungroupSystemTabs()
      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })
  })

  describe("groupAllTabs", () => {
    beforeEach(() => {
      tabGroupState.autoGroupingEnabled = true
      tabGroupState.groupNewTabs = true
    })

    it("should return false when auto-grouping is disabled", async () => {
      tabGroupState.autoGroupingEnabled = false
      const result = await tabGroupService.groupAllTabs()
      expect(result).toBe(false)
    })

    it("should skip chrome-extension:// URLs", async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "chrome-extension://abcd/popup.html" }
      ])

      await tabGroupService.groupAllTabs()
      expect(mockBrowser.tabs.get).not.toHaveBeenCalled()
    })

    it("should group empty URL tabs into System when groupNewTabs is enabled", async () => {
      tabGroupState.groupNewTabs = true
      const tabData = { id: 1, url: "", groupId: -1, pinned: false, windowId: 1 }
      mockBrowser.tabs.query.mockResolvedValue([tabData])
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.group.mockResolvedValue(100)
      mockBrowser.tabGroups.update.mockResolvedValue({})

      await tabGroupService.groupAllTabs()

      expect(mockBrowser.tabs.group).toHaveBeenCalledWith({ tabIds: [1] })
    })

    it("should skip empty URL tabs when groupNewTabs is disabled", async () => {
      tabGroupState.groupNewTabs = false
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "", groupId: -1, pinned: false, windowId: 1 }
      ])

      await tabGroupService.groupAllTabs()

      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })

    it("should handle undefined URL tabs as potential new tabs", async () => {
      tabGroupState.groupNewTabs = true
      const tabData = { id: 1, url: undefined, groupId: -1, pinned: false, windowId: 1 }
      mockBrowser.tabs.query.mockResolvedValue([tabData])
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.group.mockResolvedValue(100)
      mockBrowser.tabGroups.update.mockResolvedValue({})

      await tabGroupService.groupAllTabs()

      expect(mockBrowser.tabs.group).toHaveBeenCalledWith({ tabIds: [1] })
    })
  })

  describe("groupAllTabsManually", () => {
    beforeEach(() => {
      tabGroupState.groupNewTabs = true
    })

    it("should skip chrome-extension:// URLs", async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "chrome-extension://abcd/popup.html" }
      ])

      await tabGroupService.groupAllTabsManually()
      expect(mockBrowser.tabs.get).not.toHaveBeenCalled()
    })

    it("should group empty URL tabs into System when groupNewTabs is enabled", async () => {
      tabGroupState.groupNewTabs = true
      const tabData = { id: 1, url: "", groupId: -1, pinned: false, windowId: 1 }
      mockBrowser.tabs.query.mockResolvedValue([tabData])
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.group.mockResolvedValue(100)
      mockBrowser.tabGroups.update.mockResolvedValue({})

      await tabGroupService.groupAllTabsManually()

      expect(mockBrowser.tabs.group).toHaveBeenCalledWith({ tabIds: [1] })
    })

    it("should skip empty URL tabs when groupNewTabs is disabled", async () => {
      tabGroupState.groupNewTabs = false
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "", groupId: -1, pinned: false, windowId: 1 }
      ])

      await tabGroupService.groupAllTabsManually()

      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })

    it("should skip new tab URLs when groupNewTabs is disabled", async () => {
      tabGroupState.groupNewTabs = false
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "chrome://newtab/", groupId: -1, pinned: false }
      ])

      await tabGroupService.groupAllTabsManually()

      expect(mockBrowser.tabs.get).not.toHaveBeenCalled()
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })

    it("should group new tab URLs when groupNewTabs is enabled", async () => {
      tabGroupState.groupNewTabs = true
      tabGroupState.autoGroupingEnabled = true
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "chrome://newtab/", groupId: -1, pinned: false }
      ])
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "chrome://newtab/",
        groupId: -1,
        pinned: false,
        windowId: 1
      })
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.group.mockResolvedValue(100)
      mockBrowser.tabGroups.update.mockResolvedValue({})

      await tabGroupService.groupAllTabsManually()

      expect(mockBrowser.tabs.get).toHaveBeenCalledWith(1)
    })

    it("should respect groupNewTabs setting for about:blank", async () => {
      tabGroupState.groupNewTabs = false
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "about:blank", groupId: -1, pinned: false }
      ])

      await tabGroupService.groupAllTabsManually()

      expect(mockBrowser.tabs.get).not.toHaveBeenCalled()
    })
  })

  describe("findGroupByTitle", () => {
    it("should return group when found by title", async () => {
      const group = { id: 1, title: "Test", windowId: 1 }
      mockBrowser.tabGroups.query.mockResolvedValue([group])

      const result = await tabGroupService.findGroupByTitle("Test", 1)
      expect(result).toEqual(group)
    })

    it("should return null when group not found", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Other", windowId: 1 }])

      const result = await tabGroupService.findGroupByTitle("Test", 1)
      expect(result).toBe(null)
    })
  })

  describe("ungroupAllTabs", () => {
    it("should ungroup all grouped tabs", async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, groupId: 100 },
        { id: 2, groupId: 100 },
        { id: 3, groupId: -1 }
      ])

      const result = await tabGroupService.ungroupAllTabs()
      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([1, 2])
    })

    it("should handle no grouped tabs", async () => {
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, groupId: -1 },
        { id: 2, groupId: -1 }
      ])

      const result = await tabGroupService.ungroupAllTabs()
      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })
  })
})
