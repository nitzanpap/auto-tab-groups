import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockBrowser } from "./setup"

vi.mock("../utils/storage", () => ({
  loadAllStorage: vi.fn().mockResolvedValue({}),
  saveAllStorage: vi.fn().mockResolvedValue(undefined),
  getGroupColor: vi.fn(),
  updateGroupColor: vi.fn(),
  groupColorMapping: { getValue: vi.fn().mockResolvedValue({}) }
}))

import { tabGroupState } from "../services/TabGroupState"
import { tabSortService } from "../services/TabSortService"
import { DEFAULT_STATE } from "../types/storage"

describe("TabSortService", () => {
  beforeEach(() => {
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    vi.clearAllMocks()
    mockBrowser.windows.getCurrent.mockResolvedValue({ id: 1 })
  })

  describe("sortGroups", () => {
    it("should sort groups alphabetically by title", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "GitHub", windowId: 1 },
        { id: 2, title: "Amazon", windowId: 1 },
        { id: 3, title: "Docs", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Should move in alphabetical order: Amazon, Docs, GitHub
      expect(mockBrowser.tabGroups.move).toHaveBeenCalledTimes(3)
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(1, 2, { index: -1 })
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(2, 3, { index: -1 })
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(3, 1, { index: -1 })
    })

    it("should be case-insensitive when sorting", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "zebra", windowId: 1 },
        { id: 2, title: "Apple", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Apple before zebra (case-insensitive)
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(1, 2, { index: -1 })
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(2, 1, { index: -1 })
    })

    it("should not sort when there is only one group", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Solo", windowId: 1 }])

      await tabSortService.sortGroups()

      expect(mockBrowser.tabGroups.move).not.toHaveBeenCalled()
    })

    it("should not sort when there are no groups", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      expect(mockBrowser.tabGroups.move).not.toHaveBeenCalled()
    })

    it("should move ungrouped non-pinned tabs to the end after sorting groups", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "A Group", windowId: 1 },
        { id: 2, title: "B Group", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 10, groupId: 1, pinned: false },
        { id: 11, groupId: -1, pinned: false },
        { id: 12, groupId: 2, pinned: false },
        { id: 13, groupId: -1, pinned: false },
        { id: 14, groupId: -1, pinned: true } // pinned — should NOT be moved
      ])

      await tabSortService.sortGroups()

      // After group moves, ungrouped non-pinned tabs (11, 13) should be moved to end
      expect(mockBrowser.tabs.move).toHaveBeenCalledWith(11, { index: -1 })
      expect(mockBrowser.tabs.move).toHaveBeenCalledWith(13, { index: -1 })
      // Pinned tab should NOT be moved
      expect(mockBrowser.tabs.move).not.toHaveBeenCalledWith(14, { index: -1 })
    })

    it("should not move ungrouped tabs that are pinned", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Group", windowId: 1 },
        { id: 2, title: "Another", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 10, groupId: -1, pinned: true },
        { id: 11, groupId: -1, pinned: true }
      ])

      await tabSortService.sortGroups()

      expect(mockBrowser.tabs.move).not.toHaveBeenCalled()
    })

    it("should handle groups with undefined titles", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: undefined, windowId: 1 },
        { id: 2, title: "Alpha", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Empty string sorts before "Alpha"
      expect(mockBrowser.tabGroups.move).toHaveBeenCalledTimes(2)
    })

    it("should handle errors gracefully without throwing", async () => {
      mockBrowser.tabGroups.query.mockRejectedValue(new Error("API error"))

      await expect(tabSortService.sortGroups()).resolves.toBeUndefined()
    })
  })

  describe("applySorting", () => {
    it("should call sortGroups when sortGroupsAlphabetically is enabled", async () => {
      tabGroupState.sortGroupsAlphabetically = true
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "B", windowId: 1 },
        { id: 2, title: "A", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.applySorting()

      expect(mockBrowser.tabGroups.move).toHaveBeenCalled()
    })

    it("should not call sortGroups when sortGroupsAlphabetically is disabled", async () => {
      tabGroupState.sortGroupsAlphabetically = false

      await tabSortService.applySorting()

      expect(mockBrowser.tabGroups.move).not.toHaveBeenCalled()
    })
  })

  describe("Firefox compatibility", () => {
    it("should not sort when browser.tabGroups.move is not available", async () => {
      const originalMove = mockBrowser.tabGroups.move
      delete (mockBrowser.tabGroups as Record<string, unknown>).move

      await tabSortService.sortGroups()

      expect(mockBrowser.tabGroups.query).not.toHaveBeenCalled()

      // Restore
      mockBrowser.tabGroups.move = originalMove
    })
  })
})
