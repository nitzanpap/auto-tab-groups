/**
 * Single Source of Truth for URL Pattern Matching
 * Handles all URL pattern matching logic for the extension
 */

import type { PatternValidationResult } from "../types"

/**
 * Pattern type identifiers
 */
export const PATTERN_TYPES = {
  SIMPLE_WILDCARD: "simple_wildcard",
  SEGMENT_EXTRACTION: "segment_extraction",
  REGEX: "regex"
} as const

export type PatternType = (typeof PATTERN_TYPES)[keyof typeof PATTERN_TYPES]

/**
 * Match result from pattern matching
 */
export interface MatchResult {
  matched: boolean
  extractedValues: Record<string, string>
  groupName: string | null
}

/**
 * Matching options
 */
export interface MatchOptions {
  ruleName?: string
  groupNameTemplate?: string
  allowAutoSubdomain?: boolean
}

/**
 * Pattern validation result with type
 */
export interface PatternValidationResultWithType extends PatternValidationResult {
  type: PatternType | null
}

/**
 * Variable specification from segment extraction patterns
 */
interface VariableSpec {
  name: string
  type: string
  delimiter: string | null
}

/**
 * Pattern part (literal or variable)
 */
interface PatternPart {
  type: "literal" | "variable"
  value: string | VariableSpec
}

/**
 * Parsed segment pattern info
 */
interface SegmentPatternInfo {
  valid: boolean
  variables: VariableSpec[]
  parts: PatternPart[]
  originalPattern: string
}

class UrlPatternMatcher {
  /**
   * Main entry point - matches a URL against a pattern
   */
  match(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    if (!url || !pattern) {
      return { matched: false, extractedValues: {}, groupName: null }
    }

    const patternType = this.detectPatternType(pattern)

    switch (patternType) {
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return this.matchSegmentExtraction(url, pattern, options)
      case PATTERN_TYPES.REGEX:
        return this.matchRegex(url, pattern, options)
      default:
        return this.matchSimpleWildcard(url, pattern, options)
    }
  }

  /**
   * Detects the type of pattern
   */
  detectPatternType(pattern: string): PatternType {
    // Check for segment extraction patterns (contains {variable})
    if (/\{[^}]+\}/.test(pattern)) {
      return PATTERN_TYPES.SEGMENT_EXTRACTION
    }

