/**
 * Utility functions for custom rules validation and processing
 */

import type { PatternValidationResult, RuleData, CustomRule, RuleValidationResult } from "../types"
import { urlPatternMatcher } from "./UrlPatternMatcher"
import { getColorInfo, isValidColor } from "./Constants"

/**
 * Checks if a string is an IPv4 address
 */
export function isIPv4Address(str: string): boolean {
  if (!str || typeof str !== "string") return false

  const parts = str.split(".")
  if (parts.length !== 4) return false

  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255 && part === num.toString()
  })
}

/**
 * Checks if a string is an IPv4 pattern with wildcards
 */
export function isIPv4Pattern(str: string): boolean {
  if (!str || typeof str !== "string") return false

  const parts = str.split(".")
  if (parts.length !== 4) return false

  return parts.every(part => {
    if (part === "*") return true
    if (!/^\d+$/.test(part)) return false
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255 && part === num.toString()
  })
}

/**
 * Validates an IPv4 pattern (exact IP or with wildcards)
 */
export function validateIPv4Pattern(pattern: string): PatternValidationResult {
  if (!pattern || typeof pattern !== "string") {
    return { isValid: false, error: "IPv4 pattern must be a string" }
  }

  const cleanPattern = pattern.trim()

  if (cleanPattern.length === 0) {
    return { isValid: false, error: "IPv4 pattern cannot be empty" }
  }

  const parts = cleanPattern.split(".")

  if (parts.length !== 4) {
    return { isValid: false, error: "IPv4 address must have exactly 4 octets" }
  }

  for (const part of parts) {
    if (part === "*") {
      continue
    }

    if (!/^\d+$/.test(part)) {
      return {
        isValid: false,
        error: `Invalid IPv4 octet "${part}". Must be 0-255 or *`
      }
    }

    const num = parseInt(part, 10)

    if (num < 0 || num > 255) {
      return {
        isValid: false,
        error: `IPv4 octet "${part}" must be between 0 and 255`
      }
    }

    if (part !== num.toString()) {
      return {
        isValid: false,
        error: `IPv4 octet "${part}" cannot have leading zeros`
      }
    }
  }

  return { isValid: true }
}

/**
 * Matches an IPv4 address against an IPv4 pattern
 */
export function matchIPv4(ip: string, pattern: string): boolean {
  if (!isIPv4Address(ip) || !isIPv4Pattern(pattern)) {
    return false
  }

  const ipParts = ip.split(".")
  const patternParts = pattern.split(".")

  if (ipParts.length !== 4 || patternParts.length !== 4) {
    return false
  }

  for (let i = 0; i < 4; i++) {
    if (patternParts[i] === "*") {
      continue
    }

    if (ipParts[i] !== patternParts[i]) {
      return false
    }
  }

  return true
}

/**
 * Validates a pattern string format for custom rules
 */
export function validateRulePattern(pattern: string): PatternValidationResult {
  return urlPatternMatcher.validatePattern(pattern)
}

/**
 * Validates a host pattern (domain or IP)
 */
export function validateHostPattern(pattern: string): PatternValidationResult {
  if (!pattern) {
    return { isValid: false, error: "Host pattern cannot be empty" }
  }

  if (isIPv4Pattern(pattern)) {
    return validateIPv4Pattern(pattern)
  }

  return validateDomainPattern(pattern)
}

/**
 * Validates a domain pattern (supports wildcards and TLD patterns)
 */
