/**
 * Simplified Rules Service - Browser as SSOT
 * Manages custom tab grouping rules with stateless operations
 */

import { storageManager } from "../config/StorageManager.js"
import { tabGroupState } from "../state/TabGroupState.js"
import { isIPv4Pattern, matchIPv4, validateRulePattern } from "../utils/RulesUtils.js"

class RulesService {
  /**
   * Finds a matching custom rule for a given URL
   * @param {string} url - The URL to match against rules
   * @returns {Object|null} The matching rule or null if no match
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
        if (this.urlMatches(url, rulePattern)) {
          console.log(
            `[RulesService] ✅ URL "${url}" matches rule "${rule.name}" with pattern "${rulePattern}"`
          )
          return rule
        }
      }
    }

    console.log(`[RulesService] No matching rule found for URL "${url}"`)
    return null
  }

  /**
   * Checks if a URL matches a rule pattern (supports domain and URL patterns)
   * @param {string} tabUrl - Full URL from the tab
   * @param {string} rulePattern - Pattern from the rule (supports various formats)
   * @returns {boolean} True if URL matches pattern
   */
  urlMatches(tabUrl, rulePattern) {
    if (!tabUrl || !rulePattern) return false

    const cleanRulePattern = rulePattern.toLowerCase().trim()

    try {
      // Parse URL to get components
      const url = new URL(tabUrl)
      const domain = url.hostname.toLowerCase()
      const path = url.pathname

      // Check if pattern includes a path
      const hasPath = cleanRulePattern.includes("/")
      const [domainPattern, pathPattern] = hasPath
        ? cleanRulePattern.split("/", 2)
        : [cleanRulePattern, ""]

      // Match host part first (domain or IP)
      const hostMatch = this.matchHost(domain, domainPattern)
      if (!hostMatch) return false

      // Match path part if specified
      if (hasPath) {
        return this.matchPath(path, pathPattern)
      }

      return true
    } catch (error) {
      console.warn(
        `[RulesService] Error matching URL "${tabUrl}" against pattern "${rulePattern}":`,
        error
      )
      return false
    }
  }

  /**
   * Matches a host against a host pattern (supports wildcards for domains and IPs)
   * @param {string} host - Host to match (domain or IP)
   * @param {string} pattern - Host pattern (supports *.domain.com, domain.**, and IP patterns)
   * @returns {boolean} True if host matches pattern
   */
  matchHost(host, pattern) {
    if (!host || !pattern) return false

    const cleanHost = host.toLowerCase().trim()
    const cleanPattern = pattern.toLowerCase().trim()

    // Check if pattern is IPv4
    if (isIPv4Pattern(cleanPattern)) {
      return matchIPv4(cleanHost, cleanPattern)
    }

    // Fall back to domain matching
    return this.matchDomain(cleanHost, cleanPattern)
  }

  /**
   * Matches a domain against a domain pattern (supports wildcards)
   * @param {string} domain - Domain to match
   * @param {string} pattern - Domain pattern (supports *.domain.com and domain.** formats)
   * @returns {boolean} True if domain matches pattern
   */
  matchDomain(domain, pattern) {
    if (!domain || !pattern) return false

    const cleanDomain = domain.toLowerCase().trim()
    const cleanPattern = pattern.toLowerCase().trim()

    // Handle ** wildcard for TLD (e.g., google.** matches google.com)
    if (cleanPattern.includes("**")) {
      const parts = cleanPattern.split("**")
      if (parts.length !== 2) {
        console.warn(`[RulesService] Invalid ** pattern: ${cleanPattern}`)
        return false
      }

      const prefix = parts[0] // e.g., "google."
      const suffix = parts[1] // e.g., "" (usually empty)

      // Domain must start with prefix and end with suffix
      if (!cleanDomain.startsWith(prefix)) return false
      if (suffix && !cleanDomain.endsWith(suffix)) return false

      // Ensure we have a valid TLD after the prefix
      const remainder = cleanDomain.substring(prefix.length)
      if (suffix) {
        const beforeSuffix = remainder.substring(0, remainder.length - suffix.length)
        return beforeSuffix.length > 0 && beforeSuffix.match(/^[a-zA-Z0-9.-]+$/)
      } else {
        return remainder.length > 0 && remainder.match(/^[a-zA-Z0-9.-]+$/)
      }
    }

    // Handle * wildcard for subdomains (*.domain.com)
    if (cleanPattern.startsWith("*.")) {
      const baseDomain = cleanPattern.substring(2) // Remove "*."

      // Validate that baseDomain is not empty and contains at least one dot
      if (!baseDomain || !baseDomain.includes(".")) {
        console.warn(`[RulesService] Invalid * pattern: ${cleanPattern}`)
        return false
      }

      // Check for exact match with base domain (mozilla.org matches *.mozilla.org)
      if (cleanDomain === baseDomain) {
        return true
      }

      // Check for subdomain match (developer.mozilla.org matches *.mozilla.org)
      // Must end with .baseDomain to ensure it's actually a subdomain
      return cleanDomain.endsWith("." + baseDomain)
    }

    // Exact match (backward compatibility)
    return cleanDomain === cleanPattern
  }

  /**
   * Matches a URL path against a path pattern
   * @param {string} urlPath - URL path to match
   * @param {string} pathPattern - Path pattern to match against
   * @returns {boolean} True if path matches pattern
   */
  matchPath(urlPath, pathPattern) {
    if (!pathPattern) return true // Empty pattern matches any path

    const cleanPath = urlPath.startsWith("/") ? urlPath.substring(1) : urlPath
    const cleanPattern = pathPattern.startsWith("/") ? pathPattern.substring(1) : pathPattern

    // Handle ** wildcard in path
    if (cleanPattern.includes("**")) {
      const parts = cleanPattern.split("**")
      if (parts.length !== 2) {
        console.warn(`[RulesService] Invalid ** pattern in path: ${cleanPattern}`)
        return false
      }

      const prefix = parts[0]
      const suffix = parts[1]

      // Path must start with prefix (if present)
      if (prefix && !cleanPath.startsWith(prefix)) {
        return false
      }

      // Path must end with suffix (if present)
      if (suffix && !cleanPath.endsWith(suffix)) {
        return false
      }

      // If both prefix and suffix are present, ensure there's something in between
      // (or they overlap, which is fine)
      if (prefix && suffix && cleanPath.length < prefix.length + suffix.length) {
        // Check if prefix and suffix overlap
        const minLength = Math.min(prefix.length, suffix.length)
        let overlapFound = false

        for (let i = 1; i <= minLength; i++) {
          if (prefix.substring(prefix.length - i) === suffix.substring(0, i)) {
            overlapFound = true
            break
          }
        }

        if (!overlapFound) {
          return false
        }
      }

      return true
    }

    // Exact prefix matching (existing behavior)
    return cleanPath.startsWith(cleanPattern)
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
          : customRules[ruleId].minimumTabs
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
      // Validate each pattern
      for (const pattern of ruleData.domains) {
        if (typeof pattern !== "string" || !pattern.trim()) {
          errors.push("All patterns must be non-empty strings")
          break
        }

        const validation = validateRulePattern(pattern.trim())
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
