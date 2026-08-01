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
 * "Move tab to its group's window" — the manual counterpart to automatic
 * grouping, for people who keep windows roughly by topic.
 */
describe("moveTabToItsGroupWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    mockBrowser.tabs.get.mockResolvedValue({
      id: 1,
      url: "https://example.com",
      pinned: false,
      windowId: 1,
      groupId: -1
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function groupsInOtherWindows(...groups: { id: number; title: string; windowId: number }[]) {
    mockBrowser.tabGroups.query.mockResolvedValue(groups)
  }

  it("should move the tab into the matching group in another window", async () => {
    groupsInOtherWindows({ id: 50, title: "Example", windowId: 2 })
    mockBrowser.tabs.query.mockResolvedValue([{ id: 7 }])

    const result = await tabGroupService.moveTabToItsGroupWindow(1)

    expect(result.moved).toBe(true)
    expect(mockBrowser.tabs.move).toHaveBeenCalledWith(1, { windowId: 2, index: -1 })
    expect(mockBrowser.tabs.group).toHaveBeenCalledWith({ tabIds: [1], groupId: 50 })
  })

  it("should prefer the largest group when several windows have one", async () => {
    // The biggest is almost always the "main" window for that topic
    groupsInOtherWindows(
      { id: 50, title: "Example", windowId: 2 },
      { id: 51, title: "Example", windowId: 3 }
    )
    mockBrowser.tabs.query.mockImplementation(({ groupId }: { groupId: number }) =>
      Promise.resolve(groupId === 51 ? [{ id: 7 }, { id: 8 }, { id: 9 }] : [{ id: 7 }])
    )

    await tabGroupService.moveTabToItsGroupWindow(1)

    expect(mockBrowser.tabs.move).toHaveBeenCalledWith(1, { windowId: 3, index: -1 })
  })

  it("should ignore a matching group in the tab's own window", async () => {
    groupsInOtherWindows({ id: 50, title: "Example", windowId: 1 })

    const result = await tabGroupService.moveTabToItsGroupWindow(1)

    expect(result).toEqual({ moved: false, reason: "no-group" })
    expect(mockBrowser.tabs.move).not.toHaveBeenCalled()
  })

  it("should match a group carrying a sort-index prefix", async () => {
    groupsInOtherWindows({ id: 50, title: "3. Example", windowId: 2 })
    mockBrowser.tabs.query.mockResolvedValue([{ id: 7 }])

    expect((await tabGroupService.moveTabToItsGroupWindow(1)).moved).toBe(true)
  })

  it("should do nothing when no other window has that group", async () => {
    groupsInOtherWindows({ id: 50, title: "Something Else", windowId: 2 })

    const result = await tabGroupService.moveTabToItsGroupWindow(1)

    expect(result).toEqual({ moved: false, reason: "no-group" })
    expect(mockBrowser.tabs.move).not.toHaveBeenCalled()
  })

  it("should leave pinned tabs alone", async () => {
    mockBrowser.tabs.get.mockResolvedValue({
      id: 1,
      url: "https://example.com",
      pinned: true,
      windowId: 1
    })
    groupsInOtherWindows({ id: 50, title: "Example", windowId: 2 })

    const result = await tabGroupService.moveTabToItsGroupWindow(1)

    expect(result).toEqual({ moved: false, reason: "pinned" })
    expect(mockBrowser.tabs.move).not.toHaveBeenCalled()
  })

  it("should use the rule's group name rather than the domain", async () => {
    tabGroupState.updateFromStorage({
      ...DEFAULT_STATE,
      customRules: {
        "rule-1": {
          id: "rule-1",
          name: "Reading",
          domains: ["example.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      }
    })
    groupsInOtherWindows(
      { id: 50, title: "Example", windowId: 2 },
      { id: 51, title: "Reading", windowId: 3 }
    )
    mockBrowser.tabs.query.mockResolvedValue([{ id: 7 }])

    await tabGroupService.moveTabToItsGroupWindow(1)

    expect(mockBrowser.tabs.move).toHaveBeenCalledWith(1, { windowId: 3, index: -1 })
  })

  it("should do nothing for a tab that has no group title at all", async () => {
    tabGroupState.groupByMode = "rules-only"
    mockBrowser.tabs.get.mockResolvedValue({
      id: 1,
      url: "https://unmatched.com",
      pinned: false,
      windowId: 1
    })
    groupsInOtherWindows({ id: 50, title: "Example", windowId: 2 })

    const result = await tabGroupService.moveTabToItsGroupWindow(1)

    expect(result).toEqual({ moved: false, reason: "no-title" })
  })
})
