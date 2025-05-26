// Store the last known domains for each tab
const tabDomains = new Map()

// Track tab groups by domain
const domainGroups = new Map()

// Track if auto-grouping is enabled
let autoGroupingEnabled = true
let onlyApplyToNewTabsEnabled = false
let groupBySubDomainEnabled = true

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.split(".")

    if (groupBySubDomainEnabled) {
      return hostname
    }

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

// Save auto-grouping state to storage
async function saveAutoGroupingState() {
  await browser.storage.local.set({
    autoGroupingEnabled,
    onlyApplyToNewTabsEnabled,
    groupBySubDomainEnabled,
  })
  console.log(
    `Auto-grouping state saved: ${autoGroupingEnabled}, only new tabs: ${onlyApplyToNewTabsEnabled}, group by subdomain: ${groupBySubDomainEnabled}`
  )
}

// Load auto-grouping state from storage
async function loadAutoGroupingState() {
  const result = await browser.storage.local.get({
    autoGroupingEnabled: true,
    onlyApplyToNewTabsEnabled: false,
    groupBySubDomainEnabled: true,
  })

  autoGroupingEnabled = result.autoGroupingEnabled
  onlyApplyToNewTabsEnabled = result.onlyApplyToNewTabsEnabled
  groupBySubDomainEnabled = result.groupBySubDomainEnabled

  console.log(
    `Auto-grouping state loaded: ${autoGroupingEnabled}, only new tabs: ${onlyApplyToNewTabsEnabled}, group by subdomain: ${groupBySubDomainEnabled}`
  )
  return { autoGroupingEnabled, onlyApplyToNewTabsEnabled, groupBySubDomainEnabled }
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

      // Set the group title if the API is available
      if (browser.tabGroups) {
        try {
          await browser.tabGroups.update(groupId, { title: domain })
        } catch (e) {
          console.log("Error setting group title:", e)
        }
      } else {
        console.log("tabGroups API not available in this browser version")
      }
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
 * @param {boolean} isNewTab - Whether this is a newly created tab
 */
async function moveTabToGroup(tabId, isNewTab = false) {
  // Only proceed if auto-grouping is enabled
  if (!autoGroupingEnabled) return

  // If only applying to new tabs is enabled, skip unless this is a new tab
  if (onlyApplyToNewTabsEnabled && !isNewTab) return

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

function main() {
  // Listen for messages from popup
  browser.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === "group") {
      groupTabsByDomain()
      return Promise.resolve({ success: true })
    }

    if (msg.action === "ungroup") {
      ungroupAllTabs()
      return Promise.resolve({ success: true })
    }

    if (msg.action === "getAutoGroupState") {
      return Promise.resolve({ enabled: autoGroupingEnabled })
    }

    if (msg.action === "getOnlyApplyToNewTabs") {
      return Promise.resolve({ enabled: onlyApplyToNewTabsEnabled })
    }

    if (msg.action === "toggleAutoGroup") {
      autoGroupingEnabled = msg.enabled
      saveAutoGroupingState()

      // If auto-grouping is being enabled, immediately group all tabs
      if (autoGroupingEnabled && !onlyApplyToNewTabsEnabled) {
        groupTabsByDomain()
      }

      return Promise.resolve({ enabled: autoGroupingEnabled })
    }

    if (msg.action === "toggleOnlyNewTabs") {
      onlyApplyToNewTabsEnabled = msg.enabled
      saveAutoGroupingState()
      return Promise.resolve({ enabled: onlyApplyToNewTabsEnabled })
    }

    if (msg.action === "getGroupBySubDomain") {
      return Promise.resolve({ enabled: groupBySubDomainEnabled })
    }

    if (msg.action === "toggleGroupBySubDomain") {
      groupBySubDomainEnabled = msg.enabled
      saveAutoGroupingState()

      // Regroup all tabs when the setting changes
      if (autoGroupingEnabled && !onlyApplyToNewTabsEnabled) {
        // Clear existing groups first
        await ungroupAllTabs()
        // Then regroup with new settings
        await groupTabsByDomain()
      }

      return Promise.resolve({ enabled: groupBySubDomainEnabled })
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
          // Check if this is the first URL for this tab (meaning it's a new tab getting its first URL)
          const isFirstUrl = !oldDomain
          moveTabToGroup(tabId, isFirstUrl)
        }
      }
    },
    { properties: ["url"] }
  )

  browser.tabs.onCreated.addListener((tab) => {
    // When a tab is created, mark it as new by setting an empty domain
    tabDomains.set(tab.id, "")

    // If it already has a URL (rare but possible), handle it immediately
    if (tab.url) {
      const domain = extractDomain(tab.url)
      if (domain) {
        tabDomains.set(tab.id, domain)
        moveTabToGroup(tab.id, true)
      }
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
}

main()
