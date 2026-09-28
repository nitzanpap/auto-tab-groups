import { beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupService } from "../services/TabGroupService"
import { tabGroupState } from "../services/TabGroupState"
import { mockBrowser } from "./setup"

describe("LaterGroupLock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.lockLaterGroupFirstTab = true
    tabGroupState.laterGroupName = "فيما بعد"
    tabGroupState.laterGroupLeaderTabId = 101
  })

  it("should do nothing if group title does not match later group", async () => {
    ;(mockBrowser.tabGroups.get as any).mockResolvedValue({
      id: 50,
      title: "Work"
    })

    const moved = await tabGroupService.enforceLaterGroupLeaderTab(50)
    expect(moved).toBe(false)
    expect(mockBrowser.tabs.move).not.toHaveBeenCalled()
  })

  it("should do nothing if later group leader tab is already at group start index", async () => {
    ;(mockBrowser.tabGroups.get as any).mockResolvedValue({
      id: 50,
      title: "فيما بعد"
    })
    ;(mockBrowser.tabs.query as any).mockResolvedValue([
      { id: 101, index: 4, groupId: 50 },
      { id: 102, index: 5, groupId: 50 }
    ])

    const moved = await tabGroupService.enforceLaterGroupLeaderTab(50)
    expect(moved).toBe(false)
    expect(mockBrowser.tabs.move).not.toHaveBeenCalled()
  })

  it("should restore leader tab to group start index when displaced by another tab", async () => {
    ;(mockBrowser.tabGroups.get as any).mockResolvedValue({
      id: 50,
      title: "فيما بعد"
    })
    // 102 was moved before leader 101
    ;(mockBrowser.tabs.query as any).mockResolvedValue([
      { id: 102, index: 4, groupId: 50 },
      { id: 101, index: 5, groupId: 50 }
    ])
    ;(mockBrowser.tabs.move as any).mockResolvedValue({})

    const moved = await tabGroupService.enforceLaterGroupLeaderTab(50)
    expect(moved).toBe(true)
    expect(mockBrowser.tabs.move).toHaveBeenCalledWith(101, { index: 4 })
  })
})
