async function groupTabsByDomain() {
  // Get all tabs in the current window
  const tabs = await browser.tabs.query({ currentWindow: true })
  const domainGroups = {}

  // For each tab, get the domain and add it to the appropriate group. If the group doesn't exist, create it.
  for (const tab of tabs) {
    try {
      // Get the domain from the URL
      const url = new URL(tab.url)
      const domain = url.hostname

      // If the group doesn't exist, create it.
      if (!domainGroups[domain]) {
        domainGroups[domain] = []
      }

      // Add the tab to the group
      domainGroups[domain].push(tab)
    } catch (e) {
      console.error(`Error parsing URL for tab ${tab.id}: ${e}`)
    }
  }

  // For each domain group, sort the tabs by their index and group them
  for (const domain in domainGroups) {
    const tabsInGroup = domainGroups[domain]

    // Sort tabs by their index to ensure they are adjacent
    tabsInGroup.sort((a, b) => a.index - b.index)

    // Get the tab IDs
    const tabIds = tabsInGroup.map((tab) => tab.id)

    // Group the tabs
    try {
      await browser.tabs.group({ tabIds })
      console.log(`Grouped tabs for domain: ${domain}`)
    } catch (e) {
      console.error(`Error grouping tabs for domain ${domain}: ${e}`)
    }
  }
}

browser.runtime.onMessage.addListener((msg) => {
  // If the action is "group", group the tabs by domain
  if (msg.action === "group") {
    groupTabsByDomain()
  }
})
