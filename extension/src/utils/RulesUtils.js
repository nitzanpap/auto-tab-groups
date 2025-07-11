/**
 * Utility functions for custom rules validation and processing
 */

/**
 * Checks if a string is an IPv4 address
 * @param {string} str - String to check
 * @returns {boolean} True if string is a valid IPv4 address
 */
export function isIPv4Address(str) {
  if (!str || typeof str !== "string") return false

  const parts = str.split(".")
  if (parts.length !== 4) return false

  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255 && part === num.toString() // No leading zeros
  })
}

/**
 * Checks if a string is an IPv4 pattern with wildcards
 * @param {string} str - String to check
 * @returns {boolean} True if string is a valid IPv4 pattern
 */
export function isIPv4Pattern(str) {
  if (!str || typeof str !== "string") return false

  const parts = str.split(".")
  if (parts.length !== 4) return false

  return parts.every(part => {
    if (part === "*") return true
    if (!/^\d+$/.test(part)) return false
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255 && part === num.toString() // No leading zeros
  })
}

/**
 * Validates an IPv4 pattern (exact IP or with wildcards)
 * @param {string} pattern - IPv4 pattern to validate
 * @returns {Object} Validation result with isValid and error message
 */
export function validateIPv4Pattern(pattern) {
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

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (part === "*") {
      continue // Wildcard is valid
    }

    if (!/^\d+$/.test(part)) {
      return { isValid: false, error: `Invalid IPv4 octet "${part}". Must be 0-255 or *` }
    }

    const num = parseInt(part, 10)

    if (num < 0 || num > 255) {
      return { isValid: false, error: `IPv4 octet "${part}" must be between 0 and 255` }
    }

    if (part !== num.toString()) {
      return { isValid: false, error: `IPv4 octet "${part}" cannot have leading zeros` }
    }
  }

  return { isValid: true }
}

/**
 * Matches an IPv4 address against an IPv4 pattern
 * @param {string} ip - IPv4 address to match
 * @param {string} pattern - IPv4 pattern (may contain wildcards)
 * @returns {boolean} True if IP matches pattern
 */
export function matchIPv4(ip, pattern) {
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
      continue // Wildcard matches anything
    }

    if (ipParts[i] !== patternParts[i]) {
      return false
    }
  }

  return true
}

/**
 * Validates a pattern string format for custom rules (supports domains and IP addresses)
 * @param {string} pattern - Pattern to validate (supports *.domain.com format and IPv4 addresses)
 * @returns {Object} Validation result with isValid and error message
 */
export function validateRulePattern(pattern) {
  if (!pattern || typeof pattern !== "string") {
    return { isValid: false, error: "Pattern must be a string" }
  }

  const cleanPattern = pattern.trim().toLowerCase()

  if (cleanPattern.length === 0) {
    return { isValid: false, error: "Pattern cannot be empty" }
  }

  if (cleanPattern.length > 253) {
    return { isValid: false, error: "Pattern too long (max 253 characters)" }
  }

  // Check if it's an IPv4 pattern
  if (isIPv4Pattern(cleanPattern)) {
    return validateIPv4Pattern(cleanPattern)
  }

  // Check for wildcard pattern (*.domain.com)
  if (cleanPattern.startsWith("*.")) {
    const baseDomain = cleanPattern.substring(2) // Remove "*."

    // Validate wildcard pattern
    if (!baseDomain || baseDomain.includes("*")) {
      return { isValid: false, error: "Invalid wildcard pattern. Use format: *.domain.com" }
    }

    // Validate the base domain part
    const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!domainPattern.test(baseDomain)) {
      return { isValid: false, error: "Invalid base domain in wildcard pattern" }
    }

    return { isValid: true }
  }

  // Regular domain validation
  const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  if (!domainPattern.test(cleanPattern)) {
    return { isValid: false, error: "Invalid domain format" }
  }

  // Check for invalid patterns
  if (cleanPattern.startsWith(".") || cleanPattern.endsWith(".")) {
    return { isValid: false, error: "Domain cannot start or end with a dot" }
  }

  if (cleanPattern.includes("..")) {
    return { isValid: false, error: "Domain cannot contain consecutive dots" }
  }

  if (cleanPattern.startsWith("-") || cleanPattern.endsWith("-")) {
    return { isValid: false, error: "Domain cannot start or end with a hyphen" }
  }

  return { isValid: true, error: null }
}

