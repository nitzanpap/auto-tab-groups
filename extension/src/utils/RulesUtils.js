/**
 * Utility functions for custom rules validation and processing
 */

/**
 * Validates a domain string format for custom rules (supports wildcards)
 * @param {string} domain - Domain to validate (supports *.domain.com format for rules)
 * @returns {Object} Validation result with isValid and error message
 */
export function validateRuleDomain(domain) {
  if (!domain || typeof domain !== "string") {
    return { isValid: false, error: "Domain must be a string" }
  }

  const cleanDomain = domain.trim().toLowerCase()

  if (cleanDomain.length === 0) {
    return { isValid: false, error: "Domain cannot be empty" }
  }

  if (cleanDomain.length > 253) {
    return { isValid: false, error: "Domain too long (max 253 characters)" }
  }

  // Check for wildcard pattern (*.domain.com)
  if (cleanDomain.startsWith("*.")) {
    const baseDomain = cleanDomain.substring(2) // Remove "*."

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

  if (!domainPattern.test(cleanDomain)) {
    return { isValid: false, error: "Invalid domain format" }
  }

  // Check for invalid patterns
  if (cleanDomain.startsWith(".") || cleanDomain.endsWith(".")) {
    return { isValid: false, error: "Domain cannot start or end with a dot" }
  }

  if (cleanDomain.includes("..")) {
    return { isValid: false, error: "Domain cannot contain consecutive dots" }
  }

  if (cleanDomain.startsWith("-") || cleanDomain.endsWith("-")) {
    return { isValid: false, error: "Domain cannot start or end with a hyphen" }
  }

  return { isValid: true, error: null }
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
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0)
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
 * Sanitizes domains array by removing invalid entries and duplicates
 * @param {Array} domains - Array of domain strings
 * @returns {Array} Cleaned array of valid domains
 */
export function sanitizeDomains(domains) {
  if (!Array.isArray(domains)) {
    return []
  }

  const validDomains = []
  const seen = new Set()

  for (const domain of domains) {
    const validation = validateRuleDomain(domain)
    if (validation.isValid) {
      const cleanDomain = domain.trim().toLowerCase()
      if (!seen.has(cleanDomain)) {
        validDomains.push(cleanDomain)
        seen.add(cleanDomain)
      }
    }
  }

  return validDomains
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
  { name: "Orange", value: "orange", hex: "#ff9800" },
]

/**
 * Gets color information by color value
 * @param {string} colorValue - Color value (e.g., 'blue')
 * @returns {Object|null} Color object or null if not found
 */
export function getColorInfo(colorValue) {
  return RULE_COLORS.find((color) => color.value === colorValue) || null
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
    (rule) =>
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
    // Validate each domain
    const validDomains = []
    for (const domain of ruleData.domains) {
      const validation = validateRuleDomain(domain)
      if (!validation.isValid) {
        errors.push(`Invalid domain "${domain}": ${validation.error}`)
      } else {
        validDomains.push(domain.trim().toLowerCase())
      }
    }

    // Check for domain conflicts with other rules
    for (const existingRule of existingRules) {
      if (existingRule.id === ruleData.id) continue

      const conflicts = validDomains.filter((domain) => existingRule.domains.includes(domain))

      if (conflicts.length > 0) {
        warnings.push(
          `Domain(s) ${conflicts.join(", ")} already exist in rule "${existingRule.name}"`
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
    warnings,
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
    domains: sanitizeDomains(ruleData.domains || []),
    color: getColorInfo(ruleData.color) ? ruleData.color : "blue",
    enabled: ruleData.enabled !== false,
    priority:
      typeof ruleData.priority === "number" && ruleData.priority > 0 ? ruleData.priority : 1,
    createdAt: ruleData.createdAt || new Date().toISOString(),
  }
}
