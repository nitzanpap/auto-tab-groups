/**
 * Manages extension settings state (no complex tab group state management)
 * Simplified to only handle user settings, browser is SSOT for tab groups
 */

import type { CustomRule, CustomRulesMapping, GroupByMode, RuleMatchingMode, StorageSchema } from '../types';
import { DEFAULT_STATE } from '../types/storage';

class TabGroupState {
  autoGroupingEnabled: boolean;
  groupNewTabs: boolean;
  groupByMode: GroupByMode;
  customRules: Map<string, CustomRule>;
  ruleMatchingMode: RuleMatchingMode;
  minimumTabsForGroup: number;

  constructor() {
    this.autoGroupingEnabled = DEFAULT_STATE.autoGroupingEnabled;
    this.groupNewTabs = DEFAULT_STATE.groupNewTabs;
    this.groupByMode = DEFAULT_STATE.groupByMode;
    this.customRules = new Map();
    this.ruleMatchingMode = DEFAULT_STATE.ruleMatchingMode;
    this.minimumTabsForGroup = DEFAULT_STATE.minimumTabsForGroup;
  }

  /**
   * Updates state from storage data (settings only)
   */
  updateFromStorage(data: Partial<StorageSchema>): void {
    this.autoGroupingEnabled = data.autoGroupingEnabled ?? this.autoGroupingEnabled;
    this.groupNewTabs = data.groupNewTabs ?? this.groupNewTabs;
    this.groupByMode = data.groupByMode ?? this.groupByMode;
    this.ruleMatchingMode = data.ruleMatchingMode ?? this.ruleMatchingMode;
    this.minimumTabsForGroup = data.minimumTabsForGroup ?? this.minimumTabsForGroup;

    this.customRules.clear();

    if (data.customRules) {
      Object.entries(data.customRules).forEach(([ruleId, rule]) => {
        this.customRules.set(ruleId, rule);
      });
    }
  }

  /**
   * Gets the current state for storage (settings only)
   */
  getStorageData(): StorageSchema {
    return {
      autoGroupingEnabled: this.autoGroupingEnabled,
      groupNewTabs: this.groupNewTabs,
      groupByMode: this.groupByMode,
      ruleMatchingMode: this.ruleMatchingMode,
      customRules: this.getCustomRulesObject(),
      groupColorMapping: {}, // Color mapping is managed separately
      minimumTabsForGroup: this.minimumTabsForGroup,
    };
  }

  /**
   * Adds a custom rule
   */
  addCustomRule(ruleId: string, rule: CustomRule): void {
    this.customRules.set(ruleId, rule);
  }

  /**
   * Updates a custom rule
   */
  updateCustomRule(ruleId: string, rule: CustomRule): void {
    this.customRules.set(ruleId, rule);
  }

  /**
   * Deletes a custom rule
   */
  deleteCustomRule(ruleId: string): void {
    this.customRules.delete(ruleId);
  }

  /**
   * Gets a custom rule by ID
   */
  getCustomRule(ruleId: string): CustomRule | undefined {
    return this.customRules.get(ruleId);
  }

  /**
   * Gets all custom rules as array of [id, rule] tuples
   */
  getCustomRules(): Array<[string, CustomRule]> {
    return [...this.customRules.entries()];
  }

  /**
   * Gets all custom rules as object for storage
   */
  getCustomRulesObject(): CustomRulesMapping {
    const rulesObj: CustomRulesMapping = {};
    this.customRules.forEach((rule, ruleId) => {
      rulesObj[ruleId] = rule;
    });
    return rulesObj;
  }

  /**
   * Sets the rule matching mode
   */
  setRuleMatchingMode(mode: RuleMatchingMode): void {
    this.ruleMatchingMode = mode;
  }

  /**
   * Gets the rule matching mode
   */
  getRuleMatchingMode(): RuleMatchingMode {
    return this.ruleMatchingMode;
  }
}

export const tabGroupState = new TabGroupState();
