import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import type { CustomRule } from "../types"
import { DEFAULT_STATE } from "../types/storage"
import { mockBrowser } from "./setup"

const mocks = vi.hoisted(() => ({
  getGroupColor: vi.fn()
}))

vi.mock("../utils/storage", () => ({
  saveAllStorage: vi.fn().mockResolvedValue(undefined),
  getGroupColor: mocks.getGroupColor,
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: {
    getValue: vi.fn().mockResolvedValue({})
  }
}))

import { tabGroupService } from "../services/TabGroupService"

/**
 * Tests for groups this extension did not create (#96).
 *
 * Other extensions build and manage their own tab groups, usually with titles
 * that change per session, so the protected-titles list cannot cover them.
 * Anything the minimum-tabs threshold would take apart therefore has to be a
 * group we would have built ourselves.
 */
describe("Groups created by others", () => {
  const FOREIGN_GROUP_ID = 7
  const OWN_GROUP_ID = 8

  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    tabGroupState.autoGroupingEnabled = true
    tabGroupState.minimumTabsForGroup = 5
    mocks.getGroupColor.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("checkGroupThreshold", () => {
    function groupWithTabs(group: { id: number; title?: string }, urls: string[]): void {
      mockBrowser.tabGroups.query.mockResolvedValue([group])
      mockBrowser.tabs.query.mockResolvedValue(
        urls.map((url, index) => ({ id: 100 + index, groupId: group.id, pinned: false, url }))
      )
    }

    it("should leave a session-titled group from another extension alone", async () => {
      groupWithTabs({ id: FOREIGN_GROUP_ID, title: "Tab grouping threshold extension" }, [
        "https://claude.ai/chat/1"
      ])

      const result = await tabGroupService.checkGroupThreshold(FOREIGN_GROUP_ID)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should leave an untitled group alone", async () => {
      groupWithTabs({ id: FOREIGN_GROUP_ID, title: "" }, ["https://example.com"])

      const result = await tabGroupService.checkGroupThreshold(FOREIGN_GROUP_ID)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should still disband our own domain group", async () => {
      groupWithTabs({ id: OWN_GROUP_ID, title: "Example" }, ["https://example.com"])

      const result = await tabGroupService.checkGroupThreshold(OWN_GROUP_ID)

      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([100])
    })

    it("should recognise a title we created even after its tabs navigated away", async () => {
      mocks.getGroupColor.mockResolvedValue("blue")
      groupWithTabs({ id: OWN_GROUP_ID, title: "Github" }, ["https://example.com"])

      const result = await tabGroupService.checkGroupThreshold(OWN_GROUP_ID)

      expect(result).toBe(true)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([100])
    })

    it("should recognise the System group", async () => {
      groupWithTabs({ id: OWN_GROUP_ID, title: "System" }, ["chrome://settings"])

      const result = await tabGroupService.checkGroupThreshold(OWN_GROUP_ID)

      expect(result).toBe(true)
    })

    it("should recognise an enabled rule's group name", async () => {
      const rule: CustomRule = {
        id: "rule-1",
        name: "Work",
        domains: ["intranet.local"],
        color: "blue",
        enabled: true,
        priority: 1,
        createdAt: new Date(0).toISOString()
      }
      tabGroupState.updateFromStorage({ ...DEFAULT_STATE, customRules: { "rule-1": rule } })
      tabGroupState.minimumTabsForGroup = 5
      groupWithTabs({ id: OWN_GROUP_ID, title: "Work" }, ["https://example.com"])

      const result = await tabGroupService.checkGroupThreshold(OWN_GROUP_ID)

      expect(result).toBe(true)
    })

    it("should ignore a sort-index prefix on our own group", async () => {
      groupWithTabs({ id: OWN_GROUP_ID, title: "2. Example" }, ["https://example.com"])

      const result = await tabGroupService.checkGroupThreshold(OWN_GROUP_ID)

      expect(result).toBe(true)
    })

    it("should leave a protected group alone even when we could have built it", async () => {
      tabGroupState.updateFromStorage({
        ...DEFAULT_STATE,
        protectedGroupTitles: ["Example"]
      })
      tabGroupState.minimumTabsForGroup = 5
      groupWithTabs({ id: OWN_GROUP_ID, title: "Example" }, ["https://example.com"])

      const result = await tabGroupService.checkGroupThreshold(OWN_GROUP_ID)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })
  })

  describe("handleTabUpdate below the threshold", () => {
    function navigatingTabIn(groupId: number, groupTitle: string): void {
      const tab = {
        id: 1,
        url: "https://lonely.com",
        pinned: false,
        windowId: 1,
        groupId
      }
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabGroups.get.mockResolvedValue({ id: groupId, title: groupTitle })
      mockBrowser.tabs.get.mockResolvedValue(tab)
      mockBrowser.tabs.query.mockResolvedValue([tab])
    }

    it("should not pull the tab out of another extension's group", async () => {
      navigatingTabIn(FOREIGN_GROUP_ID, "Tab grouping threshold extension")

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).not.toHaveBeenCalled()
    })

    it("should still pull the tab out of one of our groups", async () => {
      navigatingTabIn(OWN_GROUP_ID, "Lonely")

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([1])
    })
  })
})
