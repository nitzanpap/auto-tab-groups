async function groupTabsByDomain() {
  const tabs = await browser.tabs.query({ currentWindow: true })
  const domainGroups = {}

  for (const tab of tabs) {
    try {
      const url = new URL(tab.url)
      const domain = url.hostname

      if (!domainGroups[domain]) {
        domainGroups[domain] = []
      }
      domainGroups[domain].push(tab)
    } catch (e) {
      console.error(`Error parsing URL for tab ${tab.id}: ${e}`)
    }
  }

  for (const domain in domainGroups) {
    const tabsInGroup = domainGroups[domain]

    // Sort tabs by their index to ensure they are adjacent
    tabsInGroup.sort((a, b) => a.index - b.index)

    const tabIds = tabsInGroup.map((tab) => tab.id)

    try {
      await browser.tabs.group({ tabIds })
      console.log(`Grouped tabs for domain: ${domain}`)
    } catch (e) {
      console.error(`Error grouping tabs for domain ${domain}: ${e}`)
    }
  }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === "group") {
    groupTabsByDomain()
  }
})
