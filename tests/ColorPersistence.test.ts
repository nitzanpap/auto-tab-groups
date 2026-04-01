import type { MockInstance } from "vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * NOTE: vi.mock module interception does not work under Bun's runtime.
 * These tests use vi.spyOn on the actual singleton/storage instances instead.
 */

import { tabGroupService } from "../services/TabGroupService"
import { tabGroupState } from "../services/TabGroupState"
import { DEFAULT_STATE } from "../types/storage"
import {
  clearGroupColor,
  getGroupColor,
  groupColorMapping,
  updateGroupColor
} from "../utils/storage"
import { mockBrowser } from "./setup"

describe("Color Persistence", () => {
  // Track color mapping state for our spies
  let colorMappingState: Record<string, string> = {}

  // biome-ignore lint/suspicious/noExplicitAny: vi.spyOn returns heterogeneous mock types
  let spySetValue: MockInstance<(...args: any[]) => any>

  beforeEach(() => {
    vi.clearAllMocks()
    colorMappingState = {}
    tabGroupState.updateFromStorage(DEFAULT_STATE)

    // Spy on the shared WXT storage item's getValue/setValue
    vi.spyOn(groupColorMapping, "getValue").mockImplementation(
      // @ts-expect-error -- mock returns plain Record instead of strict GroupColorMapping
      () => Promise.resolve({ ...colorMappingState })
    )
    spySetValue = vi
      .spyOn(groupColorMapping, "setValue")
      .mockImplementation((value: Record<string, string>) => {
        colorMappingState = { ...value }
        return Promise.resolve()
      })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    colorMappingState = {}
  })

  describe("groupColorMapping storage", () => {
    it("should save color when updateGroupColor is called", async () => {
      await updateGroupColor("example", "blue")

      expect(colorMappingState).toEqual({ example: "blue" })
    })

    it("should retrieve saved color for existing group title", async () => {
      colorMappingState = { example: "red" }

      const color = await getGroupColor("example")

      expect(color).toBe("red")
    })

    it("should return null for non-existent group title", async () => {
      colorMappingState = { example: "red" }

      const color = await getGroupColor("nonexistent")

      expect(color).toBe(null)
    })

    it("should handle empty color mapping", async () => {
      colorMappingState = {}

      const color = await getGroupColor("any")

      expect(color).toBe(null)
    })

    it("should clear specific group color", async () => {
      colorMappingState = { example: "red", other: "blue" }

      await clearGroupColor("example")

      expect(colorMappingState).toEqual({ other: "blue" })
    })

    it("should preserve other colors when updating one", async () => {
      colorMappingState = { existing: "green" }

      await updateGroupColor("newgroup", "yellow")

      expect(colorMappingState).toEqual({ existing: "green", newgroup: "yellow" })
    })
  })

  describe("TabGroupService color handling", () => {
    beforeEach(() => {
      colorMappingState = {}
    })

    it("should use saved color when creating group with same title", async () => {
      colorMappingState = { Example: "cyan" }
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://example.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://example.com", pinned: false }
      ])
      mockBrowser.tabs.group.mockResolvedValue(100)
      mockBrowser.tabGroups.update.mockResolvedValue({})

      await tabGroupService.handleTabUpdate(1)

      // Verify that tabGroups.update was called with the saved color
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          title: "Example",
          color: "cyan"
        })
      )
    })

    it("should save new color for new groups", async () => {
      colorMappingState = {}
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://newdomain.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://newdomain.com", pinned: false }
      ])
      mockBrowser.tabs.group.mockResolvedValue(100)
      mockBrowser.tabGroups.update.mockResolvedValue({})

      await tabGroupService.handleTabUpdate(1)

      // Verify that tabGroups.update was called with some color
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          title: "Newdomain",
          color: expect.any(String)
        })
      )

      // Verify the color was saved to the mapping
      expect(spySetValue).toHaveBeenCalled()
    })

    it("should not overwrite custom rule colors with saved colors", async () => {
      colorMappingState = { "Work Apps": "blue" }

      // Set up a custom rule with red color
      tabGroupState.updateFromStorage({
        ...DEFAULT_STATE,
        autoGroupingEnabled: true,
        customRules: {
          "rule-1": {
            id: "rule-1",
            name: "Work Apps",
            domains: ["example.com"],
            color: "red",
            enabled: true,
            priority: 1,
            createdAt: new Date().toISOString()
          }
        }
      })

      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://example.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://example.com", pinned: false }
      ])
      mockBrowser.tabs.group.mockResolvedValue(100)
      mockBrowser.tabGroups.update.mockResolvedValue({})

      await tabGroupService.handleTabUpdate(1)

      // Verify that the custom rule color (red) is used, not the saved color (blue)
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          title: "Work Apps",
          color: "red"
        })
      )
    })
  })

  describe("generateNewColors behavior", () => {
    it("should preserve colors for groups with custom rule colors", async () => {
      // Set up custom rule with specific color
      tabGroupState.updateFromStorage({
        ...DEFAULT_STATE,
        customRules: {
          "rule-1": {
            id: "rule-1",
            name: "Custom Group",
            domains: ["example.com"],
            color: "pink",
            enabled: true,
            priority: 1,
            createdAt: new Date().toISOString()
          }
        }
      })

      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "Custom Group", color: "pink" },
        { id: 2, title: "Other Group", color: "blue" }
      ])
      colorMappingState = { "Custom Group": "pink", "Other Group": "blue" }

      await tabGroupService.generateNewColors()

      // Custom Group should NOT have its color changed
      const customGroupUpdateCall = mockBrowser.tabGroups.update.mock.calls.find(
        (call: unknown[]) => call[0] === 1
      )
      expect(customGroupUpdateCall).toBeUndefined()

      // Other Group should have its color randomized
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ color: expect.any(String) })
      )
    })

    it("should save new colors to color mapping", async () => {
      colorMappingState = { "Test Group": "blue" }

      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "Test Group", color: "blue" }])

      await tabGroupService.generateNewColors()

      // groupColorMapping.setValue should have been called to save new colors
      expect(spySetValue).toHaveBeenCalled()
    })
  })

  describe("restoreSavedColors behavior", () => {
    it("should restore colors from saved mapping", async () => {
      colorMappingState = { example: "purple", other: "orange" }

      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "example", color: "blue" },
        { id: 2, title: "other", color: "green" }
      ])

      await tabGroupService.restoreSavedColors()

      // Both groups should have their saved colors restored
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(1, { color: "purple" })
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(2, { color: "orange" })
    })

    it("should not update groups that already have correct color", async () => {
      colorMappingState = { example: "purple" }

      mockBrowser.tabGroups.query.mockResolvedValue([
        { id: 1, title: "example", color: "purple" } // Already has correct color
      ])

      await tabGroupService.restoreSavedColors()

      // Should NOT call update since color already matches
      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalled()
    })

    it("should skip groups without saved colors", async () => {
      colorMappingState = {}

      mockBrowser.tabGroups.query.mockResolvedValue([{ id: 1, title: "example", color: "blue" }])

      await tabGroupService.restoreSavedColors()

      // Should NOT call update since no saved color exists
      expect(mockBrowser.tabGroups.update).not.toHaveBeenCalled()
    })
  })
})
