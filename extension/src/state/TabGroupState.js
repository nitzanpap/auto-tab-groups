/**
 * Manages the state of tab groups and their configurations
 */

import { DEFAULT_STATE } from "../config/StorageManager.js"

class TabGroupState {
  constructor() {
    this.domainColors = new Map()
    this.groupDomains = new Map() // Maps groupId -> domain
    this.autoGroupingEnabled = DEFAULT_STATE.autoGroupingEnabled
    this.onlyApplyToNewTabsEnabled = DEFAULT_STATE.onlyApplyToNewTabsEnabled
    this.groupBySubDomainEnabled = DEFAULT_STATE.groupBySubDomainEnabled
    this.preserveManualColors = DEFAULT_STATE.preserveManualColors
    this.manuallySetColors = new Set()
    this.customRules = new Map() // Maps ruleId -> rule object
    this.ruleMatchingMode = DEFAULT_STATE.ruleMatchingMode
  }

  /**
   * Gets the color for a domain
   * @param {string} domain
   * @returns {string|undefined}
   */
  getColor(domain) {
    return this.domainColors.get(domain)
  }

  /**
   * Sets the color for a domain
   * @param {string} domain
   * @param {string} color
   * @param {boolean} isManualSet - Whether this color was set manually by the user
   */
  setColor(domain, color, isManualSet = false) {
    this.domainColors.set(domain, color)
    if (isManualSet) {
      this.manuallySetColors.add(domain)
    }
  }

  /**
   * Gets all domain to color mappings
   * @returns {Array} Array of [domain, color] pairs
   */
  getDomainColors() {
    return [...this.domainColors.entries()]
  }

  /**
   * Sets the domain for a group
   * @param {number} groupId
   * @param {string} domain
   */
  setGroupDomain(groupId, domain) {
    this.groupDomains.set(groupId, domain)
  }

  /**
   * Gets the domain for a group
   * @param {number} groupId
   * @returns {string|undefined}
   */
  getGroupDomain(groupId) {
    return this.groupDomains.get(groupId)
  }

  /**
   * Removes a group from the domain mapping
   * @param {number} groupId
   */
  removeGroup(groupId) {
    this.groupDomains.delete(groupId)
  }

  /**
   * Updates state from storage data
   * @param {Object} data
   */
  updateFromStorage(data) {
    this.autoGroupingEnabled = data.autoGroupingEnabled
    this.onlyApplyToNewTabsEnabled = data.onlyApplyToNewTabsEnabled
    this.groupBySubDomainEnabled = data.groupBySubDomainEnabled
    this.preserveManualColors = data.preserveManualColors
    this.ruleMatchingMode = data.ruleMatchingMode || DEFAULT_STATE.ruleMatchingMode

    this.domainColors.clear()
    this.groupDomains.clear()
    this.manuallySetColors.clear()
    this.customRules.clear()

    if (data.domainColors) {
      Object.entries(data.domainColors).forEach(([domain, color]) => {
        this.domainColors.set(domain, color)
      })
    }

    if (data.groupDomains) {
      Object.entries(data.groupDomains).forEach(([groupId, domain]) => {
        this.groupDomains.set(parseInt(groupId), domain)
      })
    }

    if (data.manuallySetColors) {
      data.manuallySetColors.forEach((domain) => {
        this.manuallySetColors.add(domain)
      })
    }

    if (data.customRules) {
      Object.entries(data.customRules).forEach(([ruleId, rule]) => {
        this.customRules.set(ruleId, rule)
      })
    }
  }

  /**
   * Gets data for storage
   * @returns {Object}
   */
  getStorageData() {
    return {
      autoGroupingEnabled: this.autoGroupingEnabled,
      onlyApplyToNewTabsEnabled: this.onlyApplyToNewTabsEnabled,
      groupBySubDomainEnabled: this.groupBySubDomainEnabled,
      preserveManualColors: this.preserveManualColors,
      domainColors: Object.fromEntries(this.domainColors),
      groupDomains: Object.fromEntries(this.groupDomains),
      manuallySetColors: Array.from(this.manuallySetColors),
      customRules: Object.fromEntries(this.customRules),
      ruleMatchingMode: this.ruleMatchingMode,
    }
  }

  /**
   * Adds a custom rule
   * @param {string} ruleId - Rule ID
   * @param {Object} rule - Rule object
   */
  addCustomRule(ruleId, rule) {
    this.customRules.set(ruleId, rule)
  }

  /**
   * Updates a custom rule
   * @param {string} ruleId - Rule ID
   * @param {Object} rule - Updated rule object
   */
  updateCustomRule(ruleId, rule) {
    if (this.customRules.has(ruleId)) {
      this.customRules.set(ruleId, rule)
    }
  }

  /**
   * Deletes a custom rule
   * @param {string} ruleId - Rule ID to delete
   */
  deleteCustomRule(ruleId) {
    this.customRules.delete(ruleId)
  }

  /**
   * Gets a custom rule by ID
   * @param {string} ruleId - Rule ID
   * @returns {Object|undefined} Rule object or undefined
   */
  getCustomRule(ruleId) {
    return this.customRules.get(ruleId)
  }

  /**
   * Gets all custom rules
   * @returns {Array} Array of [ruleId, rule] pairs
   */
  getCustomRules() {
    return [...this.customRules.entries()]
  }

  /**
   * Gets all custom rules as an object
   * @returns {Object} Object with ruleId as key and rule as value
   */
  getCustomRulesObject() {
    return Object.fromEntries(this.customRules)
  }

  /**
   * Sets the rule matching mode
   * @param {string} mode - Matching mode ('exact', 'contains', 'regex')
   */
  setRuleMatchingMode(mode) {
    this.ruleMatchingMode = mode
  }

  /**
   * Gets the rule matching mode
   * @returns {string} Current matching mode
   */
  getRuleMatchingMode() {
    return this.ruleMatchingMode
  }
}

export const tabGroupState = new TabGroupState()
