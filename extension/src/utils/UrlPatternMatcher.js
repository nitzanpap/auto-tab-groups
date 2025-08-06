/**
 * Single Source of Truth for URL Pattern Matching
 * Handles all URL pattern matching logic for the extension
 */

class UrlPatternMatcher {
  constructor() {
    // Pattern type identifiers
    this.PATTERN_TYPES = {
      SIMPLE_WILDCARD: "simple_wildcard",
      SEGMENT_EXTRACTION: "segment_extraction",
      REGEX: "regex"
    }
  }

  /**
   * Main entry point - matches a URL against a pattern
   * @param {string} url - The full URL to match
   * @param {string} pattern - The pattern to match against
   * @param {Object} options - Matching options
   * @returns {Object} Match result with {matched: boolean, extractedValues: Object, groupName: string}
   */
  match(url, pattern, options = {}) {
    if (!url || !pattern) {
      return { matched: false, extractedValues: {}, groupName: null }
    }

    // Detect pattern type
    const patternType = this.detectPatternType(pattern)

    switch (patternType) {
      case this.PATTERN_TYPES.SEGMENT_EXTRACTION:
        return this.matchSegmentExtraction(url, pattern, options)
      case this.PATTERN_TYPES.REGEX:
        return this.matchRegex(url, pattern, options)
      default:
        return this.matchSimpleWildcard(url, pattern, options)
    }
  }

  /**
   * Detects the type of pattern
   * @param {string} pattern - The pattern to analyze
   * @returns {string} Pattern type identifier
   */
  detectPatternType(pattern) {
    // Check for segment extraction patterns (contains {variable})
    if (/\{[^}]+\}/.test(pattern)) {
      return this.PATTERN_TYPES.SEGMENT_EXTRACTION
    }

