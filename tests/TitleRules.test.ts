import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import type { CustomRule } from "../types"
import { DEFAULT_STATE } from "../types/storage"
import { mockBrowser } from "./setup"

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
 * Rules that match the page title, end to end (#98).
 *
 * The matcher's own behaviour is covered in TitlePatterns.test.ts; this is
 * about the title reaching it from the tab.
 */
describe("Rules matching the page title", () => {
  const URL = "https://www.youtube.com/watch?v=abc123"
  const TITLE = "How the Sahara Was Green - Barely Sociable - YouTube"

  function createRule(overrides: Partial<CustomRule> & { id: string }): CustomRule {
    return {
      name: "Barely Sociable",
      domains: ["title:Barely Sociable"],
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

  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
    mockBrowser.tabGroups.query.mockResolvedValue([])
    mockBrowser.tabs.group.mockResolvedValue(50)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("findMatchingRule", () => {
    it("should match on the title", async () => {
      setupRules({ "rule-1": createRule({ id: "rule-1" }) })

      const match = await rulesService.findMatchingRule(URL, TITLE)

      expect(match?.name).toBe("Barely Sociable")
      expect(match?.effectiveGroupName).toBe("Barely Sociable")
    })

    it("should not match when the title is different", async () => {
      setupRules({ "rule-1": createRule({ id: "rule-1" }) })

      const match = await rulesService.findMatchingRule(URL, "Rick Astley - YouTube")

      expect(match).toBeNull()
    })

    it("should not match when no title is passed", async () => {
      setupRules({ "rule-1": createRule({ id: "rule-1" }) })

      expect(await rulesService.findMatchingRule(URL)).toBeNull()
    })

    it("should honour an exclusion written against the title", async () => {
      setupRules({
        "rule-1": createRule({
          id: "rule-1",
          name: "Videos",
          domains: ["youtube.com", "!title:*Barely Sociable*"]
        })
      })

      expect(await rulesService.findMatchingRule(URL, TITLE)).toBeNull()
      expect((await rulesService.findMatchingRule(URL, "Rick Astley - YouTube"))?.name).toBe(
        "Videos"
      )
    })

    it("should keep a title rule out of a blacklisted tab's way", async () => {
      setupRules({
        "rule-1": createRule({ id: "rule-1", isBlacklist: true, domains: ["title:*YouTube"] })
      })

      expect((await rulesService.findBlacklistMatch(URL, TITLE))?.isBlacklist).toBe(true)
      expect(await rulesService.findBlacklistMatch(URL, "Some other page")).toBeNull()
    })
  })

  describe("hasTitleRules", () => {
    it("should be false with no rules", () => {
      expect(rulesService.hasTitleRules()).toBe(false)
    })

    it("should be false when no rule mentions titles", () => {
      setupRules({ "rule-1": createRule({ id: "rule-1", domains: ["youtube.com"] }) })
      expect(rulesService.hasTitleRules()).toBe(false)
    })

    it("should be true when an enabled rule matches on the title", () => {
      setupRules({ "rule-1": createRule({ id: "rule-1" }) })
      expect(rulesService.hasTitleRules()).toBe(true)
    })

    it("should ignore a disabled rule", () => {
      setupRules({ "rule-1": createRule({ id: "rule-1", enabled: false }) })
      expect(rulesService.hasTitleRules()).toBe(false)
    })
  })

  describe("grouping a tab", () => {
    it("should file the tab under the title rule's group", async () => {
      setupRules({ "rule-1": createRule({ id: "rule-1" }) })
      const tab = { id: 1, url: URL, title: TITLE, pinned: false, windowId: 1, groupId: -1 }
      mockBrowser.tabs.get.mockResolvedValue(tab)
      mockBrowser.tabs.query.mockResolvedValue([tab])

      const result = await tabGroupService.handleTabUpdate(1)

      expect(result).toBe(true)
      expect(mockBrowser.tabGroups.update).toHaveBeenCalledWith(
        50,
        expect.objectContaining({ title: "Barely Sociable" })
      )
    })

    it("should report the expected group title for the tab", async () => {
      setupRules({ "rule-1": createRule({ id: "rule-1" }) })

      const expected = await tabGroupService.getExpectedGroupTitle({
        id: 1,
        url: URL,
        title: TITLE,
        pinned: false,
        windowId: 1,
        groupId: -1
        // biome-ignore lint/suspicious/noExplicitAny: partial tab is enough here
      } as any)

      expect(expected).toBe("Barely Sociable")
    })
  })
})
