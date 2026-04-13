/**
 * Simplified Rules Service - Browser as SSOT
 * Manages custom tab grouping rules with stateless operations
 */

import type { CustomRule, RuleData, RulesStats, TabGroupColor } from "../types"
import { isValidColor } from "../utils/Constants"
import { saveAllStorage } from "../utils/storage"
import { urlPatternMatcher } from "../utils/UrlPatternMatcher"
import { tabGroupState } from "./TabGroupState"

/**
 * Extended rule with match information
 */
export interface MatchedRule extends CustomRule {
  matchInfo: {
    matched: boolean
    extractedValues: Record<string, string>
    groupName: string | null
  }
  effectiveGroupName: string
}

/**
 * Rule validation result
 */
interface RuleValidation {
  isValid: boolean
  errors: string[]
}

/**
 * Import result
 */
interface ImportResult {
  success: boolean
  imported: number
  total: number
  skipped: number
  validationErrors?: string[]
  replacedExisting?: boolean
  error?: string
}

class RulesService {
  /**
   * Finds a matching custom rule for a given URL
   * Uses two-pass matching: exact matches first, then auto-www matches
   * This ensures explicit www.domain.com rules take priority over domain.com with auto-www
   */
  async findMatchingRule(url: string): Promise<MatchedRule | null> {
    if (!url) return null

    const customRules = tabGroupState.getCustomRulesObject()
    const groupingRules = Object.values(customRules).filter(r => !r.isBlacklist)

    console.log(`[RulesService] Found ${groupingRules.length} grouping rules to check`)

    // First pass: exact matches only (no auto-subdomain)
    const exactMatch = this.findMatchInRules(url, groupingRules, false)
    if (exactMatch) return exactMatch

    // Second pass: auto-subdomain matches (domain.com matches *.domain.com)
    return this.findMatchInRules(url, groupingRules, true)
  }

  /**
   * Finds a matching blacklist rule for a given URL.
   * Blacklist rules prevent tabs from being grouped entirely.
   */
  async findBlacklistMatch(url: string): Promise<MatchedRule | null> {
    if (!url) return null

    const customRules = tabGroupState.getCustomRulesObject()
    const blacklistRules = Object.values(customRules).filter(r => r.isBlacklist === true)

    if (blacklistRules.length === 0) return null

    // First pass: exact matches only
    const exactMatch = this.findMatchInRules(url, blacklistRules, false)
    if (exactMatch) return exactMatch

    // Second pass: auto-subdomain matches
    return this.findMatchInRules(url, blacklistRules, true)
  }

  /**
   * Searches rules for a matching URL, respecting exclusion patterns.
   * Exclusion patterns (prefixed with !) prevent a URL from matching a rule
   * even when it matches an include pattern.
   */
  private findMatchInRules(
    url: string,
    rules: CustomRule[],
    allowAutoSubdomain: boolean
  ): MatchedRule | null {
    const passLabel = allowAutoSubdomain ? " (auto-subdomain)" : ""

    for (const rule of rules) {
      if (!rule.enabled) continue

      const { includePatterns, excludePatterns } = this.splitPatterns(rule.domains)

      for (const rulePattern of includePatterns) {
        const matchResult = urlPatternMatcher.match(url, rulePattern, {
          ruleName: rule.name,
          allowAutoSubdomain
        })

        if (matchResult.matched) {
          if (this.isExcludedByRule(url, excludePatterns, allowAutoSubdomain)) {
            console.log(
              `[RulesService] URL "${url}" matches rule "${rule.name}" but is excluded${passLabel}`
            )
            break
          }

          console.log(
            `[RulesService] URL "${url}" matches rule "${rule.name}" with pattern "${rulePattern}"${passLabel}`
          )

          return {
            ...rule,
            matchInfo: matchResult,
            effectiveGroupName: matchResult.groupName || rule.name
          }
        }
      }
    }

    return null
  }

  /**
   * Splits a rule's domain patterns into include and exclude lists
   */
  private splitPatterns(domains: string[]): {
    includePatterns: string[]
    excludePatterns: string[]
  } {
    const includePatterns: string[] = []
    const excludePatterns: string[] = []

    for (const pattern of domains) {
      if (urlPatternMatcher.isExclusionPattern(pattern)) {
        excludePatterns.push(pattern.trim().substring(1))
      } else {
        includePatterns.push(pattern)
      }
    }

    return { includePatterns, excludePatterns }
  }

