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
 * Tests for rule priority during matching.
 * Higher priority wins; equal priorities fall back to creation order.
 */
describe("Rule priority", () => {
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

  it("should prefer the higher-priority rule over the older one", async () => {
    // Insertion order puts "Everything Google" first — priority must override it
    setupRules({
      "rule-google": createRule({
        id: "rule-google",
        name: "Everything Google",
        domains: ["*.google.com"],
        priority: 1
      }),
      "rule-docs": createRule({
        id: "rule-docs",
        name: "Docs",
        domains: ["docs.google.com"],
        priority: 10
      })
    })

    const match = await rulesService.findMatchingRule("https://docs.google.com/document/d/1")
    expect(match?.name).toBe("Docs")
  })

  it("should prefer the higher-priority rule regardless of insertion order", async () => {
    setupRules({
      "rule-docs": createRule({
        id: "rule-docs",
        name: "Docs",
        domains: ["docs.google.com"],
        priority: 10
      }),
      "rule-google": createRule({
        id: "rule-google",
        name: "Everything Google",
        domains: ["*.google.com"],
        priority: 1
      })
    })

    const match = await rulesService.findMatchingRule("https://docs.google.com/document/d/1")
    expect(match?.name).toBe("Docs")
  })

  it("should fall back to insertion order when priorities are equal", async () => {
    setupRules({
      "rule-a": createRule({ id: "rule-a", name: "First", domains: ["*.google.com"] }),
      "rule-b": createRule({ id: "rule-b", name: "Second", domains: ["docs.google.com"] })
    })

    const match = await rulesService.findMatchingRule("https://docs.google.com/doc")
    expect(match?.name).toBe("First")
  })

  it("should treat a missing priority as the default of 1", async () => {
    setupRules({
      "rule-low": createRule({
        id: "rule-low",
        name: "No Priority",
        domains: ["*.google.com"],
        priority: undefined as unknown as number
      }),
      "rule-high": createRule({
        id: "rule-high",
        name: "Explicit",
        domains: ["docs.google.com"],
        priority: 2
      })
    })

    const match = await rulesService.findMatchingRule("https://docs.google.com/doc")
    expect(match?.name).toBe("Explicit")
  })

  it("should skip disabled rules even at a higher priority", async () => {
    setupRules({
      "rule-off": createRule({
        id: "rule-off",
        name: "Disabled High",
        domains: ["docs.google.com"],
        priority: 10,
        enabled: false
      }),
      "rule-on": createRule({
        id: "rule-on",
        name: "Enabled Low",
        domains: ["*.google.com"],
        priority: 1
      })
    })

    const match = await rulesService.findMatchingRule("https://docs.google.com/doc")
    expect(match?.name).toBe("Enabled Low")
  })

  it("should apply priority to blacklist rules too", async () => {
    setupRules({
      "rule-bl-low": createRule({
        id: "rule-bl-low",
        name: "Broad Block",
        domains: ["*.google.com"],
        isBlacklist: true,
        priority: 1
      }),
      "rule-bl-high": createRule({
        id: "rule-bl-high",
        name: "Specific Block",
        domains: ["docs.google.com"],
        isBlacklist: true,
        priority: 5
      })
    })

    const match = await rulesService.findBlacklistMatch("https://docs.google.com/doc")
    expect(match?.name).toBe("Specific Block")
  })

  it("should keep exact matches ahead of auto-subdomain matches regardless of priority", async () => {
    // The two-pass exact-then-auto-subdomain design still wins over priority:
    // an explicitly written pattern is more specific than an implied one.
    setupRules({
      "rule-exact": createRule({
        id: "rule-exact",
        name: "Exact",
        domains: ["www.example.com"],
        priority: 1
      }),
      "rule-auto": createRule({
        id: "rule-auto",
        name: "Auto",
        domains: ["example.com"],
        priority: 10
      })
    })

    const match = await rulesService.findMatchingRule("https://www.example.com/page")
    expect(match?.name).toBe("Exact")
  })

  it("should not mutate the stored rule order", async () => {
    setupRules({
      "rule-a": createRule({ id: "rule-a", name: "Low", domains: ["a.com"], priority: 1 }),
      "rule-b": createRule({ id: "rule-b", name: "High", domains: ["b.com"], priority: 9 })
    })

    await rulesService.findMatchingRule("https://b.com")

    expect(Object.keys(tabGroupState.getCustomRulesObject())).toEqual(["rule-a", "rule-b"])
  })
})
