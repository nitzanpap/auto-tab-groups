/**
 * Manages extension settings state (no complex tab group state management)
 * Simplified to only handle user settings, browser is SSOT for tab groups
 */

import { DEFAULT_STATE } from "../config/StorageManager.js"

class TabGroupState {
  constructor() {
    // Only user settings - no complex state management
    this.autoGroupingEnabled = DEFAULT_STATE.autoGroupingEnabled
    this.groupBySubDomainEnabled = DEFAULT_STATE.groupBySubDomainEnabled
    this.customRules = new Map() // Maps ruleId -> rule object
    this.ruleMatchingMode = DEFAULT_STATE.ruleMatchingMode
  }

  /**
   * Updates state from storage data (settings only)
   * @param {Object} data
   */
  updateFromStorage(data) {
    this.autoGroupingEnabled = data.autoGroupingEnabled
    this.groupBySubDomainEnabled = data.groupBySubDomainEnabled
    this.ruleMatchingMode = data.ruleMatchingMode || DEFAULT_STATE.ruleMatchingMode

    this.customRules.clear()

    if (data.customRules) {
      Object.entries(data.customRules).forEach(([ruleId, rule]) => {
        this.customRules.set(ruleId, rule)
      })
    }
  }

  /**
   * Gets the current state for storage (settings only)
   * @returns {Object}
   */
  getStorageData() {
    return {
      autoGroupingEnabled: this.autoGroupingEnabled,
      groupBySubDomainEnabled: this.groupBySubDomainEnabled,
      ruleMatchingMode: this.ruleMatchingMode,
      customRules: this.getCustomRulesObject(),
    }
  }

  /**
   * Adds a custom rule
   * @param {string} ruleId
   * @param {Object} rule
   */
  addCustomRule(ruleId, rule) {
    this.customRules.set(ruleId, rule)
  }

  /**
   * Updates a custom rule
   * @param {string} ruleId
   * @param {Object} rule
   */
  updateCustomRule(ruleId, rule) {
    this.customRules.set(ruleId, rule)
  }

  /**
   * Deletes a custom rule
   * @param {string} ruleId
   */
  deleteCustomRule(ruleId) {
    this.customRules.delete(ruleId)
  }

  /**
   * Gets a custom rule by ID
   * @param {string} ruleId
   * @returns {Object|undefined}
   */
  getCustomRule(ruleId) {
    return this.customRules.get(ruleId)
  }

  /**
   * Gets all custom rules as array
   * @returns {Array}
   */
  getCustomRules() {
    return [...this.customRules.entries()]
  }

  /**
   * Gets all custom rules as object for storage
   * @returns {Object}
   */
  getCustomRulesObject() {
    const rulesObj = {}
    this.customRules.forEach((rule, ruleId) => {
      rulesObj[ruleId] = rule
    })
    return rulesObj
  }

  /**
   * Sets the rule matching mode
   * @param {string} mode
   */
  setRuleMatchingMode(mode) {
    this.ruleMatchingMode = mode
  }

  /**
   * Gets the rule matching mode
   * @returns {string}
   */
  getRuleMatchingMode() {
    return this.ruleMatchingMode
  }
}

export const tabGroupState = new TabGroupState()
