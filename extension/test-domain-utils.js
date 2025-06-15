/**
 * Test the getDomainDisplayName function fix
 */

// Import the function (this is a mock test to verify logic)
function getDomainDisplayName(domain) {
  if (!domain) return ""

  try {
    // Handle special cases (chrome extensions, internal pages, etc.)
    const specialCases = {
      extensions: "Extensions",
      newtab: "New Tab",
      settings: "Settings",
      history: "History",
      bookmarks: "Bookmarks",
      downloads: "Downloads",
    }

    if (specialCases[domain]) {
      return specialCases[domain]
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

// Test cases
console.log("Testing getDomainDisplayName function:")
console.log("extensions ->", getDomainDisplayName("extensions")) // Should be "Extensions"
console.log("newtab ->", getDomainDisplayName("newtab")) // Should be "New Tab"
console.log("github.com ->", getDomainDisplayName("github.com")) // Should be "github"
console.log("chatgpt.com ->", getDomainDisplayName("chatgpt.com")) // Should be "chatgpt"
console.log("mozilla.org ->", getDomainDisplayName("mozilla.org")) // Should be "mozilla"
console.log("youtube.com ->", getDomainDisplayName("youtube.com")) // Should be "youtube"
console.log("unknown ->", getDomainDisplayName("unknown")) // Should be "Unknown"