export function validateDomainPattern(pattern: string): PatternValidationResult {
  if (!pattern) {
    return { isValid: false, error: "Domain pattern cannot be empty" }
  }

  // Check for ** wildcard (TLD wildcard)
  if (pattern.includes("**")) {
    const parts = pattern.split("**")
    if (parts.length !== 2) {
      return {
        isValid: false,
        error: "Invalid ** pattern. Use format: domain.** or *.domain.**"
      }
    }

    const prefix = parts[0]
    const suffix = parts[1]

    if (!prefix || !prefix.endsWith(".")) {
      return {
        isValid: false,
        error: "** pattern must have domain prefix ending with dot (e.g., google.)"
      }
    }

    if (prefix.startsWith("*.")) {
      const basePrefix = prefix.substring(2)
      if (!basePrefix || !basePrefix.match(/^[a-zA-Z0-9.-]+\.$/)) {
        return {
          isValid: false,
          error: "Invalid subdomain wildcard with ** pattern"
        }
      }
    } else {
      if (!prefix.match(/^[a-zA-Z0-9.-]+\.$/)) {
        return { isValid: false, error: "Invalid domain prefix in ** pattern" }
      }
    }

    if (suffix && !suffix.match(/^[a-zA-Z0-9.-]*$/)) {
      return { isValid: false, error: "Invalid suffix in ** pattern" }
    }

    return { isValid: true }
  }

  // Check for * wildcard (subdomain wildcard)
  if (pattern.startsWith("*.")) {
    const baseDomain = pattern.substring(2)

    if (!baseDomain || !baseDomain.includes(".")) {
      return {
        isValid: false,
        error: "Invalid * pattern. Use format: *.domain.com"
      }
    }

    if (baseDomain.includes("*")) {
      return {
        isValid: false,
        error: "Multiple wildcards not allowed in domain pattern"
      }
    }

    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(baseDomain)) {
      return { isValid: false, error: "Invalid base domain in * pattern" }
    }

    return { isValid: true }
  }

  // Regular domain validation
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(pattern)) {
    return { isValid: false, error: "Invalid domain format" }
  }

  if (pattern.startsWith(".") || pattern.endsWith(".")) {
    return { isValid: false, error: "Domain cannot start or end with a dot" }
  }

  if (pattern.includes("..")) {
    return { isValid: false, error: "Domain cannot contain consecutive dots" }
  }

  if (pattern.startsWith("-") || pattern.endsWith("-")) {
    return {
      isValid: false,
      error: "Domain cannot start or end with a hyphen"
    }
  }

  return { isValid: true }
}

/**
 * Validates a path pattern
 */
