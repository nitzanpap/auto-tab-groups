/**
 * Utility functions for domain handling
 */

/**
 * Extracts the domain from a URL
 * @param {string} url The URL to extract domain from
 * @param {boolean} includeSubDomain Whether to include the subdomain
 * @returns {string|null} The extracted domain or null if invalid
 */
export function extractDomain(url, includeSubDomain = false) {
  // Return null early for empty, undefined, or invalid URLs
  if (!url || typeof url !== "string" || url.trim() === "") {
    return null
  }

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname

    // Skip IP addresses and localhost
    if (
      /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
      hostname === "localhost" ||
      hostname.endsWith(".local")
    ) {
      return null
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
    return null
  }
}

/**
 * Gets a display name for a domain by removing the TLD
 * @param {string} domain The domain to get display name for
 * @returns {string} The display name
 */
export function getDomainDisplayName(domain) {
  if (!domain) return ""

  // Handle IP addresses, localhost, and .local domains
  if (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) ||
    domain === "localhost" ||
    domain.endsWith(".local")
  ) {
    return domain
  }

  const parts = domain.split(".")
  // Remove the last part (TLD)
  const displayParts = parts.slice(0, -1)

  // Remove 'www' if it's the first part
  if (displayParts[0] === "www") {
    displayParts.shift()
  }

  return displayParts.join(".")
}