    // Check for regex patterns (starts and ends with /)
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      return PATTERN_TYPES.REGEX
    }

    // Default to simple wildcard
    return PATTERN_TYPES.SIMPLE_WILDCARD
  }

  /**
   * Matches using simple wildcard patterns
   */
  matchSimpleWildcard(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()
      const pathname = urlObj.pathname.toLowerCase()
      const cleanPattern = pattern.toLowerCase().trim()

      // Check if pattern includes a path
      const hasPath = cleanPattern.includes("/")
      // Split only on first "/" to separate domain from full path
      const firstSlashIndex = cleanPattern.indexOf("/")
      const domainPattern = hasPath ? cleanPattern.substring(0, firstSlashIndex) : cleanPattern
      const pathPattern = hasPath ? cleanPattern.substring(firstSlashIndex + 1) : ""

      // Match domain part
      const domainMatch = this.matchDomainWildcard(hostname, domainPattern, options)
      if (!domainMatch) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // Match path part if specified
      if (hasPath && !this.matchPathWildcard(pathname, pathPattern)) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      return {
        matched: true,
        extractedValues: {},
        groupName: options.ruleName || null
      }
    } catch {
      return { matched: false, extractedValues: {}, groupName: null }
    }
  }

  /**
   * Matches domain with wildcard support
   */
  matchDomainWildcard(domain: string, pattern: string, options: MatchOptions = {}): boolean {
    if (!domain || !pattern) return false

    const cleanDomain = domain.toLowerCase().trim()
    const cleanPattern = pattern.toLowerCase().trim()

    // Handle ** wildcard for TLD (e.g., google.** matches google.com)
    if (cleanPattern.includes("**")) {
      const parts = cleanPattern.split("**")
      if (parts.length !== 2) return false

      const prefix = parts[0]
      const suffix = parts[1]

      if (!cleanDomain.startsWith(prefix)) return false
      if (suffix && !cleanDomain.endsWith(suffix)) return false

      const remainder = cleanDomain.substring(prefix.length)
      if (suffix) {
        const beforeSuffix = remainder.substring(0, remainder.length - suffix.length)
        return beforeSuffix.length > 0 && /^[a-zA-Z0-9.-]+$/.test(beforeSuffix)
      }
      return remainder.length > 0 && /^[a-zA-Z0-9.-]+$/.test(remainder)
    }

    // Handle * wildcard for subdomains (*.domain.com)
    if (cleanPattern.startsWith("*.")) {
      const baseDomain = cleanPattern.substring(2)

      if (!baseDomain || !baseDomain.includes(".")) return false

      // Check for exact match or subdomain match
      return cleanDomain === baseDomain || cleanDomain.endsWith(`.${baseDomain}`)
    }

    // Handle middle wildcards
    if (cleanPattern.includes("*") && !cleanPattern.startsWith("*")) {
      return this.matchMiddleWildcard(cleanDomain, cleanPattern)
    }

    // Exact match
    if (cleanDomain === cleanPattern) return true

    // Auto-match any subdomain (only if enabled)
    if (options.allowAutoSubdomain && cleanDomain.endsWith(`.${cleanPattern}`)) return true

    return false
  }

  /**
   * Matches patterns with wildcards in the middle
   */
  matchMiddleWildcard(domain: string, pattern: string): boolean {
    // Convert pattern to regex, escaping special chars except *
    const regexPattern = pattern
      .split("*")
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^.]*")

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(domain)
  }

  /**
   * Matches path with wildcard support
   */
  matchPathWildcard(path: string, pattern: string): boolean {
    if (!pattern) return true

    const cleanPath = path.startsWith("/") ? path.substring(1) : path
    const cleanPattern = pattern.startsWith("/") ? pattern.substring(1) : pattern

    // Handle ** wildcard in path (match any number of segments)
    if (cleanPattern.includes("**")) {
      const parts = cleanPattern.split("**")
      if (parts.length !== 2) return false

      const prefix = parts[0]
      const suffix = parts[1]

      if (prefix && !cleanPath.startsWith(prefix)) return false
      if (suffix && !cleanPath.endsWith(suffix)) return false

      return true
    }

    // Handle single * wildcard in path segments (match single segment)
    if (cleanPattern.includes("*")) {
      // Convert pattern to regex: * matches any characters within a segment (not /)
      const regexPattern = cleanPattern
        .split("*")
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*")

      const regex = new RegExp(`^${regexPattern}`)
      return regex.test(cleanPath)
    }

    // Exact prefix matching
    return cleanPath.startsWith(cleanPattern)
  }

  /**
   * Matches using segment extraction patterns
   */
  matchSegmentExtraction(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()
      const pathname = urlObj.pathname

      const patternInfo = this.parseSegmentPattern(pattern)
      if (!patternInfo.valid) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      let targetString = hostname
      if (pattern.includes("/")) {
        targetString = hostname + pathname
      }

      const regex = this.buildSegmentRegex(patternInfo)
      const match = targetString.match(regex)

      if (!match) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      const extractedValues: Record<string, string> = {}
      patternInfo.variables.forEach((variable, index) => {
        extractedValues[variable.name] = match[index + 1]
      })

      const groupName = this.generateGroupName(patternInfo, extractedValues, options)

      return {
        matched: true,
        extractedValues,
        groupName
      }
    } catch {
      return { matched: false, extractedValues: {}, groupName: null }
    }
  }

  /**
   * Parses a segment extraction pattern
   */
  parseSegmentPattern(pattern: string): SegmentPatternInfo {
    const variables: VariableSpec[] = []
    const parts: PatternPart[] = []
    let currentPart = ""
    let inVariable = false
    let variableName = ""

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i]

      if (char === "{" && !inVariable) {
        if (currentPart) {
          parts.push({ type: "literal", value: currentPart })
          currentPart = ""
        }
        inVariable = true
        variableName = ""
      } else if (char === "}" && inVariable) {
        if (variableName) {
          const variable = this.parseVariableSpec(variableName)
          variables.push(variable)
          parts.push({ type: "variable", value: variable })
        }
        inVariable = false
      } else if (inVariable) {
        variableName += char
      } else {
        currentPart += char
      }
    }

    if (currentPart) {
      parts.push({ type: "literal", value: currentPart })
    }

    return {
      valid: !inVariable && variables.length > 0,
      variables,
      parts,
      originalPattern: pattern
    }
  }

  /**
   * Parses a variable specification
   */
  parseVariableSpec(spec: string): VariableSpec {
    const parts = spec.split(":")
    const name = parts[0]
    const type = parts[1] || "segment"
    const delimiter = parts[2] || null

    return { name, type, delimiter }
  }

  /**
   * Builds a regex from a parsed segment pattern
   */
  buildSegmentRegex(patternInfo: SegmentPatternInfo): RegExp {
    let regexStr = "^"

    for (const part of patternInfo.parts) {
      if (part.type === "literal") {
        let literal = (part.value as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        literal = literal.replace(/\\\*/g, "[^.]*")
        regexStr += literal
      } else if (part.type === "variable") {
        const variable = part.value as VariableSpec
        if (variable.delimiter === "dash") {
          regexStr += "([^-]+)"
        } else if (variable.delimiter === "dot") {
          regexStr += "([^.]+)"
        } else {
          regexStr += "([^.]+)"
        }
      }
    }

    regexStr += "$"
    return new RegExp(regexStr, "i")
  }

  /**
   * Generates a group name from extracted values
   */
  generateGroupName(
    patternInfo: SegmentPatternInfo,
    extractedValues: Record<string, string>,
    options: MatchOptions
  ): string {
    if (options.groupNameTemplate) {
      let groupName = options.groupNameTemplate
      for (const [key, value] of Object.entries(extractedValues)) {
        groupName = groupName.replace(`{${key}}`, value)
      }
      return groupName
    }

    const firstVariable = patternInfo.variables[0]
    if (firstVariable && extractedValues[firstVariable.name]) {
      return extractedValues[firstVariable.name]
    }

    return options.ruleName || "Extracted Group"
  }

  /**
   * Matches using regex patterns
   */
  matchRegex(url: string, pattern: string, options: MatchOptions = {}): MatchResult {
    try {
      const regexStr = pattern.slice(1, -1)
      const regex = new RegExp(regexStr, "i")

      const urlObj = new URL(url)
      const fullUrl = urlObj.hostname + urlObj.pathname

      const match = fullUrl.match(regex)
      if (!match) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      const extractedValues: Record<string, string> = {}
      if (match.length > 1) {
        for (let i = 1; i < match.length; i++) {
          extractedValues[`group${i}`] = match[i]
        }
      }

      const groupName = match[1] || options.ruleName || null

      return {
        matched: true,
        extractedValues,
        groupName
      }
    } catch {
      return { matched: false, extractedValues: {}, groupName: null }
    }
  }

  /**
   * Validates a pattern
   */
  validatePattern(pattern: string): PatternValidationResultWithType {
    if (!pattern || typeof pattern !== "string") {
      return {
        isValid: false,
        error: "Pattern must be a non-empty string",
        type: null
      }
    }

    const cleanPattern = pattern.trim()
    if (cleanPattern.length === 0) {
      return { isValid: false, error: "Pattern cannot be empty", type: null }
    }

    if (cleanPattern.length > 500) {
      return {
        isValid: false,
        error: "Pattern too long (max 500 characters)",
        type: null
      }
    }

    const patternType = this.detectPatternType(cleanPattern)

    switch (patternType) {
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return this.validateSegmentPattern(cleanPattern)
      case PATTERN_TYPES.REGEX:
        return this.validateRegexPattern(cleanPattern)
      default:
        return this.validateSimpleWildcardPattern(cleanPattern)
    }
  }

  /**
   * Validates a simple wildcard pattern
   */
  validateSimpleWildcardPattern(pattern: string): PatternValidationResultWithType {
    const hasPath = pattern.includes("/")
    const [domainPattern, pathPattern] = hasPath ? pattern.split("/", 2) : [pattern, ""]

    if (!domainPattern) {
      return {
        isValid: false,
        error: "Domain pattern cannot be empty",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    if (domainPattern.includes("***")) {
      return {
        isValid: false,
        error: "Invalid wildcard pattern (too many asterisks)",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    if (!/^[a-zA-Z0-9.*-]+$/.test(domainPattern)) {
      return {
        isValid: false,
        error: "Domain pattern contains invalid characters",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    if (hasPath && pathPattern && !/^[a-zA-Z0-9._/*-]*$/.test(pathPattern)) {
      return {
        isValid: false,
        error: "Path pattern contains invalid characters",
        type: PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    return { isValid: true, error: null, type: PATTERN_TYPES.SIMPLE_WILDCARD }
  }

  /**
   * Validates a segment extraction pattern
   */
  validateSegmentPattern(pattern: string): PatternValidationResultWithType {
    const info = this.parseSegmentPattern(pattern)

    if (!info.valid) {
      return {
        isValid: false,
        error: "Invalid segment pattern syntax",
        type: PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    if (info.variables.length === 0) {
      return {
        isValid: false,
        error: "Pattern must contain at least one {variable}",
        type: PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    const names = info.variables.map(v => v.name)
    if (new Set(names).size !== names.length) {
      return {
        isValid: false,
        error: "Duplicate variable names in pattern",
        type: PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    for (const variable of info.variables) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(variable.name)) {
        return {
          isValid: false,
          error: `Invalid variable name: ${variable.name}`,
          type: PATTERN_TYPES.SEGMENT_EXTRACTION
        }
      }
    }

    return {
      isValid: true,
      error: null,
      type: PATTERN_TYPES.SEGMENT_EXTRACTION
    }
  }

  /**
   * Validates a regex pattern
   */
  validateRegexPattern(pattern: string): PatternValidationResultWithType {
    if (!pattern.startsWith("/") || !pattern.endsWith("/")) {
      return {
        isValid: false,
        error: "Regex pattern must start and end with /",
        type: PATTERN_TYPES.REGEX
      }
    }

    const regexStr = pattern.slice(1, -1)
    if (regexStr.length === 0) {
      return {
        isValid: false,
        error: "Regex pattern cannot be empty",
        type: PATTERN_TYPES.REGEX
      }
    }

    try {
      new RegExp(regexStr)
      return { isValid: true, error: null, type: PATTERN_TYPES.REGEX }
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid regex: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: PATTERN_TYPES.REGEX
      }
    }
  }

  /**
   * Gets pattern type display name for UI
   */
  getPatternTypeDisplayName(patternType: PatternType): string {
    switch (patternType) {
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return "Segment Extraction"
      case PATTERN_TYPES.REGEX:
        return "Regular Expression"
      default:
        return "Simple Wildcard"
    }
  }

  /**
   * Gets help text for a pattern type
   */
  getPatternHelp(patternType: PatternType): string {
    switch (patternType) {
      case PATTERN_TYPES.SEGMENT_EXTRACTION:
        return "Use {variable} to extract segments. Example: {accountId}-*.{region}.console.aws.amazon.com"
      case PATTERN_TYPES.REGEX:
        return "Advanced regex patterns. Example: /^(\\d+)-.*\\.(\\w+)\\.console\\.aws\\.amazon\\.com$/"
      default:
        return "Use * for single segment, ** for multiple segments. Examples: *.example.com, domain.**, prefix-*.suffix.com"
    }
  }
}

// Export singleton instance
export const urlPatternMatcher = new UrlPatternMatcher()
