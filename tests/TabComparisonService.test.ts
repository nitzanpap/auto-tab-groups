import { beforeEach, describe, expect, it, vi } from "vitest"
import { COMPARISON_GROUP_TITLE, TabComparisonService } from "../services/TabComparisonService"
import { mockBrowser } from "./setup"

describe("TabComparisonService", () => {
  let service: TabComparisonService

  beforeEach(() => {
    service = new TabComparisonService()
    vi.clearAllMocks()
    ;(mockBrowser.tabs.get as any).mockReset()
    ;(mockBrowser.tabs.group as any).mockReset()
    ;(mockBrowser.tabs.ungroup as any).mockReset()
    ;(mockBrowser.tabGroups.get as any).mockReset()
    ;(mockBrowser.tabGroups.update as any).mockReset()
    ;(mockBrowser.action.setBadgeText as any).mockReset()
  })

  it("should initialize in inactive state", () => {
    expect(service.isComparisonActive()).toBe(false)
    expect(service.getSourceTabId()).toBeNull()
  })

  it("should start comparison, update badge and track sourceTabId", async () => {
    ;(mockBrowser.tabs.get as any).mockResolvedValue({ id: 10, groupId: 5 })
    await service.startComparison(10)
    expect(service.isComparisonActive()).toBe(true)
    expect(service.getSourceTabId()).toBe(10)
    expect(mockBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: "CMP" })
  })

  it("should cancel comparison and clear badge", async () => {
    ;(mockBrowser.tabs.get as any).mockResolvedValue({ id: 10, groupId: 5 })
    await service.startComparison(10)
    await service.cancelComparison()
    expect(service.isComparisonActive()).toBe(false)
    expect(service.getSourceTabId()).toBeNull()
    expect(mockBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: "" })
  })

  it("should ignore activation when same tab is re-activated", async () => {
    ;(mockBrowser.tabs.get as any).mockResolvedValue({ id: 10, groupId: 5 })
    await service.startComparison(10)
    const result = await service.handleTabActivated(10, 1)
    expect(result).toBe(false)
    expect(service.isComparisonActive()).toBe(true)
  })

  it("should pair source tab and target tab into a comparison group upon distinct activation", async () => {
    ;(mockBrowser.tabs.get as any).mockImplementation(async (id: number) => {
      if (id === 10) return { id: 10, windowId: 1, groupId: 5 }
      if (id === 20) return { id: 20, windowId: 1, groupId: 8 }
      return null
    })

    await service.startComparison(10)
    ;(mockBrowser.tabs.group as any).mockResolvedValue(99)
    ;(mockBrowser.tabGroups.update as any).mockResolvedValue({})

    const paired = await service.handleTabActivated(20, 1)

    expect(paired).toBe(true)
    expect(mockBrowser.tabs.group).toHaveBeenCalledWith({
      tabIds: [10, 20]
    })
    expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(99, {
      title: "Comparison",
      color: "purple"
    })
    expect(service.isComparisonActive()).toBe(false)
    expect(service.getComparisonGroupId()).toBe(99)
    expect(mockBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: "" })
  })

  it("should restore tabs to their parent groups when comparison is cancelled after pairing", async () => {
    ;(mockBrowser.tabs.get as any).mockImplementation(async (id: number) => {
      if (id === 10) return { id: 10, windowId: 1, groupId: 5 }
      if (id === 20) return { id: 20, windowId: 1, groupId: 8 }
      return null
    })
    ;(mockBrowser.tabGroups.get as any).mockImplementation(async (groupId: number) => {
      if (groupId === 5) return { id: 5, title: "Source Group" }
      if (groupId === 8) return { id: 8, title: "Target Group" }
      if (groupId === 99) return { id: 99, title: "Comparison" }
      return null
    })
    ;(mockBrowser.tabs.group as any).mockResolvedValue(99)

    await service.startComparison(10)
    await service.handleTabActivated(20, 1)

    expect(service.getComparisonGroupId()).toBe(99)

    // Now cancel comparison
    ;(mockBrowser.tabs.get as any).mockImplementation(async (id: number) => {
      if (id === 10) return { id: 10, windowId: 1, groupId: 99 }
      if (id === 20) return { id: 20, windowId: 1, groupId: 99 }
      return null
    })

    await service.cancelComparison()

    expect(mockBrowser.tabs.group).toHaveBeenCalledWith({
      tabIds: [10],
      groupId: 5
    })
    expect(mockBrowser.tabs.group).toHaveBeenCalledWith({
      tabIds: [20],
      groupId: 8
    })
    expect(service.getComparisonGroupId()).toBeNull()
  })
})
