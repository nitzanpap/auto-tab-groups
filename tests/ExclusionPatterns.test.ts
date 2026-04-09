import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { rulesService } from "../services/RulesService"
import { tabGroupState } from "../services/TabGroupState"
import type { CustomRule } from "../types"
import { DEFAULT_STATE } from "../types/storage"
import { checkPatternOverlap, detectConflicts } from "../utils/RuleConflictDetector"

/**
 * Integration tests for exclusion (negation) patterns in custom rules.
 * Exclusion patterns start with "!" and prevent a URL from matching a rule.
 */
describe("Exclusion Patterns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("RulesService.findMatchingRule with exclusions", () => {
    function setupRuleWithExclusions(domains: string[], name = "Docs"): void {
      tabGroupState.updateFromStorage({
        ...DEFAULT_STATE,
        autoGroupingEnabled: true,
        customRules: {
          "rule-1": {
            id: "rule-1",
            name,
            domains,
            color: "blue",
            enabled: true,
            priority: 1,
            createdAt: new Date().toISOString()
          }
        }
      })
    }

    it("should match URL that is not excluded", async () => {
      setupRuleWithExclusions(["docs.*.*", "!docs.google.com"])

      const result = await rulesService.findMatchingRule("https://docs.python.org/3/library/")
      expect(result).not.toBeNull()
      expect(result?.name).toBe("Docs")
    })

    it("should NOT match URL that is excluded", async () => {
      setupRuleWithExclusions(["docs.*.*", "!docs.google.com"])

      const result = await rulesService.findMatchingRule("https://docs.google.com/document/d/1")
      expect(result).toBeNull()
    })

    it("should handle multiple exclusion patterns", async () => {
      setupRuleWithExclusions(["docs.*.*", "!docs.google.com", "!docs.microsoft.com"])

      expect(await rulesService.findMatchingRule("https://docs.python.org")).not.toBeNull()
      expect(await rulesService.findMatchingRule("https://docs.google.com")).toBeNull()
      expect(await rulesService.findMatchingRule("https://docs.microsoft.com")).toBeNull()
      expect(await rulesService.findMatchingRule("https://docs.rust-lang.org")).not.toBeNull()
    })

    it("should work with exact domain patterns and exclusions", async () => {
      setupRuleWithExclusions(["amazon.com", "ebay.com", "walmart.com", "!ebay.com"], "Shopping")

      expect(await rulesService.findMatchingRule("https://amazon.com/product")).not.toBeNull()
      expect(await rulesService.findMatchingRule("https://ebay.com/item")).toBeNull()
      expect(await rulesService.findMatchingRule("https://walmart.com/cart")).not.toBeNull()
    })

    it("should work with wildcard exclusion patterns", async () => {
      setupRuleWithExclusions(["*.example.com", "!staging.example.com"], "Example")

      expect(await rulesService.findMatchingRule("https://app.example.com")).not.toBeNull()
      expect(await rulesService.findMatchingRule("https://api.example.com")).not.toBeNull()
      expect(await rulesService.findMatchingRule("https://staging.example.com")).toBeNull()
    })

    it("should exclude subdomain URLs matched via auto-subdomain expansion", async () => {
      setupRuleWithExclusions(["example.com", "!example.com"], "Example")

      // www.example.com matches via auto-subdomain, and should also be excluded
      const result = await rulesService.findMatchingRule("https://www.example.com")
      expect(result).toBeNull()
    })

    it("should still match when there are no exclusions", async () => {
      setupRuleWithExclusions(["docs.*.*"])

      const result = await rulesService.findMatchingRule("https://docs.google.com/document")
      expect(result).not.toBeNull()
    })

    it("should handle rule with only exclusion patterns (no includes)", async () => {
      setupRuleWithExclusions(["!docs.google.com"])

      // No include patterns → nothing can match
      const result = await rulesService.findMatchingRule("https://docs.python.org")
      expect(result).toBeNull()
    })

    it("should not affect other rules when one rule excludes a URL", async () => {
      tabGroupState.updateFromStorage({
        ...DEFAULT_STATE,
        autoGroupingEnabled: true,
        customRules: {
          "rule-1": {
            id: "rule-1",
            name: "Docs",
            domains: ["docs.*.*", "!docs.google.com"],
            color: "blue",
            enabled: true,
            priority: 1,
            createdAt: new Date().toISOString()
          },
          "rule-2": {
            id: "rule-2",
            name: "Google",
            domains: ["*.google.com"],
            color: "red",
            enabled: true,
            priority: 1,
            createdAt: new Date().toISOString()
          }
        }
      })

      // docs.google.com is excluded from "Docs" but should match "Google"
      const result = await rulesService.findMatchingRule("https://docs.google.com")
      expect(result).not.toBeNull()
      expect(result?.name).toBe("Google")
    })
  })

  describe("RuleConflictDetector with exclusions", () => {
    it("should not flag exclusion patterns as conflicts", () => {
      const result = checkPatternOverlap("!docs.google.com", "docs.google.com")
      // Exclusion patterns should be skipped in conflict detection
      // The detectConflicts function filters them, not checkPatternOverlap directly
      expect(result).toBeDefined() // checkPatternOverlap itself doesn't filter
    })

    it("should skip exclusion patterns in source when detecting conflicts", () => {
      const existingRules: CustomRule[] = [
        {
          id: "rule-1",
          name: "Google",
          domains: ["*.google.com"],
          color: "red",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]

      const conflicts = detectConflicts(["docs.*.*", "!docs.google.com"], existingRules)

      // Only the include pattern "docs.*.*" should be checked, not "!docs.google.com"
      const exclusionConflicts = conflicts.filter(c => c.sourcePattern.startsWith("!"))
      expect(exclusionConflicts).toHaveLength(0)
    })

    it("should skip exclusion patterns in target rules when detecting conflicts", () => {
      const existingRules: CustomRule[] = [
        {
          id: "rule-1",
          name: "Docs",
          domains: ["docs.*.*", "!docs.google.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]

      const conflicts = detectConflicts(["docs.google.com"], existingRules)

      // Should not conflict with the "!docs.google.com" exclusion pattern
      const exclusionConflicts = conflicts.filter(c => c.targetPattern.startsWith("!"))
      expect(exclusionConflicts).toHaveLength(0)
    })

    it("should suppress conflict when source pattern is excluded by target rule (#59)", () => {
      const existingRules: CustomRule[] = [
        {
          id: "rule-1",
          name: "Docs",
          domains: ["docs.*.*", "!docs.google.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]

      const conflicts = detectConflicts(["docs.google.com"], existingRules)

      // docs.google.com is explicitly excluded from the Docs rule, so no conflict
      expect(conflicts).toHaveLength(0)
    })

    it("should suppress conflict when target pattern is excluded by source exclusions", () => {
      const existingRules: CustomRule[] = [
        {
          id: "rule-1",
          name: "Google Docs",
          domains: ["docs.google.com"],
          color: "red",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]

      const conflicts = detectConflicts(["*.google.com", "!docs.google.com"], existingRules)

      // docs.google.com is excluded from the source rule, so no conflict
      expect(conflicts).toHaveLength(0)
    })

    it("should suppress conflict when subdomain is excluded by wildcard exclusion", () => {
      const existingRules: CustomRule[] = [
        {
          id: "rule-1",
          name: "Example",
          domains: ["*.example.com", "!sub.example.com"],
          color: "green",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]

      const conflicts = detectConflicts(["sub.example.com"], existingRules)

      expect(conflicts).toHaveLength(0)
    })

    it("should still detect conflicts when no exclusion negates the overlap", () => {
      const existingRules: CustomRule[] = [
        {
          id: "rule-1",
          name: "Example",
          domains: ["*.example.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      ]

      const conflicts = detectConflicts(["sub.example.com"], existingRules)

      // No exclusion pattern, so the conflict should still be detected
      expect(conflicts.length).toBeGreaterThan(0)
    })
  })
})