export function validatePathPattern(pattern: string): PatternValidationResult {
  if (!pattern) {
    return { isValid: false, error: "Path pattern cannot be empty" }
  }

  const cleanPattern = pattern.startsWith("/") ? pattern.substring(1) : pattern

  if (cleanPattern.length === 0) {
    return { isValid: false, error: "Path pattern cannot be empty" }
  }

  if (cleanPattern.length > 100) {
    return {
      isValid: false,
      error: "Path pattern too long (max 100 characters)"
    }
  }

  // Check for ** wildcard in path
  if (cleanPattern.includes("**")) {
    const parts = cleanPattern.split("**")
    if (parts.length !== 2) {
      return {
        isValid: false,
        error: "Invalid ** pattern in path. Use format: prefix/**/suffix"
      }
    }

    const prefix = parts[0]
    const suffix = parts[1]

    if (prefix && !isValidPathSegment(prefix)) {
      return { isValid: false, error: "Invalid prefix in path ** pattern" }
    }

    if (suffix && !isValidPathSegment(suffix)) {
      return { isValid: false, error: "Invalid suffix in path ** pattern" }
    }

    return { isValid: true }
  }

  // Basic path validation
  if (!/^[a-zA-Z0-9._/*-]+$/.test(cleanPattern)) {
    return {
      isValid: false,
      error: "Path pattern contains invalid characters"
    }
  }

  if (cleanPattern.includes("//")) {
    return {
      isValid: false,
      error: "Path pattern cannot contain consecutive slashes"
    }
  }

  return { isValid: true }
}

/**
 * Validates a path segment
 */
export function isValidPathSegment(segment: string): boolean {
  if (!segment) return true

  const cleanSegment = segment.replace(/^\/+|\/+$/g, "")

  if (cleanSegment.length === 0) return true

  return /^[a-zA-Z0-9._/-]+$/.test(cleanSegment) && !cleanSegment.includes("//")
}

/**
 * Validates a rule name
 */
export function validateRuleName(name: string): PatternValidationResult {
  if (!name || typeof name !== "string") {
    return { isValid: false, error: "Rule name must be a string" }
  }

  const cleanName = name.trim()

  if (cleanName.length === 0) {
    return { isValid: false, error: "Rule name cannot be empty" }
  }

  if (cleanName.length > 50) {
    return { isValid: false, error: "Rule name cannot exceed 50 characters" }
  }

  const namePattern = /^[a-zA-Z0-9\s\-_()&.!?]+$/

  if (!namePattern.test(cleanName)) {
    return { isValid: false, error: "Rule name contains invalid characters" }
  }

  return { isValid: true, error: null }
}

/**
 * Parses a multi-line string of domains into an array
 */
export function parseDomainsText(domainsText: string): string[] {
  if (!domainsText || typeof domainsText !== "string") {
    return []
  }

  return domainsText
    .split("\n")
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0)
    .filter((domain, index, arr) => arr.indexOf(domain) === index)
}

/**
 * Sanitizes patterns array by removing invalid entries and duplicates
 */
export function sanitizePatterns(patterns: string[]): string[] {
  if (!Array.isArray(patterns)) {
    return []
  }

  const validPatterns: string[] = []
  const seen = new Set<string>()

  for (const pattern of patterns) {
    const validation = validateRulePattern(pattern)
    if (validation.isValid) {
      const cleanPattern = pattern.trim().toLowerCase()
      if (!seen.has(cleanPattern)) {
        validPatterns.push(cleanPattern)
        seen.add(cleanPattern)
      }
    }
  }

  return validPatterns
}

/**
 * Generates a formatted display string for domains
 */
export function formatDomainsDisplay(domains: string[], maxLength = 40): string {
  if (!Array.isArray(domains) || domains.length === 0) {
    return "No domains"
  }

  if (domains.length === 1) {
    return domains[0]
  }

  const domainsText = domains.join(", ")

  if (domainsText.length <= maxLength) {
    return domainsText
  }

  let truncated = ""
  let count = 0

  for (const domain of domains) {
    if (truncated.length + domain.length + 2 <= maxLength - 10) {
      if (truncated) truncated += ", "
      truncated += domain
      count++
    } else {
      break
    }
  }

  const remaining = domains.length - count
  return `${truncated}${remaining > 0 ? ` and ${remaining} more` : ""}`
}

/**
 * Validates rule data comprehensively
 */
export function validateRuleData(
  ruleData: RuleData,
  existingRules: CustomRule[] = []
): RuleValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate name
  const nameValidation = validateRuleName(ruleData.name)
  if (!nameValidation.isValid && nameValidation.error) {
    errors.push(nameValidation.error)
  }

  // Check for duplicate names
  const duplicateName = existingRules.find(
    rule =>
      rule.id !== ruleData.id &&
      rule.name.toLowerCase().trim() === ruleData.name?.toLowerCase().trim()
  )
  if (duplicateName) {
    errors.push(`A rule with the name "${ruleData.name}" already exists`)
  }

  // Validate domains
  if (!ruleData.domains || !Array.isArray(ruleData.domains)) {
    errors.push("Domains must be an array")
  } else if (ruleData.domains.length === 0) {
    errors.push("At least one domain is required")
  } else if (ruleData.domains.length > 20) {
    errors.push("Maximum 20 domains per rule")
  } else {
    const validPatterns: string[] = []
    for (const pattern of ruleData.domains) {
      const validation = validateRulePattern(pattern)
      if (!validation.isValid) {
        errors.push(`Invalid pattern "${pattern}": ${validation.error}`)
      } else {
        validPatterns.push(pattern.trim().toLowerCase())
      }
    }

    // Check for pattern conflicts with other rules
    for (const existingRule of existingRules) {
      if (existingRule.id === ruleData.id) continue

      const conflicts = validPatterns.filter(pattern => existingRule.domains.includes(pattern))

      if (conflicts.length > 0) {
        warnings.push(
          `Pattern(s) ${conflicts.join(", ")} already exist in rule "${existingRule.name}"`
        )
      }
    }
  }

  // Validate color
  if (ruleData.color && !isValidColor(ruleData.color)) {
    warnings.push(`Unknown color "${ruleData.color}", will use default`)
  }

  // Validate priority
  if (
    ruleData.priority !== undefined &&
    (typeof ruleData.priority !== "number" || ruleData.priority < 1)
  ) {
    errors.push("Priority must be a positive number")
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Creates a safe rule object with defaults
 */
export function createSafeRule(ruleData: RuleData): CustomRule {
  return {
    id: ruleData.id || `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: (ruleData.name || "").trim() || "Unnamed Rule",
    domains: sanitizePatterns(ruleData.domains || []),
    color: ruleData.color && isValidColor(ruleData.color) ? ruleData.color : "blue",
    enabled: ruleData.enabled !== false,
    priority:
      typeof ruleData.priority === "number" && ruleData.priority > 0 ? ruleData.priority : 1,
    createdAt: ruleData.createdAt || new Date().toISOString()
  }
}
