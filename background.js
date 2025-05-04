async function groupTabsByDomainV2() {
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
    const domain = url.hostname

    console.log(domain)

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
    // groupTabsByDomainV1()
    groupTabsByDomainV2()
  }

  // If the action is "ungroup", ungroup all tabs
  if (msg.action === "ungroup") {
    ungroupAllTabs()
  }

  // If the action is "createTwoTabsInNewGroup", create two tabs in a new group
  if (msg.action === "createTwoTabsInNewGroup") {
    createTwoTabsInNewGroup()
  }
})
