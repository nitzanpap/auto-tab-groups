import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import type { CustomRule } from "../types"
import { DEFAULT_STATE } from "../types/storage"

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
 * Tests for editing the per-rule priority and minimum tabs fields exposed by
 * the rule editor.
 */
describe("Rule editing - priority and minimum tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function seedRule(overrides: Partial<CustomRule> = {}): string {
    const rule: CustomRule = {
      id: "rule-1",
      name: "Docs",
      domains: ["docs.google.com"],
      color: "blue",
      enabled: true,
      priority: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides
    }
    tabGroupState.updateFromStorage({ ...DEFAULT_STATE, customRules: { "rule-1": rule } })
    return "rule-1"
  }

  const stored = (ruleId: string) => tabGroupState.getCustomRulesObject()[ruleId]

  describe("addRule", () => {
    it("should persist a priority and a per-rule minimum", async () => {
      const ruleId = await rulesService.addRule({
        name: "Docs",
        domains: ["docs.google.com"],
        priority: 7,
        minimumTabs: 3
      })

      expect(stored(ruleId).priority).toBe(7)
      expect(stored(ruleId).minimumTabs).toBe(3)
    })

    it("should default priority to 1 when not supplied", async () => {
      const ruleId = await rulesService.addRule({ name: "Docs", domains: ["docs.google.com"] })

      expect(stored(ruleId).priority).toBe(1)
    })

    it("should store null minimum tabs as no override", async () => {
      const ruleId = await rulesService.addRule({
        name: "Docs",
        domains: ["docs.google.com"],
        minimumTabs: null
      })

      expect(stored(ruleId).minimumTabs).toBeUndefined()
    })

    it("should reject an out-of-range minimum", async () => {
      await expect(
        rulesService.addRule({ name: "Docs", domains: ["docs.google.com"], minimumTabs: 99 })
      ).rejects.toThrow(/Minimum tabs/)
    })
  })

  describe("updateRule", () => {
    it("should update the priority", async () => {
      const ruleId = seedRule({ priority: 1 })

      await rulesService.updateRule(ruleId, {
        name: "Docs",
        domains: ["docs.google.com"],
        priority: 5
      })

      expect(stored(ruleId).priority).toBe(5)
    })

    it("should set a per-rule minimum", async () => {
      const ruleId = seedRule()

      await rulesService.updateRule(ruleId, {
        name: "Docs",
        domains: ["docs.google.com"],
        minimumTabs: 4
      })

      expect(stored(ruleId).minimumTabs).toBe(4)
    })

    it("should clear the per-rule minimum when given null", async () => {
      const ruleId = seedRule({ minimumTabs: 4 })

      await rulesService.updateRule(ruleId, {
        name: "Docs",
        domains: ["docs.google.com"],
        minimumTabs: null
      })

      expect(stored(ruleId).minimumTabs).toBeUndefined()
    })

    it("should keep the existing minimum when the field is not supplied", async () => {
      const ruleId = seedRule({ minimumTabs: 4 })

      await rulesService.updateRule(ruleId, { name: "Docs", domains: ["docs.google.com"] })

      expect(stored(ruleId).minimumTabs).toBe(4)
    })
  })

  describe("effective minimum tabs", () => {
    it("should fall back to the global setting once the override is cleared", async () => {
      const { tabGroupService } = await import("../services/TabGroupService")
      const ruleId = seedRule({ minimumTabs: 4 })
      tabGroupState.minimumTabsForGroup = 2

      expect(tabGroupService.getEffectiveMinimumTabs(stored(ruleId))).toBe(4)

      await rulesService.updateRule(ruleId, {
        name: "Docs",
        domains: ["docs.google.com"],
        minimumTabs: null
      })

      expect(tabGroupService.getEffectiveMinimumTabs(stored(ruleId))).toBe(2)
    })
  })
})
