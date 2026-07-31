import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import { DEFAULT_STATE } from "../types/storage"

const { saveAllStorage } = vi.hoisted(() => ({ saveAllStorage: vi.fn() }))

vi.mock("../utils/storage", () => ({
  saveAllStorage,
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: { getValue: vi.fn().mockResolvedValue({}) }
}))

const { groupAllTabs, groupAllTabsManually, ungroupAllTabs, toggleAllGroupsCollapse } = vi.hoisted(
  () => ({
    groupAllTabs: vi.fn(),
    groupAllTabsManually: vi.fn(),
    ungroupAllTabs: vi.fn(),
    toggleAllGroupsCollapse: vi.fn()
  })
)

vi.mock("../services/TabGroupService", () => ({
  tabGroupService: {
    groupAllTabs,
    groupAllTabsManually,
    ungroupAllTabs,
    toggleAllGroupsCollapse
  }
}))

import { COMMANDS, handleCommand } from "../services/CommandService"

/**
 * Keyboard commands run the same service calls as the popup buttons, so a
 * shortcut and a click cannot drift apart.
 */
describe("CommandService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveAllStorage.mockResolvedValue(undefined)
    groupAllTabs.mockResolvedValue(true)
    groupAllTabsManually.mockResolvedValue(true)
    ungroupAllTabs.mockResolvedValue(true)
    toggleAllGroupsCollapse.mockResolvedValue({ isCollapsed: true })
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should group all tabs", async () => {
    expect(await handleCommand(COMMANDS.GROUP_ALL_TABS)).toBe(true)
    expect(groupAllTabsManually).toHaveBeenCalledTimes(1)
  })

  it("should ungroup all tabs", async () => {
    expect(await handleCommand(COMMANDS.UNGROUP_ALL_TABS)).toBe(true)
    expect(ungroupAllTabs).toHaveBeenCalledTimes(1)
  })

  it("should toggle collapse", async () => {
    expect(await handleCommand(COMMANDS.TOGGLE_COLLAPSE)).toBe(true)
    expect(toggleAllGroupsCollapse).toHaveBeenCalledTimes(1)
  })

  describe("toggle auto-grouping", () => {
    it("should turn it off and persist that", async () => {
      tabGroupState.autoGroupingEnabled = true

      await handleCommand(COMMANDS.TOGGLE_AUTO_GROUPING)

      expect(tabGroupState.autoGroupingEnabled).toBe(false)
      expect(saveAllStorage).toHaveBeenCalledWith(
        expect.objectContaining({ autoGroupingEnabled: false })
      )
      expect(groupAllTabs).not.toHaveBeenCalled()
    })

    it("should turn it on and group straight away", async () => {
      tabGroupState.autoGroupingEnabled = false

      await handleCommand(COMMANDS.TOGGLE_AUTO_GROUPING)

      expect(tabGroupState.autoGroupingEnabled).toBe(true)
      expect(saveAllStorage).toHaveBeenCalledWith(
        expect.objectContaining({ autoGroupingEnabled: true })
      )
      expect(groupAllTabs).toHaveBeenCalledTimes(1)
    })
  })

  it("should ignore commands it does not own", async () => {
    expect(await handleCommand("_execute_action")).toBe(false)
    expect(await handleCommand("something-else")).toBe(false)

    expect(groupAllTabsManually).not.toHaveBeenCalled()
    expect(ungroupAllTabs).not.toHaveBeenCalled()
    expect(toggleAllGroupsCollapse).not.toHaveBeenCalled()
    expect(saveAllStorage).not.toHaveBeenCalled()
  })
})
