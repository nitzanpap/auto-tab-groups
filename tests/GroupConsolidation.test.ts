import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import { DEFAULT_STATE } from "../types/storage"
import { mockBrowser } from "./setup"

vi.mock("../utils/storage", () => ({
  saveAllStorage: vi.fn().mockResolvedValue(undefined),
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: { getValue: vi.fn().mockResolvedValue({}) }
}))

import { tabGroupService } from "../services/TabGroupService"

/**
 * Merging groups that are split across windows.
 *
 * The operation cannot be undone, so the plan it produces is what the UI shows
 * before asking — these tests are mostly about the plan being right.
 */
describe("Group consolidation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /** groups: [id, title, windowId]; tabs: [id, groupId, pinned?] */
  function setup(groups: [number, string, number][], tabs: [number, number, boolean?][]): void {
    mockBrowser.tabGroups.query.mockImplementation((query: { windowId?: number } = {}) =>
      Promise.resolve(
        groups
          .filter(([, , windowId]) => query.windowId === undefined || query.windowId === windowId)
          .map(([id, title, windowId]) => ({ id, title, windowId }))
      )
    )
    mockBrowser.tabs.query.mockResolvedValue(
      tabs.map(([id, groupId, pinned]) => ({ id, groupId, pinned: pinned ?? false }))
    )
  }

  describe("planGroupConsolidation", () => {
    it("should send a split group to the window holding most of it", async () => {
      setup(
        [
          [1, "Wikipedia", 10],
          [2, "Wikipedia", 20]
        ],
        [
          [101, 1],
          [102, 1],
          [103, 1],
          [104, 2]
        ]
      )

      const moves = await tabGroupService.planGroupConsolidation()

      expect(moves).toEqual([
        { title: "Wikipedia", fromWindowId: 20, toWindowId: 10, tabIds: [104] }
      ])
    })

    it("should leave a group that lives in one window alone", async () => {
      setup(
        [[1, "Docs", 10]],
        [
          [101, 1],
          [102, 1]
        ]
      )

      expect(await tabGroupService.planGroupConsolidation()).toEqual([])
    })

    it("should gather a group split across three windows", async () => {
      setup(
        [
          [1, "Wikipedia", 10],
          [2, "Wikipedia", 20],
          [3, "Wikipedia", 30]
        ],
        [
          [101, 1],
          [102, 1],
          [103, 2],
          [104, 3]
        ]
      )

      const moves = await tabGroupService.planGroupConsolidation()

      expect(moves).toHaveLength(2)
      expect(moves.every(move => move.toWindowId === 10)).toBe(true)
    })

    it("should break a size tie deterministically", async () => {
      setup(
        [
          [7, "Wikipedia", 10],
          [3, "Wikipedia", 20]
        ],
        [
          [101, 7],
          [102, 3]
        ]
      )

      // Lowest group id wins, so the plan doesn't flip between runs
      const moves = await tabGroupService.planGroupConsolidation()
      expect(moves[0].toWindowId).toBe(20)
    })

    it("should skip protected groups", async () => {
      tabGroupState.updateFromStorage({ ...DEFAULT_STATE, protectedGroupTitles: ["Wikipedia"] })
      setup(
        [
          [1, "Wikipedia", 10],
          [2, "Wikipedia", 20]
        ],
        [
          [101, 1],
          [102, 2]
        ]
      )

      expect(await tabGroupService.planGroupConsolidation()).toEqual([])
    })

    it("should skip the System group", async () => {
      setup(
        [
          [1, "System", 10],
          [2, "System", 20]
        ],
        [
          [101, 1],
          [102, 2]
        ]
      )

      expect(await tabGroupService.planGroupConsolidation()).toEqual([])
    })

    it("should leave pinned tabs where they are", async () => {
      setup(
        [
          [1, "Wikipedia", 10],
          [2, "Wikipedia", 20]
        ],
        [
          [101, 1],
          [102, 1],
          [103, 2],
          [104, 2, true]
        ]
      )

      const moves = await tabGroupService.planGroupConsolidation()

      expect(moves[0].tabIds).toEqual([103])
    })

    it("should match titles carrying a sort-index prefix", async () => {
      setup(
        [
          [1, "1. Wikipedia", 10],
          [2, "3. Wikipedia", 20]
        ],
        [
          [101, 1],
          [102, 1],
          [103, 2]
        ]
      )

      const moves = await tabGroupService.planGroupConsolidation()

      expect(moves).toHaveLength(1)
      expect(moves[0].title).toBe("Wikipedia")
    })

    it("should ignore untitled groups", async () => {
      setup(
        [
          [1, "", 10],
          [2, "", 20]
        ],
        [
          [101, 1],
          [102, 2]
        ]
      )

      expect(await tabGroupService.planGroupConsolidation()).toEqual([])
    })
  })

  describe("consolidateGroups", () => {
    it("should move the tabs and report what it did", async () => {
      setup(
        [
          [1, "Wikipedia", 10],
          [2, "Wikipedia", 20]
        ],
        [
          [101, 1],
          [102, 1],
          [103, 2]
        ]
      )

      const result = await tabGroupService.consolidateGroups()

      expect(result).toEqual({ movedTabs: 1, movedGroups: 1 })
      expect(mockBrowser.tabs.move).toHaveBeenCalledWith([103], { windowId: 10, index: -1 })
      expect(mockBrowser.tabs.group).toHaveBeenCalledWith({ tabIds: [103], groupId: 1 })
    })

    it("should do nothing when there is nothing split", async () => {
      setup([[1, "Docs", 10]], [[101, 1]])

      expect(await tabGroupService.consolidateGroups()).toEqual({ movedTabs: 0, movedGroups: 0 })
      expect(mockBrowser.tabs.move).not.toHaveBeenCalled()
    })

    it("should carry on when one group fails to move", async () => {
      setup(
        [
          [1, "Wikipedia", 10],
          [2, "Wikipedia", 20],
          [3, "Docs", 10],
          [4, "Docs", 20]
        ],
        [
          [101, 1],
          [102, 2],
          [103, 3],
          [104, 4]
        ]
      )
      // Persistently, not once — withTabEditRetry would otherwise just retry it
      mockBrowser.tabs.move.mockImplementation((ids: number[]) =>
        ids.includes(104)
          ? Promise.reject(new Error("Tabs cannot be edited right now"))
          : Promise.resolve({})
      )

      const result = await tabGroupService.consolidateGroups()

      // One failure must not strand the remaining groups half-done
      expect(result.movedGroups).toBe(1)
    })
  })
})
