import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import type { CustomRule } from "../types"
import { DEFAULT_STATE } from "../types/storage"

// Mock storage utilities before importing RulesService
vi.mock("../utils/storage", () => ({
  saveAllStorage: vi.fn().mockResolvedValue(undefined),
  getGroupColor: vi.fn().mockResolvedValue(null),
  updateGroupColor: vi.fn().mockResolvedValue(undefined),
  groupColorMapping: {
    getValue: vi.fn().mockResolvedValue({})
  }
}))

import { rulesService } from "../services/RulesService"

/**
 * Tests for blacklist rules.
 * Blacklist rules prevent matching tabs from being grouped entirely,
 * taking priority over normal grouping rules.
 */
describe("Blacklist Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createRule(overrides: Partial<CustomRule> & { id: string }): CustomRule {
    return {
      name: "Test Rule",
      domains: ["example.com"],
      color: "blue",
      enabled: true,
      priority: 1,
      isBlacklist: false,
      createdAt: new Date().toISOString(),
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

  describe("RulesService.findBlacklistMatch", () => {
    it("should return a match when URL matches a blacklist rule", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked Sites",
          domains: ["blocked.com"],
          isBlacklist: true
        })
      })

      const result = await rulesService.findBlacklistMatch("https://blocked.com/page")
      expect(result).not.toBeNull()
      expect(result?.name).toBe("Blocked Sites")
    })

    it("should return null when URL does not match any blacklist rule", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked Sites",
          domains: ["blocked.com"],
          isBlacklist: true
        })
      })

      const result = await rulesService.findBlacklistMatch("https://allowed.com/page")
      expect(result).toBeNull()
    })

    it("should return null when there are no blacklist rules", async () => {
      setupRules({
        "rule-normal": createRule({
          id: "rule-normal",
          name: "Normal Rule",
          domains: ["example.com"],
          isBlacklist: false
        })
      })

      const result = await rulesService.findBlacklistMatch("https://example.com/page")
      expect(result).toBeNull()
    })

    it("should ignore disabled blacklist rules", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked Sites",
          domains: ["blocked.com"],
          isBlacklist: true,
          enabled: false
        })
      })

      const result = await rulesService.findBlacklistMatch("https://blocked.com/page")
      expect(result).toBeNull()
    })

    it("should match wildcard patterns in blacklist rules", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked Wildcards",
          domains: ["*.blocked.com"],
          isBlacklist: true
        })
      })

      const result = await rulesService.findBlacklistMatch("https://sub.blocked.com/page")
      expect(result).not.toBeNull()
    })

    it("should support exclusion patterns within blacklist rules", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked with Exception",
          domains: ["*.example.com", "!safe.example.com"],
          isBlacklist: true
        })
      })

      expect(await rulesService.findBlacklistMatch("https://bad.example.com/page")).not.toBeNull()
      expect(await rulesService.findBlacklistMatch("https://safe.example.com/page")).toBeNull()
    })

    it("should return null for empty URL", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          domains: ["blocked.com"],
          isBlacklist: true
        })
      })

      const result = await rulesService.findBlacklistMatch("")
      expect(result).toBeNull()
    })
  })

  describe("RulesService.findMatchingRule excludes blacklist rules", () => {
    it("should not return blacklist rules from findMatchingRule", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked",
          domains: ["example.com"],
          isBlacklist: true
        })
      })

      const result = await rulesService.findMatchingRule("https://example.com/page")
      expect(result).toBeNull()
    })

    it("should return normal rules while skipping blacklist rules", async () => {
      setupRules({
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Blocked",
          domains: ["blocked.com"],
          isBlacklist: true
        }),
        "rule-normal": createRule({
          id: "rule-normal",
          name: "Normal Group",
          domains: ["example.com"],
          isBlacklist: false
        })
      })

      const result = await rulesService.findMatchingRule("https://example.com/page")
      expect(result).not.toBeNull()
      expect(result?.name).toBe("Normal Group")

      const blockedResult = await rulesService.findMatchingRule("https://blocked.com/page")
      expect(blockedResult).toBeNull()
    })
  })

  describe("RulesService.addRule with isBlacklist", () => {
    it("should persist isBlacklist flag when adding a rule", async () => {
      vi.spyOn(tabGroupState, "addCustomRule")

      await rulesService.addRule({
        name: "Blocked",
        domains: ["blocked.com"],
        isBlacklist: true
      })

      expect(tabGroupState.addCustomRule).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ isBlacklist: true })
      )
    })

    it("should default isBlacklist to false when not specified", async () => {
      vi.spyOn(tabGroupState, "addCustomRule")

      await rulesService.addRule({
        name: "Normal",
        domains: ["example.com"]
      })

      expect(tabGroupState.addCustomRule).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ isBlacklist: false })
      )
    })
  })

  describe("RulesService.updateRule with isBlacklist", () => {
    it("should update isBlacklist flag", async () => {
      setupRules({
        "rule-1": createRule({
          id: "rule-1",
          name: "Was Normal",
          domains: ["example.com"],
          isBlacklist: false
        })
      })

      vi.spyOn(tabGroupState, "updateCustomRule")

      await rulesService.updateRule("rule-1", {
        name: "Now Blocked",
        domains: ["example.com"],
        isBlacklist: true
      })

      expect(tabGroupState.updateCustomRule).toHaveBeenCalledWith(
        "rule-1",
        expect.objectContaining({ isBlacklist: true })
      )
    })

    it("should preserve existing isBlacklist when not specified in update", async () => {
      setupRules({
        "rule-1": createRule({
          id: "rule-1",
          name: "Blacklisted",
          domains: ["example.com"],
          isBlacklist: true
        })
      })

      vi.spyOn(tabGroupState, "updateCustomRule")

      await rulesService.updateRule("rule-1", {
        name: "Still Blacklisted",
        domains: ["example.com"]
      })

      expect(tabGroupState.updateCustomRule).toHaveBeenCalledWith(
        "rule-1",
        expect.objectContaining({ isBlacklist: true })
      )
    })
  })

  describe("Blacklist priority over normal rules", () => {
    it("blacklist match should be found even when a normal rule also matches the same domain", async () => {
      setupRules({
        "rule-normal": createRule({
          id: "rule-normal",
          name: "Group It",
          domains: ["example.com"],
          isBlacklist: false
        }),
        "rule-bl": createRule({
          id: "rule-bl",
          name: "Block It",
          domains: ["example.com"],
          isBlacklist: true
        })
      })

      // Normal matching excludes blacklist rules
      const normalMatch = await rulesService.findMatchingRule("https://example.com/page")
      expect(normalMatch).not.toBeNull()
      expect(normalMatch?.name).toBe("Group It")

      // Blacklist matching finds the blacklist rule
      const blacklistMatch = await rulesService.findBlacklistMatch("https://example.com/page")
      expect(blacklistMatch).not.toBeNull()
      expect(blacklistMatch?.name).toBe("Block It")

      // In the actual grouping pipeline, blacklist is checked first (in TabGroupService),
      // so the tab would never reach findMatchingRule
    })
  })
})