  /**
   * Checks if a URL matches any of the exclusion patterns
   */
  private isExcludedByRule(
    url: string,
    excludePatterns: string[],
    allowAutoSubdomain: boolean
  ): boolean {
    return excludePatterns.some(
      exclPattern => urlPatternMatcher.match(url, exclPattern, { allowAutoSubdomain }).matched
    )
  }

  /**
   * Checks if a URL matches a rule pattern
   */
  urlMatches(tabUrl: string, rulePattern: string): boolean {
    if (!tabUrl || !rulePattern) return false
    const matchResult = urlPatternMatcher.match(tabUrl, rulePattern)
    return matchResult.matched
  }

  /**
   * Gets all custom rules from state
   */
  async getCustomRules(): Promise<Record<string, CustomRule>> {
    return tabGroupState.getCustomRulesObject()
  }

  /**
   * Adds a new custom rule
   */
  async addRule(ruleData: RuleData): Promise<string> {
    const validation = this.validateRule(ruleData)
    if (!validation.isValid) {
      throw new Error(`Invalid rule: ${validation.errors.join(", ")}`)
    }

    const ruleId = this.generateRuleId()
    const rule: CustomRule = {
      id: ruleId,
      name: ruleData.name.trim(),
      domains: ruleData.domains.map(d => d.toLowerCase().trim()).filter(d => d),
      color: (ruleData.color && isValidColor(ruleData.color)
        ? ruleData.color
        : "blue") as TabGroupColor,
      enabled: ruleData.enabled !== false,
      priority: ruleData.priority || 1,
      minimumTabs: ruleData.minimumTabs,
      isBlacklist: ruleData.isBlacklist ?? false,
      createdAt: new Date().toISOString()
    }

    tabGroupState.addCustomRule(ruleId, rule)
    await this.saveState()

    console.log(
      `[RulesService] Added new rule: ${rule.name} (${ruleId})${rule.isBlacklist ? " [blacklist]" : ""}`
    )
    return ruleId
  }

  /**
   * Updates an existing custom rule
   */
  async updateRule(ruleId: string, ruleData: RuleData): Promise<boolean> {
    const validation = this.validateRule(ruleData)
    if (!validation.isValid) {
      throw new Error(`Invalid rule: ${validation.errors.join(", ")}`)
    }

    const customRules = await this.getCustomRules()
    if (!customRules[ruleId]) {
      throw new Error(`Rule with ID ${ruleId} not found`)
    }

    const existingRule = customRules[ruleId]
    const updatedRule: CustomRule = {
      ...existingRule,
      name: ruleData.name.trim(),
      domains: ruleData.domains.map(d => d.toLowerCase().trim()).filter(d => d),
      color: (ruleData.color && isValidColor(ruleData.color)
        ? ruleData.color
        : existingRule.color) as TabGroupColor,
      enabled: ruleData.enabled !== false,
      priority: ruleData.priority || existingRule.priority,
      minimumTabs: ruleData.minimumTabs ?? existingRule.minimumTabs,
      isBlacklist: ruleData.isBlacklist ?? existingRule.isBlacklist ?? false
    }

    tabGroupState.updateCustomRule(ruleId, updatedRule)
    await this.saveState()

    console.log(`[RulesService] Updated rule: ${updatedRule.name} (${ruleId})`)
    return true
  }

