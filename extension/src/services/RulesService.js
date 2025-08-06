/**
 * Simplified Rules Service - Browser as SSOT
 * Manages custom tab grouping rules with stateless operations
 */

import { storageManager } from "../config/StorageManager.js"
import { tabGroupState } from "../state/TabGroupState.js"
import { urlPatternMatcher } from "../utils/UrlPatternMatcher.js"

class RulesService {
  /**
   * Finds a matching custom rule for a given URL
   * @param {string} url - The URL to match against rules
   * @returns {Object|null} The matching rule with additional match info or null if no match
   */
  async findMatchingRule(url) {
    if (!url) return null

    console.log(`[RulesService] Checking URL "${url}" for custom rules`)

    // Get custom rules from state (already loaded from storage)
    const customRules = tabGroupState.getCustomRulesObject()
    const ruleCount = Object.keys(customRules).length

    console.log(`[RulesService] Found ${ruleCount} custom rules to check`)

    // Find matching rule
    for (const [, rule] of Object.entries(customRules)) {
      if (!rule.enabled) {
        console.log(`[RulesService] Skipping disabled rule: ${rule.name}`)
        continue
      }

      console.log(`[RulesService] Checking rule "${rule.name}" with patterns:`, rule.domains)

      for (const rulePattern of rule.domains) {
        // Use the new UrlPatternMatcher for matching
        const matchResult = urlPatternMatcher.match(url, rulePattern, {
          ruleName: rule.name,
          groupNameTemplate: rule.groupNameTemplate
        })

        if (matchResult.matched) {
          console.log(
            `[RulesService] ✅ URL "${url}" matches rule "${rule.name}" with pattern "${rulePattern}"`
          )

          // Return enhanced rule object with match information
          return {
            ...rule,
            matchInfo: matchResult,
            effectiveGroupName: matchResult.groupName || rule.name
          }
        }
      }
    }

    console.log(`[RulesService] No matching rule found for URL "${url}"`)
    return null
  }

  /**
   * Checks if a URL matches a rule pattern (delegates to UrlPatternMatcher)
   * @param {string} tabUrl - Full URL from the tab
   * @param {string} rulePattern - Pattern from the rule (supports various formats)
   * @returns {boolean} True if URL matches pattern
   */
  urlMatches(tabUrl, rulePattern) {
    if (!tabUrl || !rulePattern) return false

    // Delegate to UrlPatternMatcher for consistency
    const matchResult = urlPatternMatcher.match(tabUrl, rulePattern)
    return matchResult.matched
  }

  /**
   * Gets all custom rules from state
   * @returns {Object} Custom rules object
   */
  async getCustomRules() {
    return tabGroupState.getCustomRulesObject()
  }

  /**
   * Adds a new custom rule
   * @param {Object} ruleData - Rule data (name, domains, color, etc.)
   * @returns {Promise<string>} The ID of the created rule
   */
  async addRule(ruleData) {
    const validation = this.validateRule(ruleData)
    if (!validation.isValid) {
      throw new Error(`Invalid rule: ${validation.errors.join(", ")}`)
    }

    const ruleId = this.generateRuleId()
    const rule = {
      id: ruleId,
      name: ruleData.name.trim(),
      domains: ruleData.domains.map(d => d.toLowerCase().trim()).filter(d => d),
      color: ruleData.color || "blue",
      enabled: ruleData.enabled !== false,
      priority: ruleData.priority || 1,
      minimumTabs: ruleData.minimumTabs ? parseInt(ruleData.minimumTabs) : null, // null means use global setting
      groupNameTemplate: ruleData.groupNameTemplate || null, // Template for dynamic group names
      createdAt: new Date().toISOString()
    }

    // Add rule to state
    tabGroupState.addCustomRule(ruleId, rule)

    // Save to storage
    await storageManager.saveState()

    console.log(`[RulesService] Added new rule: ${rule.name} (${ruleId})`)
    return ruleId
  }

