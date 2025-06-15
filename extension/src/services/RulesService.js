/**
 * Simplified Rules Service - Browser as SSOT
 * Manages custom tab grouping rules with stateless operations
 */

import { storageManager } from "../config/StorageManager.js"
import { tabGroupState } from "../state/TabGroupState.js"

class RulesService {
  /**
   * Finds a matching custom rule for a given domain
   * @param {string} domain - The domain to match against rules
   * @returns {Object|null} The matching rule or null if no match
   */
  async findMatchingRule(domain) {
    if (!domain) return null

    console.log(`[RulesService] Checking domain "${domain}" for custom rules`)

    // Get custom rules from state (already loaded from storage)
    const customRules = tabGroupState.getCustomRulesObject()
    const ruleCount = Object.keys(customRules).length

    console.log(`[RulesService] Found ${ruleCount} custom rules to check`)

    // Find matching rule
    for (const [ruleId, rule] of Object.entries(customRules)) {
      if (!rule.enabled) {
        console.log(`[RulesService] Skipping disabled rule: ${rule.name}`)
        continue
      }

      console.log(`[RulesService] Checking rule "${rule.name}" with domains:`, rule.domains)

      for (const ruleDomain of rule.domains) {
        if (this.domainMatches(domain, ruleDomain)) {
          console.log(`[RulesService] ✅ Domain "${domain}" matches rule "${rule.name}"`)
          return rule
        }
      }
    }

    console.log(`[RulesService] No matching rule found for domain "${domain}"`)
    return null
  }

  /**
   * Checks if a domain matches a rule domain (supports wildcards)
   * @param {string} tabDomain - Domain from the tab
   * @param {string} ruleDomain - Domain from the rule (supports *.domain.com format)
   * @returns {boolean} True if domains match
   */
  domainMatches(tabDomain, ruleDomain) {
    if (!tabDomain || !ruleDomain) return false

    const cleanTabDomain = tabDomain.toLowerCase().trim()
    const cleanRuleDomain = ruleDomain.toLowerCase().trim()

    // Check for wildcard pattern (*.domain.com)
    if (cleanRuleDomain.startsWith("*.")) {
      const baseDomain = cleanRuleDomain.substring(2) // Remove "*."

      // Validate that baseDomain is not empty and contains at least one dot
      if (!baseDomain || !baseDomain.includes(".")) {
        console.warn(`[RulesService] Invalid wildcard pattern: ${cleanRuleDomain}`)
        return false
      }

      // Check for exact match with base domain (mozilla.org matches *.mozilla.org)
      if (cleanTabDomain === baseDomain) {
        return true
      }

      // Check for subdomain match (developer.mozilla.org matches *.mozilla.org)
      // Must end with .baseDomain to ensure it's actually a subdomain
      return cleanTabDomain.endsWith("." + baseDomain)
    }

    // Exact match (backward compatibility)
    return cleanTabDomain === cleanRuleDomain
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
      domains: ruleData.domains.map((d) => d.toLowerCase().trim()).filter((d) => d),
      color: ruleData.color || "blue",
      enabled: ruleData.enabled !== false,
      priority: ruleData.priority || 1,
      createdAt: new Date().toISOString(),
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
      domains: ruleData.domains.map((d) => d.toLowerCase().trim()).filter((d) => d),
      color: ruleData.color || customRules[ruleId].color,
      enabled: ruleData.enabled !== false,
      priority: ruleData.priority || customRules[ruleId].priority,
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

    // Validate domains
    if (!ruleData.domains || !Array.isArray(ruleData.domains)) {
      errors.push("Domains must be an array")
    } else if (ruleData.domains.length === 0) {
      errors.push("At least one domain is required")
    } else if (ruleData.domains.length > 20) {
      errors.push("Maximum 20 domains per rule")
    } else {
      // Validate each domain
      for (const domain of ruleData.domains) {
        if (typeof domain !== "string" || !domain.trim()) {
          errors.push("All domains must be non-empty strings")
          break
        }

        const cleanDomain = domain.trim()

        // Check for wildcard pattern
        if (cleanDomain.startsWith("*.")) {
          const baseDomain = cleanDomain.substring(2)

          // Validate wildcard pattern
          if (!baseDomain || baseDomain.includes("*")) {
            errors.push(`Invalid wildcard pattern: ${cleanDomain}. Use format: *.domain.com`)
          } else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(baseDomain)) {
            errors.push(`Invalid base domain in wildcard: ${cleanDomain}`)
          }
        } else {
          // Regular domain validation
          if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
            errors.push(`Invalid domain format: ${cleanDomain}`)
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
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
    const enabledRules = Object.values(customRules).filter((r) => r.enabled).length
    const totalDomains = Object.values(customRules).reduce(
      (sum, rule) => sum + rule.domains.length,
      0
    )

    return {
      totalRules,
      enabledRules,
      disabledRules: totalRules - enabledRules,
      totalDomains,
    }
  }
}

// Export singleton instance
export const rulesService = new RulesService()
