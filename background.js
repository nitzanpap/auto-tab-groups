async function groupTabsByDomain() {
  /*
  1. Get all tabs in the current window.
  2. For each tab, get the domain and add it to the appropriate group. If the group doesn't exist, create it.
  3. For each group, create a new tab group and add the tabs to it.
  4. Name the group with the domain name.
  */

  // Get all tabs in the current window
  const tabs = await browser.tabs.query({ currentWindow: true })

  console.log(tabs)

  // Create an empty list of groups
  const groups = []

  // For each tab, get the domain and add it to the appropriate group. If the group doesn't exist, create it.
  for (const tab of tabs) {
    const url = new URL(tab.url)

    const domain = extractDomain(url)

    console.log(`Original: ${url}, Base domain: ${domain}`)

    const group = groups.find((group) => group.name === domain)

    // If the group doesn't exist, create it.
    if (!group) {
      const newGroup = await browser.tabs.group({
        tabIds: [tab.id],
        // TODO: Add a name to the group once the API supports it.
        // createProperties: {
        //   name: domain,
        // },
      })
      groups.push({ id: newGroup.id, name: domain, tabs: [tab] })
    } else {
      group.tabs.push(tab)
    }
  }

  console.log(groups)

  // For each group, create a new tab group and add the tabs to it.
  for (const group of groups) {
    await browser.tabs.group({
      groupId: group.id,

      tabIds: group.tabs.map((tab) => tab.id),
    })
  }
}

async function ungroupAllTabs() {
  const tabs = await browser.tabs.query({ currentWindow: true })
  for (const tab of tabs) {
    await browser.tabs.ungroup(tab.id)
  }
}

browser.runtime.onMessage.addListener((msg) => {
  // If the action is "group", group the tabs by domain
  if (msg.action === "group") {
    groupTabsByDomain()
  }

  // If the action is "ungroup", ungroup all tabs
  if (msg.action === "ungroup") {
    ungroupAllTabs()
  }
})

// Store the last known domains for each tab
const tabDomains = new Map()

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

// If a tab's URL domain changes, move it to the appropriate group
browser.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      const newDomain = extractDomain(changeInfo.url)
      const oldDomain = tabDomains.get(tabId) || ""

      // Only regroup if the domain has actually changed
      if (newDomain !== oldDomain) {
        console.log(`Tab ${tabId} domain changed: ${oldDomain} -> ${newDomain}`)
        tabDomains.set(tabId, newDomain)
        groupTabsByDomain(tab)
      }
    }
  },
  {
    properties: ["url"],
  }
)

// Track domains when tabs are created
browser.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    tabDomains.set(tab.id, extractDomain(tab.url))
  }
})

// Clean up when tabs are removed
browser.tabs.onRemoved.addListener((tabId) => {
  tabDomains.delete(tabId)
})

// If a tab is moved to a different window, move it to the appropriate group
browser.tabs.onMoved.addListener((tabId, moveInfo) => {
  if (moveInfo.windowId !== browser.windows.WINDOW_ID_CURRENT) {
    groupTabsByDomain(tabId)
  }
})

// If a tab is removed and the group has no more tabs, remove the group
browser.tabs.onRemoved.addListener((tabId) => {
  const group = browser.tabs.getGroup(tabId)
  if (group && group.tabs.length === 0) {
    browser.tabs.ungroup(group.id)
  }
})