/**
 * Validates a domain string format for custom rules (supports wildcards)
 * @deprecated Use validateRulePattern instead
 * @param {string} domain - Domain to validate (supports *.domain.com format for rules)
 * @returns {Object} Validation result with isValid and error message
 */
export function validateRuleDomain(domain) {
  return validateRulePattern(domain)
}

/**
 * Parses a multi-line string of domains into an array
 * @param {string} domainsText - Multi-line text with domains
 * @returns {Array} Array of cleaned domain strings
 */
export function parseDomainsText(domainsText) {
  if (!domainsText || typeof domainsText !== "string") {
    return []
  }

  return domainsText
    .split("\n")
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0)
    .filter((domain, index, arr) => arr.indexOf(domain) === index) // Remove duplicates
}

/**
 * Validates a rule name
 * @param {string} name - Rule name to validate
 * @returns {Object} Validation result with isValid and error message
 */
export function validateRuleName(name) {
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

  // Check for valid characters (letters, numbers, spaces, basic punctuation)
  const namePattern = /^[a-zA-Z0-9\s\-_()&.!?]+$/

  if (!namePattern.test(cleanName)) {
    return { isValid: false, error: "Rule name contains invalid characters" }
  }

  return { isValid: true, error: null }
}

/**
 * Sanitizes patterns array by removing invalid entries and duplicates
 * @param {Array} patterns - Array of pattern strings (domains or IP addresses)
 * @returns {Array} Cleaned array of valid patterns
 */
export function sanitizePatterns(patterns) {
  if (!Array.isArray(patterns)) {
    return []
  }

  const validPatterns = []
  const seen = new Set()

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
 * Sanitizes domains array by removing invalid entries and duplicates
 * @deprecated Use sanitizePatterns instead
 * @param {Array} domains - Array of domain strings
 * @returns {Array} Cleaned array of valid domains
 */
export function sanitizeDomains(domains) {
  return sanitizePatterns(domains)
}

/**
 * Generates a formatted display string for domains
 * @param {Array} domains - Array of domain strings
 * @param {number} maxLength - Maximum length of display string
 * @returns {string} Formatted display string
 */
export function formatDomainsDisplay(domains, maxLength = 40) {
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

  // Truncate and add "and X more"
  let truncated = ""
  let count = 0

  for (const domain of domains) {
    if (truncated.length + domain.length + 2 <= maxLength - 10) {
      // Leave space for "and X more"
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
 * Available colors for custom rules
 */
export const RULE_COLORS = [
  { name: "Blue", value: "blue", hex: "#4285f4" },
  { name: "Red", value: "red", hex: "#ea4335" },
  { name: "Yellow", value: "yellow", hex: "#fbbc04" },
  { name: "Green", value: "green", hex: "#34a853" },
  { name: "Pink", value: "pink", hex: "#ff6d9d" },
  { name: "Purple", value: "purple", hex: "#9c27b0" },
  { name: "Cyan", value: "cyan", hex: "#00acc1" },
  { name: "Orange", value: "orange", hex: "#ff9800" }
]

/**
 * Gets color information by color value
 * @param {string} colorValue - Color value (e.g., 'blue')
 * @returns {Object|null} Color object or null if not found
 */
export function getColorInfo(colorValue) {
  return RULE_COLORS.find(color => color.value === colorValue) || null
}

/**
 * Validates rule data comprehensively
 * @param {Object} ruleData - Rule data to validate
 * @param {Array} existingRules - Array of existing rules to check for conflicts
 * @returns {Object} Validation result with isValid, errors, and warnings
 */
export function validateRuleData(ruleData, existingRules = []) {
  const errors = []
  const warnings = []

  // Validate name
  const nameValidation = validateRuleName(ruleData.name)
  if (!nameValidation.isValid) {
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
    // Validate each pattern (domain or IP)
    const validPatterns = []
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
  if (ruleData.color && !getColorInfo(ruleData.color)) {
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
 * @param {Object} ruleData - Input rule data
 * @returns {Object} Safe rule object with all required fields
 */
export function createSafeRule(ruleData) {
  return {
    id: ruleData.id || `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: (ruleData.name || "").trim() || "Unnamed Rule",
    domains: sanitizePatterns(ruleData.domains || []),
    color: getColorInfo(ruleData.color) ? ruleData.color : "blue",
    enabled: ruleData.enabled !== false,
    priority:
      typeof ruleData.priority === "number" && ruleData.priority > 0 ? ruleData.priority : 1,
    createdAt: ruleData.createdAt || new Date().toISOString()
  }
}