    // Check for regex patterns (starts and ends with /)
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      return this.PATTERN_TYPES.REGEX
    }

    // Default to simple wildcard
    return this.PATTERN_TYPES.SIMPLE_WILDCARD
  }

  /**
   * Matches using simple wildcard patterns (backward compatible)
   * @param {string} url - The URL to match
   * @param {string} pattern - The wildcard pattern
   * @param {Object} options - Matching options
   * @returns {Object} Match result
   */
  matchSimpleWildcard(url, pattern, options = {}) {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()
      const pathname = urlObj.pathname.toLowerCase()
      const cleanPattern = pattern.toLowerCase().trim()

      // Check if pattern includes a path
      const hasPath = cleanPattern.includes("/")
      const [domainPattern, pathPattern] = hasPath ? cleanPattern.split("/", 2) : [cleanPattern, ""]

      // Match domain part
      const domainMatch = this.matchDomainWildcard(hostname, domainPattern)
      if (!domainMatch) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // Match path part if specified
      if (hasPath && !this.matchPathWildcard(pathname, pathPattern)) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // For simple wildcards, group name is typically provided by the rule
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
   * @param {string} domain - The domain to match
   * @param {string} pattern - The domain pattern
   * @returns {boolean} True if matches
   */
  matchDomainWildcard(domain, pattern) {
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
      return cleanDomain === baseDomain || cleanDomain.endsWith("." + baseDomain)
    }

    // Handle middle wildcards (new enhancement for AWS-style patterns)
    if (cleanPattern.includes("*") && !cleanPattern.startsWith("*")) {
      return this.matchMiddleWildcard(cleanDomain, cleanPattern)
    }

    // Exact match
    return cleanDomain === cleanPattern
  }

  /**
   * Matches patterns with wildcards in the middle (e.g., prefix-*.suffix.com)
   * @param {string} domain - The domain to match
   * @param {string} pattern - The pattern with middle wildcards
   * @returns {boolean} True if matches
   */
  matchMiddleWildcard(domain, pattern) {
    // Convert pattern to regex, escaping special chars except *
    const regexPattern = pattern
      .split("*")
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^.]*") // * matches any characters except dots

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(domain)
  }

  /**
   * Matches path with wildcard support
   * @param {string} path - The URL path to match
   * @param {string} pattern - The path pattern
   * @returns {boolean} True if matches
   */
  matchPathWildcard(path, pattern) {
    if (!pattern) return true // Empty pattern matches any path

    const cleanPath = path.startsWith("/") ? path.substring(1) : path
    const cleanPattern = pattern.startsWith("/") ? pattern.substring(1) : pattern

    // Handle ** wildcard in path
    if (cleanPattern.includes("**")) {
      const parts = cleanPattern.split("**")
      if (parts.length !== 2) return false

      const prefix = parts[0]
      const suffix = parts[1]

      if (prefix && !cleanPath.startsWith(prefix)) return false
      if (suffix && !cleanPath.endsWith(suffix)) return false

      return true
    }

    // Exact prefix matching
    return cleanPath.startsWith(cleanPattern)
  }

  /**
   * Matches using segment extraction patterns (for AWS-style URLs)
   * @param {string} url - The URL to match
   * @param {string} pattern - Pattern with {variable} placeholders
   * @param {Object} options - Matching options
   * @returns {Object} Match result with extracted values
   */
  matchSegmentExtraction(url, pattern, options = {}) {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()
      const pathname = urlObj.pathname

      // Parse the pattern to identify extraction points
      const patternInfo = this.parseSegmentPattern(pattern)
      if (!patternInfo.valid) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // Check if pattern includes path
      let targetString = hostname
      if (pattern.includes("/")) {
        targetString = hostname + pathname
      }

      // Build regex from pattern
      const regex = this.buildSegmentRegex(patternInfo)
      const match = targetString.match(regex)

      if (!match) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // Extract values
      const extractedValues = {}
      patternInfo.variables.forEach((variable, index) => {
        extractedValues[variable.name] = match[index + 1]
      })

      // Generate group name
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
   * @param {string} pattern - Pattern with {variable} placeholders
   * @returns {Object} Parsed pattern information
   */
  parseSegmentPattern(pattern) {
    const variables = []
    const parts = []
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
   * Parses a variable specification (e.g., "accountId" or "accountId:segment:dash")
   * @param {string} spec - Variable specification
   * @returns {Object} Parsed variable info
   */
  parseVariableSpec(spec) {
    const parts = spec.split(":")
    const name = parts[0]
    const type = parts[1] || "segment" // Default to segment type
    const delimiter = parts[2] || null

    return { name, type, delimiter }
  }

  /**
   * Builds a regex from a parsed segment pattern
   * @param {Object} patternInfo - Parsed pattern information
   * @returns {RegExp} Regular expression for matching
   */
  buildSegmentRegex(patternInfo) {
    let regexStr = "^"

    for (const part of patternInfo.parts) {
      if (part.type === "literal") {
        // Escape special regex characters in literal parts
        let literal = part.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        // Convert * wildcards to regex
        literal = literal.replace(/\\\*/g, "[^.]*")
        regexStr += literal
      } else if (part.type === "variable") {
        const variable = part.value
        if (variable.delimiter === "dash") {
          // Match until dash
          regexStr += "([^-]+)"
        } else if (variable.delimiter === "dot") {
          // Match until dot
          regexStr += "([^.]+)"
        } else {
          // Default: match a full segment between dots
          regexStr += "([^.]+)"
        }
      }
    }

    regexStr += "$"
    return new RegExp(regexStr, "i")
  }

  /**
   * Generates a group name from extracted values
   * @param {Object} patternInfo - Parsed pattern information
   * @param {Object} extractedValues - Extracted variable values
   * @param {Object} options - Options including groupNameTemplate
   * @returns {string} Generated group name
   */
  generateGroupName(patternInfo, extractedValues, options) {
    if (options.groupNameTemplate) {
      // Replace {variables} in template with extracted values
      let groupName = options.groupNameTemplate
      for (const [key, value] of Object.entries(extractedValues)) {
        groupName = groupName.replace(`{${key}}`, value)
      }
      return groupName
    }

    // Default: use the first extracted value or the rule name
    const firstVariable = patternInfo.variables[0]
    if (firstVariable && extractedValues[firstVariable.name]) {
      return extractedValues[firstVariable.name]
    }

    return options.ruleName || "Extracted Group"
  }

  /**
   * Matches using regex patterns (advanced users)
   * @param {string} url - The URL to match
   * @param {string} pattern - Regex pattern (without delimiters)
   * @param {Object} options - Matching options
   * @returns {Object} Match result
   */
  matchRegex(url, pattern, options = {}) {
    try {
      // Remove leading and trailing slashes from regex pattern
      const regexStr = pattern.slice(1, -1)
      const regex = new RegExp(regexStr, "i")

      const urlObj = new URL(url)
      const fullUrl = urlObj.hostname + urlObj.pathname

      const match = fullUrl.match(regex)
      if (!match) {
        return { matched: false, extractedValues: {}, groupName: null }
      }

      // Extract captured groups
      const extractedValues = {}
      if (match.length > 1) {
        for (let i = 1; i < match.length; i++) {
          extractedValues[`group${i}`] = match[i]
        }
      }

      // Generate group name from first captured group or use rule name
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
   * @param {string} pattern - The pattern to validate
   * @returns {Object} Validation result with {isValid: boolean, error: string, type: string}
   */
  validatePattern(pattern) {
    if (!pattern || typeof pattern !== "string") {
      return { isValid: false, error: "Pattern must be a non-empty string", type: null }
    }

    const cleanPattern = pattern.trim()
    if (cleanPattern.length === 0) {
      return { isValid: false, error: "Pattern cannot be empty", type: null }
    }

    if (cleanPattern.length > 500) {
      return { isValid: false, error: "Pattern too long (max 500 characters)", type: null }
    }

    const patternType = this.detectPatternType(cleanPattern)

    switch (patternType) {
      case this.PATTERN_TYPES.SEGMENT_EXTRACTION:
        return this.validateSegmentPattern(cleanPattern)
      case this.PATTERN_TYPES.REGEX:
        return this.validateRegexPattern(cleanPattern)
      default:
        return this.validateSimpleWildcardPattern(cleanPattern)
    }
  }

  /**
   * Validates a simple wildcard pattern
   * @param {string} pattern - The pattern to validate
   * @returns {Object} Validation result
   */
  validateSimpleWildcardPattern(pattern) {
    // Check if it has a path component
    const hasPath = pattern.includes("/")
    const [domainPattern, pathPattern] = hasPath ? pattern.split("/", 2) : [pattern, ""]

    // Validate domain part
    if (!domainPattern) {
      return {
        isValid: false,
        error: "Domain pattern cannot be empty",
        type: this.PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    // Check for invalid wildcard combinations
    if (domainPattern.includes("***")) {
      return {
        isValid: false,
        error: "Invalid wildcard pattern (too many asterisks)",
        type: this.PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    // Basic domain character validation (allow wildcards)
    if (!/^[a-zA-Z0-9.*-]+$/.test(domainPattern)) {
      return {
        isValid: false,
        error: "Domain pattern contains invalid characters",
        type: this.PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    // Validate path part if present
    if (hasPath && pathPattern && !/^[a-zA-Z0-9._/*-]*$/.test(pathPattern)) {
      return {
        isValid: false,
        error: "Path pattern contains invalid characters",
        type: this.PATTERN_TYPES.SIMPLE_WILDCARD
      }
    }

    return { isValid: true, error: null, type: this.PATTERN_TYPES.SIMPLE_WILDCARD }
  }

  /**
   * Validates a segment extraction pattern
   * @param {string} pattern - The pattern to validate
   * @returns {Object} Validation result
   */
  validateSegmentPattern(pattern) {
    const info = this.parseSegmentPattern(pattern)

    if (!info.valid) {
      return {
        isValid: false,
        error: "Invalid segment pattern syntax",
        type: this.PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    if (info.variables.length === 0) {
      return {
        isValid: false,
        error: "Pattern must contain at least one {variable}",
        type: this.PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    // Check for duplicate variable names
    const names = info.variables.map(v => v.name)
    if (new Set(names).size !== names.length) {
      return {
        isValid: false,
        error: "Duplicate variable names in pattern",
        type: this.PATTERN_TYPES.SEGMENT_EXTRACTION
      }
    }

    // Validate variable names
    for (const variable of info.variables) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(variable.name)) {
        return {
          isValid: false,
          error: `Invalid variable name: ${variable.name}`,
          type: this.PATTERN_TYPES.SEGMENT_EXTRACTION
        }
      }
    }

    return { isValid: true, error: null, type: this.PATTERN_TYPES.SEGMENT_EXTRACTION }
  }

  /**
   * Validates a regex pattern
   * @param {string} pattern - The regex pattern to validate
   * @returns {Object} Validation result
   */
  validateRegexPattern(pattern) {
    if (!pattern.startsWith("/") || !pattern.endsWith("/")) {
      return {
        isValid: false,
        error: "Regex pattern must start and end with /",
        type: this.PATTERN_TYPES.REGEX
      }
    }

    const regexStr = pattern.slice(1, -1)
    if (regexStr.length === 0) {
      return {
        isValid: false,
        error: "Regex pattern cannot be empty",
        type: this.PATTERN_TYPES.REGEX
      }
    }

    try {
      new RegExp(regexStr)
      return { isValid: true, error: null, type: this.PATTERN_TYPES.REGEX }
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid regex: ${error.message}`,
        type: this.PATTERN_TYPES.REGEX
      }
    }
  }

  /**
   * Gets pattern type display name for UI
   * @param {string} patternType - The pattern type identifier
   * @returns {string} Display name
   */
  getPatternTypeDisplayName(patternType) {
    switch (patternType) {
      case this.PATTERN_TYPES.SEGMENT_EXTRACTION:
        return "Segment Extraction"
      case this.PATTERN_TYPES.REGEX:
        return "Regular Expression"
      default:
        return "Simple Wildcard"
    }
  }

  /**
   * Gets help text for a pattern type
   * @param {string} patternType - The pattern type identifier
   * @returns {string} Help text
   */
  getPatternHelp(patternType) {
    switch (patternType) {
      case this.PATTERN_TYPES.SEGMENT_EXTRACTION:
        return "Use {variable} to extract segments. Example: {accountId}-*.{region}.console.aws.amazon.com"
      case this.PATTERN_TYPES.REGEX:
        return "Advanced regex patterns. Example: /^(\\d+)-.*\\.(\\w+)\\.console\\.aws\\.amazon\\.com$/"
      default:
        return "Use * for single segment, ** for multiple segments. Examples: *.example.com, domain.**, prefix-*.suffix.com"
    }
  }
}

// Export singleton instance
export const urlPatternMatcher = new UrlPatternMatcher()