  /**
   * Deletes a custom rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    const customRules = await this.getCustomRules()
    if (!customRules[ruleId]) {
      throw new Error(`Rule with ID ${ruleId} not found`)
    }

    tabGroupState.deleteCustomRule(ruleId)
    await this.saveState()

    console.log(`[RulesService] Deleted rule: ${ruleId}`)
    return true
  }

  /**
   * Validates rule data
   */
  validateRule(ruleData: RuleData): RuleValidation {
    const errors: string[] = []

    // Validate name (not required for blacklist rules)
    if (!ruleData.isBlacklist) {
      if (!ruleData.name || typeof ruleData.name !== "string") {
        errors.push("Rule name is required")
      } else if (ruleData.name.trim().length < 1) {
        errors.push("Rule name cannot be empty")
      } else if (ruleData.name.trim().length > 50) {
        errors.push("Rule name cannot exceed 50 characters")
      }
    }

    // Validate patterns
    if (!ruleData.domains || !Array.isArray(ruleData.domains)) {
      errors.push("Patterns must be an array")
    } else if (ruleData.domains.length === 0) {
      errors.push("At least one pattern is required")
    } else {
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

    // Validate minimumTabs
    if (ruleData.minimumTabs !== null && ruleData.minimumTabs !== undefined) {
      const minTabs = Number(ruleData.minimumTabs)
      if (Number.isNaN(minTabs) || minTabs < 1 || minTabs > 10) {
        errors.push("Minimum tabs must be a number between 1 and 10")
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Generates a unique rule ID
   */
  generateRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Gets statistics about custom rules
   */
  async getRulesStats(): Promise<RulesStats> {
    const customRules = await this.getCustomRules()
    const rulesArray = Object.values(customRules)
    const totalRules = rulesArray.length
    const enabledRules = rulesArray.filter(r => r.enabled).length
    const totalPatterns = rulesArray.reduce((sum, rule) => sum + rule.domains.length, 0)

    return {
      totalRules,
      enabledRules,
      disabledRules: totalRules - enabledRules,
      totalPatterns
    }
  }

  /**
   * Exports all custom rules as JSON
   */
  async exportRules(): Promise<string> {
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
   */
  async importRules(jsonData: string, replaceExisting = false): Promise<ImportResult> {
    try {
      const importData = JSON.parse(jsonData)

      if (!importData.rules || typeof importData.rules !== "object") {
        throw new Error("Invalid import file: Missing or invalid rules data")
      }

      const importRules = importData.rules as Record<string, RuleData>
      const importCount = Object.keys(importRules).length

      if (importCount === 0) {
        throw new Error("No rules found in import file")
      }

      console.log(
        `[RulesService] Importing ${importCount} rules, replaceExisting: ${replaceExisting}`
      )

      const validationErrors: string[] = []
      const validRules: Record<string, CustomRule> = {}

      for (const [ruleId, ruleData] of Object.entries(importRules)) {
        const validation = this.validateRule(ruleData)
        if (validation.isValid) {
          let finalRuleId = ruleId
          if (!replaceExisting && tabGroupState.getCustomRule(ruleId)) {
            finalRuleId = this.generateRuleId()
          }

          validRules[finalRuleId] = {
            id: finalRuleId,
            name: ruleData.name?.trim() || "Unnamed Rule",
            domains: ruleData.domains?.map(d => d.toLowerCase().trim()).filter(d => d) || [],
            color: (ruleData.color && isValidColor(ruleData.color)
              ? ruleData.color
              : "blue") as TabGroupColor,
            enabled: ruleData.enabled !== false,
            priority: ruleData.priority || 1,
            isBlacklist: ruleData.isBlacklist ?? false,
            createdAt: ruleData.createdAt || new Date().toISOString()
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

      if (replaceExisting) {
        const existingRules = Object.keys(tabGroupState.getCustomRulesObject())
        existingRules.forEach(ruleId => {
          tabGroupState.deleteCustomRule(ruleId)
        })
        console.log(`[RulesService] Cleared ${existingRules.length} existing rules`)
      }

      for (const [ruleId, rule] of Object.entries(validRules)) {
        tabGroupState.addCustomRule(ruleId, rule)
      }

      await this.saveState()

      const result: ImportResult = {
        success: true,
        imported: validCount,
        total: importCount,
        skipped: importCount - validCount,
        validationErrors,
        replacedExisting: replaceExisting
      }

      console.log(`[RulesService] Import completed:`, result)
      return result
    } catch (error) {
      console.error(`[RulesService] Import failed:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        imported: 0,
        total: 0,
        skipped: 0
      }
    }
  }

  /**
   * Gets export statistics
   */
  async getExportStats(): Promise<RulesStats & { exportReady: boolean }> {
    const stats = await this.getRulesStats()
    return {
      ...stats,
      exportReady: stats.totalRules > 0
    }
  }

  /**
   * Save current state to storage
   */
  private async saveState(): Promise<void> {
    await saveAllStorage({
      customRules: tabGroupState.getCustomRulesObject()
    })
  }
}

export const rulesService = new RulesService()
