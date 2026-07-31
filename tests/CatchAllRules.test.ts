import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import type { CustomRule } from "../types"
import { DEFAULT_STATE } from "../types/storage"
import { mockBrowser } from "./setup"

// Mock storage utilities before importing the services
vi.mock("../utils/storage", () => ({
  saveAllStorage: vi.fn().mockResolvedValue(undefined),
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: {
    getValue: vi.fn().mockResolvedValue({})
  }
}))

import { rulesService } from "../services/RulesService"
import { tabGroupService } from "../services/TabGroupService"

/**
 * Tests for catch-all rules — a rule whose pattern is a lone "*".
 * It never competes with normal rules; it only collects what nothing else took.
 */
describe("Catch-all rules", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function createRule(overrides: Partial<CustomRule> & { id: string }): CustomRule {
    return {
      name: "Test Rule",
      domains: ["example.com"],
      color: "blue",
      enabled: true,
      priority: 1,
      isBlacklist: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides
    }
  }

  function setupRules(rules: Record<string, CustomRule>): void {
    tabGroupState.updateFromStorage({
      ...DEFAULT_STATE,
      autoGroupingEnabled: true,
      customRules: rules
    })
  }

  const catchAll = (overrides: Partial<CustomRule> = {}) =>
    createRule({ id: "rule-catch", name: "Other", domains: ["*"], ...overrides })

  describe("isCatchAllRule", () => {
    it("should detect a lone wildcard pattern", () => {
      expect(rulesService.isCatchAllRule(catchAll())).toBe(true)
    })

    it("should detect a catch-all that also carries exclusions", () => {
      expect(rulesService.isCatchAllRule(catchAll({ domains: ["*", "!github.com"] }))).toBe(true)
    })

    it("should not treat a scoped wildcard as catch-all", () => {
      expect(rulesService.isCatchAllRule(createRule({ id: "r", domains: ["*.github.com"] }))).toBe(
        false
      )
      expect(rulesService.isCatchAllRule(createRule({ id: "r", domains: ["google.**"] }))).toBe(
        false
      )
    })
  })

  describe("findMatchingRule", () => {
    it("should never return a catch-all rule", async () => {
      setupRules({ "rule-catch": catchAll() })

      expect(await rulesService.findMatchingRule("https://example.com")).toBeNull()
    })

    it("should still return normal rules when a catch-all exists", async () => {
      setupRules({
        "rule-catch": catchAll(),
        "rule-gh": createRule({ id: "rule-gh", name: "GitHub", domains: ["github.com"] })
      })

      const match = await rulesService.findMatchingRule("https://github.com/foo")
      expect(match?.name).toBe("GitHub")
    })
  })

  describe("findCatchAllRule", () => {
    it("should match any URL", async () => {
      setupRules({ "rule-catch": catchAll() })

      const match = await rulesService.findCatchAllRule("https://anything.example.org/page")
      expect(match?.name).toBe("Other")
    })

    it("should return null when no catch-all rule exists", async () => {
      setupRules({
        "rule-gh": createRule({ id: "rule-gh", name: "GitHub", domains: ["github.com"] })
      })

      expect(await rulesService.findCatchAllRule("https://example.com")).toBeNull()
    })

    it("should respect exclusion patterns", async () => {
      setupRules({ "rule-catch": catchAll({ domains: ["*", "!github.com"] }) })

      expect(await rulesService.findCatchAllRule("https://example.com")).not.toBeNull()
      expect(await rulesService.findCatchAllRule("https://github.com/foo")).toBeNull()
    })

    it("should ignore disabled catch-all rules", async () => {
      setupRules({ "rule-catch": catchAll({ enabled: false }) })

      expect(await rulesService.findCatchAllRule("https://example.com")).toBeNull()
    })

    it("should not match system URLs", async () => {
      setupRules({ "rule-catch": catchAll() })

      expect(await rulesService.findCatchAllRule("about:blank")).toBeNull()
      expect(await rulesService.findCatchAllRule("chrome://settings/")).toBeNull()
    })
  })

  describe("rules-only mode", () => {
    beforeEach(() => {
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.group.mockResolvedValue(100)
    })

    function setMode(rules: Record<string, CustomRule>) {
      setupRules(rules)
      tabGroupState.groupByMode = "rules-only"
    }

    it("should group unmatched tabs into the catch-all group", async () => {
      setMode({ "rule-catch": catchAll() })
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://unmatched.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://unmatched.com", pinned: false, windowId: 1, groupId: -1 }
      ])

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(true)
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ title: "Other" })
      )
    })

    it("should prefer a normal rule over the catch-all", async () => {
      setMode({
        "rule-catch": catchAll(),
        "rule-gh": createRule({ id: "rule-gh", name: "GitHub", domains: ["github.com"] })
      })
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://github.com/foo",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://github.com/foo", pinned: false, windowId: 1, groupId: -1 }
      ])

      await tabGroupService.handleTabUpdate(1)

      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ title: "GitHub" })
      )
    })

    it("should leave tabs ungrouped when no catch-all rule exists", async () => {
      setMode({
        "rule-gh": createRule({ id: "rule-gh", name: "GitHub", domains: ["github.com"] })
      })
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://unmatched.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })

    it("should not let the catch-all swallow blacklisted tabs", async () => {
      setMode({
        "rule-catch": catchAll(),
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked",
          domains: ["blocked.com"],
          isBlacklist: true
        })
      })
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://blocked.com/page",
        pinned: false,
        windowId: 1,
        groupId: -1
      })

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
    })
  })

  describe("domain mode", () => {
    beforeEach(() => {
      mockBrowser.tabGroups.query.mockResolvedValue([])
      mockBrowser.tabs.group.mockResolvedValue(100)
    })

    it("should not swallow tabs that domain grouping can handle", async () => {
      setupRules({ "rule-catch": catchAll() })
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://example.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://example.com", pinned: false, windowId: 1, groupId: -1 }
      ])

      await tabGroupService.handleTabUpdate(1)

      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ title: "Example" })
      )
    })

    it("should collect tabs that fall below the minimum group size", async () => {
      setupRules({ "rule-catch": catchAll() })
      tabGroupState.minimumTabsForGroup = 2
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://lonely.com",
        pinned: false,
        windowId: 1,
        groupId: -1
      })
      // Only one tab of this domain — not enough for its own group
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://lonely.com", pinned: false, windowId: 1, groupId: -1 }
      ])

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(true)
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ title: "Other" })
      )
    })

    it("should leave below-threshold tabs ungrouped when there is no catch-all", async () => {
      setupRules({})
      tabGroupState.minimumTabsForGroup = 2
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://lonely.com",
        pinned: false,
        windowId: 1,
        groupId: 5
      })
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://lonely.com", pinned: false, windowId: 1, groupId: 5 }
      ])

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([1])
    })

    it("should ungroup rather than recurse when the catch-all itself is below its minimum", async () => {
      setupRules({ "rule-catch": catchAll({ minimumTabs: 5 }) })
      tabGroupState.minimumTabsForGroup = 2
      mockBrowser.tabs.get.mockResolvedValue({
        id: 1,
        url: "https://lonely.com",
        pinned: false,
        windowId: 1,
        groupId: 5
      })
      mockBrowser.tabs.query.mockResolvedValue([
        { id: 1, url: "https://lonely.com", pinned: false, windowId: 1, groupId: 5 }
      ])

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(false)
      expect(mockBrowser.tabs.group).not.toHaveBeenCalled()
      expect(mockBrowser.tabs.ungroup).toHaveBeenCalledWith([1])
    })
  })
})
