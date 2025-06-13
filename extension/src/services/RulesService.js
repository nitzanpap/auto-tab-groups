/**
 * Service for managing custom tab grouping rules
 */

import { storageManager } from "../config/StorageManager.js"
import { tabGroupState } from "../state/TabGroupState.js"
import { extractDomain } from "../utils/DomainUtils.js"

class RulesService {
  constructor() {
    // Cache for performance optimization
    this.domainRuleCache = new Map()
    this.lastCacheUpdate = 0
    this.CACHE_DURATION = 60000 // 1 minute cache
  }

  /**
   * Finds a matching custom rule for a given domain
   * @param {string} domain - The domain to match against rules
   * @returns {Object|null} The matching rule or null if no match
   */
  async findMatchingRule(domain) {
    if (!domain) return null

    // Check cache first
    const cacheKey = domain.toLowerCase()
    const now = Date.now()

    if (this.domainRuleCache.has(cacheKey) && now - this.lastCacheUpdate < this.CACHE_DURATION) {
      const cachedResult = this.domainRuleCache.get(cacheKey)
      console.log(`[findMatchingRule] Cache hit for "${domain}":`, cachedResult?.name || "no match")
      return cachedResult
    }

    // Get custom rules from storage (SSOT) - this ensures we always have the latest rules
    // even if the service worker was restarted and in-memory state was lost
    const customRules = await this.getCustomRules()
    console.log(
      `[findMatchingRule] Checking domain "${domain}" against ${
        Object.keys(customRules).length
      } rules (loaded from storage)`
    )

    // Update cache timestamp since we're loading fresh data
    this.lastCacheUpdate = now

    // Find matching rule
    let matchingRule = null
    for (const rule of Object.values(customRules)) {
      if (!rule.enabled) continue

      console.log(`[findMatchingRule] Checking rule "${rule.name}" with domains:`, rule.domains)
      for (const ruleDomain of rule.domains) {
        if (this.domainMatches(domain, ruleDomain)) {
          console.log(
            `[findMatchingRule] Domain "${domain}" matches rule domain "${ruleDomain}" in rule "${rule.name}"`
          )
          // If multiple rules match, use the one with higher priority (lower number = higher priority)
          if (!matchingRule || rule.priority < matchingRule.priority) {
            matchingRule = rule
          }
        }
      }
    }

    // Update cache
    this.domainRuleCache.set(cacheKey, matchingRule)
    this.lastCacheUpdate = now

    console.log(`[findMatchingRule] Final match for "${domain}":`, matchingRule?.name || "no match")
    return matchingRule
  }

  /**
   * Checks if a domain matches a rule domain
   * @param {string} tabDomain - Domain from the tab
   * @param {string} ruleDomain - Domain from the rule
   * @returns {boolean} True if domains match
   */
  domainMatches(tabDomain, ruleDomain) {
    if (!tabDomain || !ruleDomain) return false

    const cleanTabDomain = tabDomain.toLowerCase().trim()
    const cleanRuleDomain = ruleDomain.toLowerCase().trim()

    // Exact match for now (wildcards can be added later)
    return cleanTabDomain === cleanRuleDomain
  }

  /**
   * Determines the appropriate group for a tab based on custom rules or domain
   * @param {string} url - The tab URL
   * @returns {Promise<Object>} Group information with name, type, and rule
   */
  async resolveGroupForTab(url) {
    const baseDomain = extractDomain(url, false) // Base domain without subdomain
    const fullDomain = extractDomain(url, true) // Full domain with subdomain

    console.log(
      `[resolveGroupForTab] Processing URL "${url}": base="${baseDomain}", full="${fullDomain}"`
    )

    if (!baseDomain) return null

    // Check custom rules first (highest priority)
    // Try both full domain and base domain for better matching
    let matchingRule = null

    // First try with full domain (subdomain included)
    if (fullDomain && fullDomain !== baseDomain) {
      console.log(`[resolveGroupForTab] Checking custom rules for full domain: "${fullDomain}"`)
      matchingRule = await this.findMatchingRule(fullDomain)
    }

    // If no match with subdomain, try with base domain
    if (!matchingRule) {
      console.log(`[resolveGroupForTab] Checking custom rules for base domain: "${baseDomain}"`)
      matchingRule = await this.findMatchingRule(baseDomain)
    }

    if (matchingRule) {
      console.log(
        `[resolveGroupForTab] Found custom rule match: "${matchingRule.name}" for domain "${
          fullDomain || baseDomain
        }"`
      )
      return {
        name: matchingRule.name,
        type: "custom",
        rule: matchingRule,
        domain: fullDomain || baseDomain, // Use the domain that was actually matched
      }
    }

    // Fall back to domain-based grouping
    // Use the appropriate domain based on the subdomain setting
    const domainForGrouping = tabGroupState.groupBySubDomainEnabled
      ? fullDomain || baseDomain
      : baseDomain

    console.log(
      `[resolveGroupForTab] No custom rule match, using domain grouping: "${domainForGrouping}" (subdomain enabled: ${tabGroupState.groupBySubDomainEnabled})`
    )
    return {
      name: domainForGrouping,
      type: "domain",
      rule: null,
      domain: domainForGrouping,
    }
  }

  /**
   * Gets all custom rules from storage (SSOT)
   * @returns {Promise<Object>} Custom rules object
   */
  async getCustomRules() {
    // Always load fresh state from storage to ensure SSOT
    // This protects against service worker restarts that might clear in-memory state
    const state = await storageManager.loadState()
    return state?.customRules || {}
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

    // Clear cache
    this.clearCache()

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

    // Clear cache
    this.clearCache()

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

    // Clear cache
    this.clearCache()

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
        // Basic domain validation (can be enhanced)
        const cleanDomain = domain.trim()
        if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanDomain)) {
          errors.push(`Invalid domain format: ${cleanDomain}`)
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
   * Clears the domain-rule cache
   */
  clearCache() {
    this.domainRuleCache.clear()
    this.lastCacheUpdate = 0
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
      cacheSize: this.domainRuleCache.size,
    }
  }
}

// Export singleton instance
export const rulesService = new RulesService()
