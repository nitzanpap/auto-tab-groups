async function groupTabsByDomain() {
  const tabs = await chrome.tabs.query({})
  const domainGroups = {}

  for (const tab of tabs) {
    try {
      const url = new URL(tab.url)
      const domain = url.hostname

      if (!domainGroups[domain]) {
        domainGroups[domain] = []
      }
      domainGroups[domain].push(tab.id)
    } catch (_) {
      continue
    }
  }

  for (const domain in domainGroups) {
    if (domainGroups[domain].length > 1) {
      await chrome.tabs.group({ tabIds: domainGroups[domain] })
    }
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "group") {
    groupTabsByDomain()
  }
})
