/**
 * Utility functions for domain handling
 */

// Common country code second-level domains that should be treated as single TLD units
const COUNTRY_CODE_SLDS = new Set([
  "co.uk",
  "org.uk",
  "net.uk",
  "ac.uk",
  "gov.uk",
  "co.il",
  "org.il",
  "net.il",
  "ac.il",
  "gov.il",
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "co.nz",
  "net.nz",
  "org.nz",
  "ac.nz",
  "govt.nz",
  "co.za",
  "org.za",
  "net.za",
  "ac.za",
  "gov.za",
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "go.jp",
  "co.kr",
  "or.kr",
  "ne.kr",
  "ac.kr",
  "go.kr",
  "com.br",
  "org.br",
  "net.br",
  "edu.br",
  "gov.br",
  "com.cn",
  "org.cn",
  "net.cn",
  "edu.cn",
  "gov.cn",
  "com.mx",
  "org.mx",
  "net.mx",
  "edu.mx",
  "gob.mx",
  "co.in",
  "org.in",
  "net.in",
  "edu.in",
  "gov.in",
  "com.sg",
  "org.sg",
  "net.sg",
  "edu.sg",
  "gov.sg",
])

/**
 * Gets the effective TLD length for a hostname (handles ccSLDs)
 * @param {string} hostname The hostname to analyze
 * @returns {number} Number of parts that make up the effective TLD
 */
function getEffectiveTldLength(hostname) {
  const parts = hostname.split(".")

  // Check for country code second-level domains
  if (parts.length >= 2) {
    const lastTwoParts = parts.slice(-2).join(".")
    if (COUNTRY_CODE_SLDS.has(lastTwoParts)) {
      return 2 // ccSLD takes 2 parts (e.g., "co.il")
    }
  }

  return 1 // Regular TLD takes 1 part (e.g., "com")
}

/**
 * Extracts the domain from a URL
 * @param {string} url The URL to extract domain from
 * @param {boolean} includeSubDomain Whether to include the subdomain
 * @returns {string|null} The extracted domain or "system" for browser/extension URLs
 */
export function extractDomain(url, includeSubDomain = false) {
  // Return null early for empty, undefined, or invalid URLs
  if (!url || typeof url !== "string" || url.trim() === "") {
    return null
  }

  try {
    const urlObj = new URL(url)
    const { protocol, hostname } = urlObj

    // Handle browser-specific and extension URLs
    if (
      protocol === "chrome:" ||
      protocol === "chrome-extension:" ||
      protocol === "moz-extension:" ||
      protocol === "about:" ||
      protocol === "edge:" ||
      protocol === "safari:" ||
      hostname === "" ||
      !hostname.includes(".")
    ) {
      return "system"
    }

    if (includeSubDomain) {
      return hostname
    }

    const parts = hostname.split(".")
    if (parts.length <= 2) {
      return hostname
    }

    // Use effective TLD length to properly extract domain
    const tldLength = getEffectiveTldLength(hostname)
    const domainLength = tldLength + 1 // TLD + domain name

    if (parts.length <= domainLength) {
      return hostname
    }

    return parts.slice(-domainLength).join(".")
  } catch (error) {
    console.error(`[extractDomain] Error extracting domain from ${url}:`, error)
    return "system" // Fallback to system group for invalid URLs
  }
}

/**
 * Gets a display name for a domain by removing the TLD
 * @param {string} domain The domain to get display name for
 * @returns {string} The display name
 */
export function getDomainDisplayName(domain) {
  if (!domain) return ""

  try {
    // Handle system/browser URLs - group them all together
    if (domain === "system") {
      return "System"
    }

    const parts = domain.split(".")

    // If domain has no TLD (single word), return it capitalized
    if (parts.length === 1) {
      return domain.charAt(0).toUpperCase() + domain.slice(1)
    }

    // Use effective TLD length to properly remove TLD parts
    const tldLength = getEffectiveTldLength(domain)
    const displayParts = parts.slice(0, -tldLength)

    // Remove 'www' if it's the first part
    if (displayParts.length > 0 && displayParts[0] === "www") {
      displayParts.shift()
    }

    const displayName = displayParts.join(".")

    // If we end up with an empty string, return the original domain
    return displayName || domain
  } catch (error) {
    console.error(`[getDomainDisplayName] Error getting display name for ${domain}:`, error)
    return domain // Fallback to original domain if error occurs
  }
}

/**
 * Validates a strict domain format (NO wildcards allowed)
 * Use this for validating actual domains, not rule patterns
 * @param {string} domain - Domain to validate (no wildcards allowed)
 * @returns {Object} Validation result with isValid and error message
 */
export function validateStrictDomain(domain) {
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

  // Reject wildcards - this is for strict domain validation
  if (cleanDomain.includes("*")) {
    return { isValid: false, error: "Wildcards not allowed in domain format" }
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
