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
 * "Wait until I view a new tab before grouping it".
 *
 * Filing a background tab the moment it appears is what makes it seem to
 * vanish — you middle-click a search result and it is moved elsewhere in the
 * strip before you ever see it.
 */
describe("Deferred grouping until first view", () => {
  const OPENER_ID = 9

  // The service keeps its new-tab flags in memory for the life of the process,
  // so each test uses a fresh tab id rather than leaking state into the next
  let nextTabId = 1

  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    tabGroupState.autoGroupingEnabled = true
    tabGroupState.deferGroupingUntilSeen = true
    mockBrowser.tabGroups.query.mockResolvedValue([])
    mockBrowser.tabs.group.mockResolvedValue(100)
    nextTabId += 1
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function tab(overrides: Record<string, unknown> = {}) {
    return {
      id: nextTabId,
      url: "https://example.com",
      pinned: false,
      windowId: 1,
      groupId: -1,
      active: false,
      openerTabId: OPENER_ID,
      ...overrides
    }
  }

  function stageTab(overrides: Record<string, unknown> = {}) {
    const value = tab(overrides)
    mockBrowser.tabs.get.mockResolvedValue(value)
    mockBrowser.tabs.query.mockResolvedValue([value])
    return value
  }

  it("should leave a freshly opened background tab alone", async () => {
    tabGroupService.markAsNewTab(nextTabId)
    stageTab()

    const result = await tabGroupService.handleTabUpdate(nextTabId)

    expect(result).toBe(false)
    expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
  })

  it("should group it once it becomes active", async () => {
    tabGroupService.markAsNewTab(nextTabId)
    stageTab({ active: true })

    const result = await tabGroupService.handleTabUpdate(nextTabId)

    expect(result).toBe(true)
    expect(mockBrowser.tabs.group).toHaveBeenCalled()
  })

  it("should group a foreground tab immediately, as before", async () => {
    tabGroupService.markAsNewTab(nextTabId)
    stageTab({ active: true, openerTabId: OPENER_ID })

    expect(await tabGroupService.handleTabUpdate(nextTabId)).toBe(true)
  })

  it("should still group everything when grouping is forced", async () => {
    // "Group Tabs" is an explicit request, so nothing is held back
    tabGroupService.markAsNewTab(nextTabId)
    stageTab()

    const result = await tabGroupService.handleTabUpdate(nextTabId, true)

    expect(result).toBe(true)
    expect(mockBrowser.tabs.group).toHaveBeenCalled()
  })

  it("should not defer a tab that was not opened from another tab", async () => {
    // Address-bar and restored tabs have no opener and are grouped as usual
    tabGroupService.markAsNewTab(nextTabId)
    stageTab({ openerTabId: undefined })

    expect(await tabGroupService.handleTabUpdate(nextTabId)).toBe(true)
  })

  it("should not defer a tab this service never saw created", async () => {
    // e.g. a background tab that navigates long after it was opened
    stageTab()

    expect(await tabGroupService.handleTabUpdate(nextTabId)).toBe(true)
  })

  it("should change nothing while the setting is off", async () => {
    tabGroupState.deferGroupingUntilSeen = false
    tabGroupService.markAsNewTab(nextTabId)
    stageTab()

    expect(await tabGroupService.handleTabUpdate(nextTabId)).toBe(true)
    expect(mockBrowser.tabs.group).toHaveBeenCalled()
  })

  it("should keep deferring across repeated updates until the tab is viewed", async () => {
    tabGroupService.markAsNewTab(nextTabId)
    stageTab()

    // onCreated, then onUpdated when the real URL arrives
    expect(await tabGroupService.handleTabUpdate(nextTabId)).toBe(false)
    expect(await tabGroupService.handleTabUpdate(nextTabId)).toBe(false)

    stageTab({ active: true })
    expect(await tabGroupService.handleTabUpdate(nextTabId)).toBe(true)
  })
})
