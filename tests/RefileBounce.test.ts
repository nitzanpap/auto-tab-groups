import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import { DEFAULT_STATE } from "../types/storage"
import { mockBrowser } from "./setup"

vi.mock("../utils/storage", () => ({
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: { getValue: vi.fn().mockResolvedValue({}) }
}))

import { tabGroupService } from "../services/TabGroupService"

// #109: something else keeps pulling a tab out of its group and we keep
// putting it back, so the tab blinks in and out forever.
describe("moveTabToGroup when a tab keeps getting pulled out", () => {
  const pullOutAndRefile = (tabId: number) => tabGroupService.moveTabToGroup(tabId)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(0)
    tabGroupState.updateFromStorage({ ...DEFAULT_STATE, autoGroupingEnabled: true })

    mockBrowser.tabs.get.mockImplementation(async (id: number) => ({
      id,
      url: "https://search.brave.com/search?q=x",
      pinned: false,
      windowId: 1,
      groupId: -1
    }))
    mockBrowser.tabGroups.query.mockResolvedValue([{ id: 100, title: "Brave", windowId: 1 }])
    mockBrowser.tabs.group.mockResolvedValue(100)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("puts the tab back a few times, then leaves it where it was moved", async () => {
    expect(await pullOutAndRefile(1)).toBe(true)
    expect(await pullOutAndRefile(1)).toBe(true)
    expect(await pullOutAndRefile(1)).toBe(true)

    expect(await pullOutAndRefile(1)).toBe(false)
    expect(mockBrowser.tabs.group).toHaveBeenCalledTimes(3)
  })

  it("only gives up on the tab being fought over", async () => {
    for (let i = 0; i < 4; i++) await pullOutAndRefile(2)
    mockBrowser.tabs.group.mockClear()

    expect(await pullOutAndRefile(3)).toBe(true)
  })

  it("picks the tab back up once it has been left alone for a while", async () => {
    for (let i = 0; i < 4; i++) await pullOutAndRefile(4)

    vi.setSystemTime(61_000)
    mockBrowser.tabs.group.mockClear()

    expect(await pullOutAndRefile(4)).toBe(true)
    expect(mockBrowser.tabs.group).toHaveBeenCalledTimes(1)
  })

  it("does not count moves that never put the tab in a group", async () => {
    mockBrowser.tabGroups.query.mockResolvedValue([])
    mockBrowser.tabs.query.mockResolvedValue([])
    tabGroupState.minimumTabsForGroup = 2
    for (let i = 0; i < 5; i++) await pullOutAndRefile(5)

    mockBrowser.tabGroups.query.mockResolvedValue([{ id: 100, title: "Brave", windowId: 1 }])
    expect(await pullOutAndRefile(5)).toBe(true)
  })
})
