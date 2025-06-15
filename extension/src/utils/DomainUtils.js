/**
 * Utility functions for domain handling
 */

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

    return parts.slice(-2).join(".")
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

    // Remove the last part (TLD)
    const displayParts = parts.slice(0, -1)

    // Remove 'www' if it's the first part
    if (displayParts[0] === "www") {
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
