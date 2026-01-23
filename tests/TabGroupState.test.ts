import { beforeEach, describe, expect, it } from "vitest"
import { tabGroupState } from "../services/TabGroupState"
import type { CustomRule } from "../types"
import { DEFAULT_STATE } from "../types/storage"

describe("TabGroupState", () => {
  beforeEach(() => {
    // Reset state to defaults before each test
    tabGroupState.updateFromStorage(DEFAULT_STATE)
  })

  describe("initial state", () => {
    it("should have default autoGroupingEnabled", () => {
      expect(tabGroupState.autoGroupingEnabled).toBe(DEFAULT_STATE.autoGroupingEnabled)
    })

    it("should have default groupNewTabs", () => {
      expect(tabGroupState.groupNewTabs).toBe(DEFAULT_STATE.groupNewTabs)
    })

    it("should have default groupByMode", () => {
      expect(tabGroupState.groupByMode).toBe(DEFAULT_STATE.groupByMode)
    })

    it("should have default ruleMatchingMode", () => {
      expect(tabGroupState.ruleMatchingMode).toBe(DEFAULT_STATE.ruleMatchingMode)
    })

    it("should have default minimumTabsForGroup", () => {
      expect(tabGroupState.minimumTabsForGroup).toBe(DEFAULT_STATE.minimumTabsForGroup)
    })

    it("should have empty custom rules", () => {
      expect(tabGroupState.getCustomRulesObject()).toEqual({})
    })
  })

  describe("updateFromStorage", () => {
    it("should update autoGroupingEnabled", () => {
      tabGroupState.updateFromStorage({ autoGroupingEnabled: false })
      expect(tabGroupState.autoGroupingEnabled).toBe(false)
    })

    it("should update groupNewTabs", () => {
      tabGroupState.updateFromStorage({ groupNewTabs: false })
      expect(tabGroupState.groupNewTabs).toBe(false)
    })

    it("should update groupByMode", () => {
      tabGroupState.updateFromStorage({ groupByMode: "subdomain" })
      expect(tabGroupState.groupByMode).toBe("subdomain")
    })

    it("should update ruleMatchingMode", () => {
      tabGroupState.updateFromStorage({ ruleMatchingMode: "contains" })
      expect(tabGroupState.ruleMatchingMode).toBe("contains")
    })

    it("should update minimumTabsForGroup", () => {
      tabGroupState.updateFromStorage({ minimumTabsForGroup: 3 })
      expect(tabGroupState.minimumTabsForGroup).toBe(3)
    })

    it("should update customRules", () => {
      const rules: Record<string, CustomRule> = {
        "rule-1": {
          id: "rule-1",
          name: "Test Rule",
          domains: ["example.com"],
          color: "blue",
          enabled: true,
          priority: 1,
          createdAt: new Date().toISOString()
        }
      }
      tabGroupState.updateFromStorage({ customRules: rules })
      expect(tabGroupState.getCustomRulesObject()).toEqual(rules)
    })

    it("should preserve existing values when not provided", () => {
      tabGroupState.updateFromStorage({ autoGroupingEnabled: false })
      tabGroupState.updateFromStorage({ groupNewTabs: false })
      expect(tabGroupState.autoGroupingEnabled).toBe(false)
      expect(tabGroupState.groupNewTabs).toBe(false)
    })

    it("should clear existing custom rules when updating", () => {
      const rule1: CustomRule = {
        id: "rule-1",
        name: "Rule 1",
        domains: ["a.com"],
        color: "blue",
        enabled: true,
        priority: 1,
        createdAt: new Date().toISOString()
      }
      tabGroupState.updateFromStorage({ customRules: { "rule-1": rule1 } })
      expect(Object.keys(tabGroupState.getCustomRulesObject())).toHaveLength(1)

      const rule2: CustomRule = {
        id: "rule-2",
        name: "Rule 2",
        domains: ["b.com"],
        color: "red",
        enabled: true,
        priority: 1,
        createdAt: new Date().toISOString()
      }
      tabGroupState.updateFromStorage({ customRules: { "rule-2": rule2 } })
      expect(Object.keys(tabGroupState.getCustomRulesObject())).toHaveLength(1)
      expect(tabGroupState.getCustomRule("rule-1")).toBeUndefined()
      expect(tabGroupState.getCustomRule("rule-2")).toBeDefined()
    })
  })

  describe("getStorageData", () => {
    it("should return complete storage schema", () => {
      const data = tabGroupState.getStorageData()
      expect(data).toHaveProperty("autoGroupingEnabled")
      expect(data).toHaveProperty("groupNewTabs")
      expect(data).toHaveProperty("groupByMode")
      expect(data).toHaveProperty("ruleMatchingMode")
      expect(data).toHaveProperty("customRules")
      expect(data).toHaveProperty("groupColorMapping")
      expect(data).toHaveProperty("minimumTabsForGroup")
    })

    it("should return current state values", () => {
      tabGroupState.updateFromStorage({
        autoGroupingEnabled: false,
        groupByMode: "subdomain",
        minimumTabsForGroup: 5
      })
      const data = tabGroupState.getStorageData()
      expect(data.autoGroupingEnabled).toBe(false)
      expect(data.groupByMode).toBe("subdomain")
      expect(data.minimumTabsForGroup).toBe(5)
    })
  })

  describe("custom rules management", () => {
    const testRule: CustomRule = {
      id: "test-rule",
      name: "Test Rule",
      domains: ["example.com", "test.com"],
      color: "blue",
      enabled: true,
      priority: 1,
      createdAt: new Date().toISOString()
    }

    describe("addCustomRule", () => {
      it("should add a new rule", () => {
        tabGroupState.addCustomRule("test-rule", testRule)
        expect(tabGroupState.getCustomRule("test-rule")).toEqual(testRule)
      })

      it("should overwrite existing rule with same id", () => {
        tabGroupState.addCustomRule("test-rule", testRule)
        const updatedRule = { ...testRule, name: "Updated Rule" }
        tabGroupState.addCustomRule("test-rule", updatedRule)
        expect(tabGroupState.getCustomRule("test-rule")?.name).toBe("Updated Rule")
      })
    })

    describe("updateCustomRule", () => {
      it("should update an existing rule", () => {
        tabGroupState.addCustomRule("test-rule", testRule)
        const updatedRule = { ...testRule, enabled: false }
        tabGroupState.updateCustomRule("test-rule", updatedRule)
        expect(tabGroupState.getCustomRule("test-rule")?.enabled).toBe(false)
      })
    })

    describe("deleteCustomRule", () => {
      it("should delete a rule", () => {
        tabGroupState.addCustomRule("test-rule", testRule)
        expect(tabGroupState.getCustomRule("test-rule")).toBeDefined()
        tabGroupState.deleteCustomRule("test-rule")
        expect(tabGroupState.getCustomRule("test-rule")).toBeUndefined()
      })

      it("should handle deleting non-existent rule", () => {
        expect(() => tabGroupState.deleteCustomRule("non-existent")).not.toThrow()
      })
    })

    describe("getCustomRule", () => {
      it("should return rule by id", () => {
        tabGroupState.addCustomRule("test-rule", testRule)
        const rule = tabGroupState.getCustomRule("test-rule")
        expect(rule).toEqual(testRule)
      })

      it("should return undefined for non-existent rule", () => {
        expect(tabGroupState.getCustomRule("non-existent")).toBeUndefined()
      })
    })

    describe("getCustomRules", () => {
      it("should return all rules as array of tuples", () => {
        const rule1: CustomRule = { ...testRule, id: "rule-1" }
        const rule2: CustomRule = { ...testRule, id: "rule-2", name: "Rule 2" }

        tabGroupState.addCustomRule("rule-1", rule1)
        tabGroupState.addCustomRule("rule-2", rule2)

        const rules = tabGroupState.getCustomRules()
        expect(rules).toHaveLength(2)
        expect(rules[0]).toHaveLength(2)
        expect(rules[0][0]).toBe("rule-1")
        expect(rules[0][1]).toEqual(rule1)
      })

      it("should return empty array when no rules", () => {
        expect(tabGroupState.getCustomRules()).toHaveLength(0)
      })
    })

    describe("getCustomRulesObject", () => {
      it("should return all rules as object", () => {
        const rule1: CustomRule = { ...testRule, id: "rule-1" }
        const rule2: CustomRule = { ...testRule, id: "rule-2", name: "Rule 2" }

        tabGroupState.addCustomRule("rule-1", rule1)
        tabGroupState.addCustomRule("rule-2", rule2)

        const rulesObj = tabGroupState.getCustomRulesObject()
        expect(rulesObj["rule-1"]).toEqual(rule1)
        expect(rulesObj["rule-2"]).toEqual(rule2)
      })

      it("should return empty object when no rules", () => {
        expect(tabGroupState.getCustomRulesObject()).toEqual({})
      })
    })
  })

  describe("rule matching mode", () => {
    describe("setRuleMatchingMode", () => {
      it("should set rule matching mode to exact", () => {
        tabGroupState.setRuleMatchingMode("exact")
        expect(tabGroupState.getRuleMatchingMode()).toBe("exact")
      })

      it("should set rule matching mode to contains", () => {
        tabGroupState.setRuleMatchingMode("contains")
        expect(tabGroupState.getRuleMatchingMode()).toBe("contains")
      })

      it("should set rule matching mode to regex", () => {
        tabGroupState.setRuleMatchingMode("regex")
        expect(tabGroupState.getRuleMatchingMode()).toBe("regex")
      })
    })

    describe("getRuleMatchingMode", () => {
      it("should return current rule matching mode", () => {
        tabGroupState.setRuleMatchingMode("contains")
        expect(tabGroupState.getRuleMatchingMode()).toBe("contains")
      })
    })
  })
})
