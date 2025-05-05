// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.split(".")
    let domain = hostname

    if (parts.length >= 2) {
      // Get the base domain (last two parts)
      domain = parts.slice(-2).join(".")

      // Special case for country-specific TLDs like .co.uk, .com.au
      const secondLevelDomains = ["co", "com", "org", "net", "ac", "gov", "edu"]
      if (parts.length >= 3 && secondLevelDomains.includes(parts[parts.length - 2])) {
        domain = parts.slice(-3).join(".")
      }
    }

    return domain
  } catch (e) {
    console.error("Error extracting domain:", e)
    return ""
  }
}

// Store the last known domains for each tab
const tabDomains = new Map()

// Track tab groups by domain
const domainGroups = new Map()

// Track if auto-grouping is enabled
let autoGroupingEnabled = true

// Save auto-grouping state to storage
async function saveAutoGroupingState() {
  await browser.storage.local.set({ autoGroupingEnabled })
  console.log(`Auto-grouping state saved: ${autoGroupingEnabled}`)
}

// Load auto-grouping state from storage
async function loadAutoGroupingState() {
  const result = await browser.storage.local.get("autoGroupingEnabled")
  if (result.hasOwnProperty("autoGroupingEnabled")) {
    autoGroupingEnabled = result.autoGroupingEnabled
  }
  console.log(`Auto-grouping state loaded: ${autoGroupingEnabled}`)
  return autoGroupingEnabled
}

// Initialize state when the extension loads
loadAutoGroupingState()

/**
 * Get all tabs in the current window and group them by domain
 */
async function groupTabsByDomain() {
  try {
    // Get all tabs in the current window
    const tabs = await browser.tabs.query({ currentWindow: true })

    console.log("Grouping tabs:", tabs.length)

    // Map of domain -> tab ids
    const domainTabsMap = new Map()

    // Group tabs by domain
    for (const tab of tabs) {
      if (!tab.url) continue

      const domain = extractDomain(tab.url)
      if (!domain) continue

      // Update the domain tracking
      tabDomains.set(tab.id, domain)

      // Add tab to domain group
      if (!domainTabsMap.has(domain)) {
        domainTabsMap.set(domain, [])
      }
      domainTabsMap.get(domain).push(tab.id)
    }

    // Create tab groups for each domain
    for (const [domain, tabIds] of domainTabsMap.entries()) {
      if (tabIds.length === 0) continue

      // Create a new group for these tabs
      const groupId = await browser.tabs.group({ tabIds })

      // Store the group ID for this domain
      domainGroups.set(domain, groupId)

      // TODO: Set the group title once the API supports it
      // try {
      //   await browser.tabGroups.update(groupId, { title: domain })
      // } catch (e) {
      //   console.log("Could not set group title, API may not support it yet:", e)
      // }
    }

    console.log("Tab grouping complete. Domain groups:", [...domainGroups.entries()])
  } catch (error) {
    console.error("Error grouping tabs:", error)
  }
}

/**
 * Ungroup all tabs in the current window
 */
async function ungroupAllTabs() {
  try {
    const tabs = await browser.tabs.query({ currentWindow: true })
    for (const tab of tabs) {
      try {
        await browser.tabs.ungroup(tab.id)
      } catch (e) {
        console.error(`Error ungrouping tab ${tab.id}:`, e)
      }
    }

    // Clear domain groups tracking
    domainGroups.clear()
    console.log("All tabs ungrouped")
  } catch (error) {
    console.error("Error ungrouping tabs:", error)
  }
}

/**
 * Move a tab to the appropriate group based on its domain
 * @param {number} tabId - The ID of the tab to move
 */
async function moveTabToGroup(tabId) {
  // Only proceed if auto-grouping is enabled
  if (!autoGroupingEnabled) return

  try {
    const tab = await browser.tabs.get(tabId)
    if (!tab.url) return

    const domain = extractDomain(tab.url)
    if (!domain) return

    // Update domain tracking
    tabDomains.set(tabId, domain)

    // Check if we have a group for this domain
    if (domainGroups.has(domain)) {
      // Move tab to existing group
      await browser.tabs.group({
        tabIds: [tabId],
        groupId: domainGroups.get(domain),
      })
    } else {
      // Create a new group
      const groupId = await browser.tabs.group({ tabIds: [tabId] })
      domainGroups.set(domain, groupId)

      // TODO: Set the group title once the API supports it
      // try {
      //   await browser.tabGroups.update(groupId, { title: domain })
      // } catch (e) {
      //   console.log("Could not set group title, API may not support it yet:", e)
      // }
    }
  } catch (error) {
    console.error(`Error moving tab ${tabId} to group:`, error)
  }
}

/**
 * Check if a group is empty and remove it if so
 * @param {number} groupId - The ID of the group to check
 */
async function removeEmptyGroup(groupId) {
  try {
    const tabs = await browser.tabs.query({ groupId })
    if (tabs.length === 0) {
      // Find and remove the domain association
      for (const [domain, id] of domainGroups.entries()) {
        if (id === groupId) {
          domainGroups.delete(domain)
          break
        }
      }
    }
  } catch (error) {
    console.error(`Error checking empty group ${groupId}:`, error)
  }
}

// Listen for messages from popup
browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === "group") {
    groupTabsByDomain()
  } else if (msg.action === "ungroup") {
    ungroupAllTabs()
  } else if (msg.action === "getAutoGroupState") {
    return Promise.resolve({ enabled: autoGroupingEnabled })
  } else if (msg.action === "toggleAutoGroup") {
    autoGroupingEnabled = msg.enabled
    saveAutoGroupingState()

    // If auto-grouping is being enabled, immediately group all tabs
    if (autoGroupingEnabled) {
      groupTabsByDomain()
    }

    return Promise.resolve({ enabled: autoGroupingEnabled })
  }
})

// Track domain changes when tabs are updated
browser.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      const newDomain = extractDomain(changeInfo.url)
      const oldDomain = tabDomains.get(tabId) || ""

      // Only regroup if the domain has actually changed
      if (newDomain !== oldDomain) {
        console.log(`Tab ${tabId} domain changed: ${oldDomain} -> ${newDomain}`)
        moveTabToGroup(tabId)
      }
    }
  },
  { properties: ["url"] }
)

// Track domains when tabs are created
browser.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    const domain = extractDomain(tab.url)
    tabDomains.set(tab.id, domain)
    moveTabToGroup(tab.id)
  }
})

// Clean up when tabs are removed
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Remove from domain tracking
  tabDomains.delete(tabId)

  // Check if the tab's group is now empty
  if (removeInfo.groupId) {
    removeEmptyGroup(removeInfo.groupId)
  }
})

// If a tab is moved to a different window, move it to the appropriate group
browser.tabs.onMoved.addListener((tabId, moveInfo) => {
  moveTabToGroup(tabId)
})
