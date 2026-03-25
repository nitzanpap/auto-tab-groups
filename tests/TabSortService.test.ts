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
import { stripIndexPrefix, tabSortService } from "../services/TabSortService"
import { DEFAULT_STATE } from "../types/storage"

describe("TabSortService", () => {
  beforeEach(() => {
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    vi.clearAllMocks()
    mockBrowser.windows.getCurrent.mockResolvedValue({ id: 1 })
  })

  describe("stripIndexPrefix", () => {
    it("should strip a single-digit prefix", () => {
      expect(stripIndexPrefix("1. GitHub")).toBe("GitHub")
    })

    it("should strip a multi-digit prefix", () => {
      expect(stripIndexPrefix("10. Long Name")).toBe("Long Name")
    })

    it("should return unchanged title when no prefix exists", () => {
      expect(stripIndexPrefix("GitHub")).toBe("GitHub")
    })

    it("should return empty string unchanged", () => {
      expect(stripIndexPrefix("")).toBe("")
    })

    it("should not strip partial patterns like '1.GitHub' (no space)", () => {
      expect(stripIndexPrefix("1.GitHub")).toBe("1.GitHub")
    })

    it("should not strip non-numeric prefixes", () => {
      expect(stripIndexPrefix("a. Something")).toBe("a. Something")
    })
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

    it("should sort by stripped title when groups already have index prefixes", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "2. GitHub", windowId: 1 },
        { id: 2, title: "1. Amazon", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Should sort by stripped title: Amazon before GitHub
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(1, 2, { index: -1 })
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(2, 1, { index: -1 })
    })

    it("should not move when there is only one group", async () => {
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
        { id: 2, title: "Alpha", windowId: 1 },
        { id: 1, title: undefined, windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Empty string sorts before "Alpha", so order should be [1, 2]
      // Current is [2, 1] — needs to move both from mismatch at index 0
      expect(mockBrowser.tabGroups.move).toHaveBeenCalledTimes(2)
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(1, 1, { index: -1 })
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(2, 2, { index: -1 })
    })

    it("should skip moves when groups are already in correct order", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 2, title: "Amazon", windowId: 1 },
        { id: 3, title: "Docs", windowId: 1 },
        { id: 1, title: "GitHub", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Already in alphabetical order — no moves needed
      expect(mockBrowser.tabGroups.move).not.toHaveBeenCalled()
    })

    it("should only move groups from the first mismatch onward", async () => {
      // Current: Amazon(2), GitHub(1), Docs(3)
      // Desired: Amazon(2), Docs(3), GitHub(1)
      // First mismatch at index 1: only move Docs and GitHub
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 2, title: "Amazon", windowId: 1 },
        { id: 1, title: "GitHub", windowId: 1 },
        { id: 3, title: "Docs", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      expect(mockBrowser.tabGroups.move).toHaveBeenCalledTimes(2)
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(1, 3, { index: -1 })
      expect(mockBrowser.tabGroups.move).toHaveBeenNthCalledWith(2, 1, { index: -1 })
    })

    it("should handle errors gracefully without throwing", async () => {
      mockBrowser.tabGroups.query.mockRejectedValue(new Error("API error"))

      await expect(tabSortService.sortGroups()).resolves.toBeUndefined()
    })
  })

  describe("sortGroups with indexing", () => {
    it("should apply index prefixes after sorting when indexGroupTitles is enabled", async () => {
      tabGroupState.indexGroupTitles = true
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "GitHub", windowId: 1 },
        { id: 2, title: "Amazon", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Should update titles with index prefixes in alphabetical order
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(2, { title: "1. Amazon" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(1, { title: "2. GitHub" })
    })

    it("should not apply index prefixes when indexGroupTitles is disabled", async () => {
      tabGroupState.indexGroupTitles = false
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "GitHub", windowId: 1 },
        { id: 2, title: "Amazon", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalled()
    })

    it("should apply index prefix to single group when indexGroupTitles is enabled", async () => {
      tabGroupState.indexGroupTitles = true
      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Solo", windowId: 1 }])

      await tabSortService.sortGroups()

      // Single group should still get prefix, but no move
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(1, { title: "1. Solo" })
      expect(mockBrowser.tabGroups.move).not.toHaveBeenCalled()
    })

    it("should correctly re-index when a new group is added among already-indexed groups", async () => {
      tabGroupState.indexGroupTitles = true
      // Simulate: existing groups are already indexed, a new "Extensions" group was just created
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "1. AI", windowId: 1 },
        { id: 2, title: "2. Comms", windowId: 1 },
        { id: 3, title: "3. Github", windowId: 1 },
        { id: 4, title: "4. System", windowId: 1 },
        { id: 5, title: "Extensions", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Sorted alphabetically: AI(1), Comms(2), Extensions(3), Github(4), System(5)
      // "1. AI" and "2. Comms" are already correct, so no update needed for those
      // Extensions gets "3.", Github shifts from "3." to "4.", System from "4." to "5."
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(5, { title: "3. Extensions" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(3, { title: "4. Github" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(4, { title: "5. System" })
      // AI and Comms already have correct prefixes — should NOT be updated
      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalledWith(1, expect.anything())
      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalledWith(2, expect.anything())
    })

    it("should strip old prefixes before re-indexing", async () => {
      tabGroupState.indexGroupTitles = true
      // Groups with stale/wrong indices
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "3. AI", windowId: 1 },
        { id: 2, title: "1. Comms", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Should assign correct indices based on alphabetical order
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(1, { title: "1. AI" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(2, { title: "2. Comms" })
    })

    it("should skip title update when title already has correct prefix", async () => {
      tabGroupState.indexGroupTitles = true
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "1. AI", windowId: 1 },
        { id: 2, title: "2. Comms", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Titles already correct — no update calls needed
      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalled()
    })

    it("should correctly index groups with the same starting letter", async () => {
      tabGroupState.indexGroupTitles = true
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Assets", windowId: 1 },
        { id: 2, title: "AI", windowId: 1 },
        { id: 3, title: "Amazon", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // Alphabetical: AI, Amazon, Assets
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(2, { title: "1. AI" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(3, { title: "2. Amazon" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(1, { title: "3. Assets" })
    })

    it("should update titles before moving groups", async () => {
      tabGroupState.indexGroupTitles = true
      const callOrder: string[] = []
      mockBrowser.tabGroups.update.mockImplementation(() => {
        callOrder.push("update")
        return Promise.resolve({})
      })
      mockBrowser.tabGroups.move.mockImplementation(() => {
        callOrder.push("move")
        return Promise.resolve(undefined)
      })
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "B", windowId: 1 },
        { id: 2, title: "A", windowId: 1 }
      ])
      mockBrowser.tabs.query.mockResolvedValue([])

      await tabSortService.sortGroups()

      // All updates should come before all moves
      const firstMove = callOrder.indexOf("move")
      const lastUpdate = callOrder.lastIndexOf("update")
      expect(lastUpdate).toBeLessThan(firstMove)
    })
  })

  describe("stripAllIndexPrefixes", () => {
    it("should remove prefixes from all groups", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "1. AI", windowId: 1 },
        { id: 2, title: "2. Communications", windowId: 1 }
      ])

      await tabSortService.stripAllIndexPrefixes()

      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(1, { title: "AI" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(2, {
        title: "Communications"
      })
    })

    it("should skip groups that have no prefix", async () => {
      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "AI", windowId: 1 },
        { id: 2, title: "3. Communications", windowId: 1 }
      ])

      await tabSortService.stripAllIndexPrefixes()

      expect(mockBrowser.tabGroups.update).toHaveBeenCalledTimes(1)
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(2, {
        title: "Communications"
      })
    })

    it("should handle errors gracefully", async () => {
      mockBrowser.tabGroups.query.mockRejectedValue(new Error("API error"))

      await expect(tabSortService.stripAllIndexPrefixes()).resolves.toBeUndefined()
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