  /**
   * Updates an existing custom rule
   * @param {string} ruleId - Rule ID to update
   * @param {Object} ruleData - Updated rule data
   * @returns {Promise<boolean>} Success status
   */
  async updateRule(ruleId, ruleData) {
    const validation = this.validateRule(ruleData)
    if (!validation.isValid) {
      throw new Error(`Invalid rule: ${validation.errors.join(", ")}`)
    }

    const customRules = await this.getCustomRules()
    if (!customRules[ruleId]) {
      throw new Error(`Rule with ID ${ruleId} not found`)
    }

    const updatedRule = {
      ...customRules[ruleId],
      name: ruleData.name.trim(),
      domains: ruleData.domains.map(d => d.toLowerCase().trim()).filter(d => d),
      color: ruleData.color || customRules[ruleId].color,
      enabled: ruleData.enabled !== false,
      priority: ruleData.priority || customRules[ruleId].priority,
      minimumTabs:
        ruleData.minimumTabs !== undefined
          ? ruleData.minimumTabs
            ? parseInt(ruleData.minimumTabs)
            : null
          : customRules[ruleId].minimumTabs,
      groupNameTemplate:
        ruleData.groupNameTemplate !== undefined
          ? ruleData.groupNameTemplate
          : customRules[ruleId].groupNameTemplate
    }

    // Update rule in state
    tabGroupState.updateCustomRule(ruleId, updatedRule)

    // Save to storage
    await storageManager.saveState()

    console.log(`[RulesService] Updated rule: ${updatedRule.name} (${ruleId})`)
    return true
  }

  /**
   * Deletes a custom rule
   * @param {string} ruleId - Rule ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteRule(ruleId) {
    const customRules = await this.getCustomRules()
    if (!customRules[ruleId]) {
      throw new Error(`Rule with ID ${ruleId} not found`)
    }

    // Remove rule from state
    tabGroupState.deleteCustomRule(ruleId)

    // Save to storage
    await storageManager.saveState()

    console.log(`[RulesService] Deleted rule: ${ruleId}`)
    return true
  }

  /**
   * Validates rule data
   * @param {Object} ruleData - Rule data to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateRule(ruleData) {
    const errors = []

    // Validate name
    if (!ruleData.name || typeof ruleData.name !== "string") {
      errors.push("Rule name is required")
    } else if (ruleData.name.trim().length < 1) {
      errors.push("Rule name cannot be empty")
    } else if (ruleData.name.trim().length > 50) {
      errors.push("Rule name cannot exceed 50 characters")
    }

    // Validate patterns (domains and URLs)
    if (!ruleData.domains || !Array.isArray(ruleData.domains)) {
      errors.push("Patterns must be an array")
    } else if (ruleData.domains.length === 0) {
      errors.push("At least one pattern is required")
    } else if (ruleData.domains.length > 20) {
      errors.push("Maximum 20 patterns per rule")
    } else {
      // Validate each pattern using UrlPatternMatcher
      for (const pattern of ruleData.domains) {
        if (typeof pattern !== "string" || !pattern.trim()) {
          errors.push("All patterns must be non-empty strings")
          break
        }

        const validation = urlPatternMatcher.validatePattern(pattern.trim())
        if (!validation.isValid) {
          errors.push(`Invalid pattern "${pattern}": ${validation.error}`)
        }
      }
    }

    // Validate minimumTabs (optional field)
    if (ruleData.minimumTabs !== null && ruleData.minimumTabs !== undefined) {
      const minTabs = parseInt(ruleData.minimumTabs)
      if (isNaN(minTabs) || minTabs < 1 || minTabs > 10) {
        errors.push(
          "Minimum tabs must be a number between 1 and 10, or empty to use global setting"
        )
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Generates a unique rule ID
   * @returns {string} Unique rule ID
   */
  generateRuleId() {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Gets statistics about custom rules usage
   * @returns {Promise<Object>} Usage statistics
   */
  async getRulesStats() {
    const customRules = await this.getCustomRules()
    const totalRules = Object.keys(customRules).length
    const enabledRules = Object.values(customRules).filter(r => r.enabled).length
    const totalDomains = Object.values(customRules).reduce(
      (sum, rule) => sum + rule.domains.length,
      0
    )

    return {
      totalRules,
      enabledRules,
      disabledRules: totalRules - enabledRules,
      totalDomains
    }
  }

  /**
   * Exports all custom rules as JSON
   * @returns {Promise<string>} JSON string of all rules
   */
  async exportRules() {
    const customRules = await this.getCustomRules()
    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      rules: customRules,
      totalRules: Object.keys(customRules).length
    }

    console.log(`[RulesService] Exporting ${exportData.totalRules} custom rules`)
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Imports custom rules from JSON data
   * @param {string} jsonData - JSON string containing rules to import
   * @param {boolean} replaceExisting - Whether to replace existing rules or merge
   * @returns {Promise<Object>} Import result with success status and details
   */
  async importRules(jsonData, replaceExisting = false) {
    try {
      const importData = JSON.parse(jsonData)

      // Validate import data structure
      if (!importData.rules || typeof importData.rules !== "object") {
        throw new Error("Invalid import file: Missing or invalid rules data")
      }

      const importRules = importData.rules
      const importCount = Object.keys(importRules).length

      if (importCount === 0) {
        throw new Error("No rules found in import file")
      }

      console.log(
        `[RulesService] Importing ${importCount} rules, replaceExisting: ${replaceExisting}`
      )

      // Validate each rule before importing
      const validationErrors = []
      const validRules = {}

      for (const [ruleId, ruleData] of Object.entries(importRules)) {
        const validation = this.validateRule(ruleData)
        if (validation.isValid) {
          // Generate new ID if replaceExisting is false and rule already exists
          let finalRuleId = ruleId
          if (!replaceExisting && tabGroupState.getCustomRule(ruleId)) {
            finalRuleId = this.generateRuleId()
          }

          validRules[finalRuleId] = {
            ...ruleData,
            id: finalRuleId,
            importedAt: new Date().toISOString()
          }
        } else {
          validationErrors.push(
            `Rule "${ruleData.name || ruleId}": ${validation.errors.join(", ")}`
          )
        }
      }

      const validCount = Object.keys(validRules).length
      if (validCount === 0) {
        throw new Error(`No valid rules found. Errors: ${validationErrors.join("; ")}`)
      }

      // Clear existing rules if replacing
      if (replaceExisting) {
        const existingRules = Object.keys(tabGroupState.getCustomRulesObject())
        existingRules.forEach(ruleId => {
          tabGroupState.deleteCustomRule(ruleId)
        })
        console.log(`[RulesService] Cleared ${existingRules.length} existing rules`)
      }

      // Import valid rules
      for (const [ruleId, rule] of Object.entries(validRules)) {
        tabGroupState.addCustomRule(ruleId, rule)
      }

      // Save to storage
      await storageManager.saveState()

      const result = {
        success: true,
        imported: validCount,
        total: importCount,
        skipped: importCount - validCount,
        validationErrors: validationErrors,
        replacedExisting: replaceExisting
      }

      console.log(`[RulesService] Import completed:`, result)
      return result
    } catch (error) {
      console.error(`[RulesService] Import failed:`, error)
      return {
        success: false,
        error: error.message,
        imported: 0,
        total: 0,
        skipped: 0
      }
    }
  }

  /**
   * Gets import/export statistics
   * @returns {Promise<Object>} Statistics about rules suitable for export/import
   */
  async getExportStats() {
    const customRules = await this.getCustomRules()
    const totalRules = Object.keys(customRules).length
    const enabledRules = Object.values(customRules).filter(rule => rule.enabled).length
    const totalDomains = Object.values(customRules).reduce(
      (sum, rule) => sum + rule.domains.length,
      0
    )

    return {
      totalRules,
      enabledRules,
      disabledRules: totalRules - enabledRules,
      totalDomains,
      exportReady: totalRules > 0
    }
  }
}

// Export singleton instance
export const rulesService = new RulesService()
