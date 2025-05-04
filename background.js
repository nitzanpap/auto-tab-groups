/*
// Examples

// Create two tabs and put them in a new group, then create another tab and add it to the group.
// js

// // Create two tabs and put them in a new group.
// const tab1 = await browser.tabs.create({});
// const tab2 = await browser.tabs.create({});
// const groupId = await browser.tabs.group({
//   tabIds: [tab1.id, tab2.id],
// });

// // Create another tab and add it to the group.
// const tab3 = await browser.tabs.create({});
// await browser.tabs.group({
//   tabIds: tab3.id,
//   groupId: groupId,
// });

// Create a tab and match its grouping to that of the current tab.
// js

// let [oldTab] = await browser.tabs.query({
//   active: true,
//   lastFocusedWindow: true,
// });

// let newTab = await browser.tabs.create({
//   url: "https://example.com/",
//   index: oldTab.index + 1,
// });
// // Feature detection: tab grouping is a relatively new feature.
// // All tabs are ungrouped if the API does not exist.
// if (browser.tabs.group) {
//   if (oldTab.groupId !== -1) {
//     // oldTab is in a group, add newTab to the same group
//     await browser.tabs.group({ groupId: oldTab.groupId, tabIds: [newTab.id] });
//   } else {
//     // oldTab isn't in a group
//     // Although a new tab positioned next to an ungrouped tab is
//     // already ungrouped, we call ungroup() in case this example is
//     // adopted for use with tabs that aren't adjacent. When oldTab
//     // is not in a tab group, the only way to ensure that newTab isn't
//     // in a tab group is by using ungroup().
//     await browser.tabs.ungroup(newTab.id);
//   }
// }

// async function groupTabsByDomainV1() {
//   // Get all tabs in the current window
//   const tabs = await browser.tabs.query({ currentWindow: true })
//   const domainGroups = {}

//   // For each tab, get the domain and add it to the appropriate group. If the group doesn't exist, create it.
//   for (const tab of tabs) {
//     try {
//       // Get the domain from the URL
//       const url = new URL(tab.url)
//       const domain = url.hostname

//       // If the group doesn't exist, create it.
//       if (!domainGroups[domain]) {
//         domainGroups[domain] = []
//       }

//       // Add the tab to the group
//       domainGroups[domain].push(tab)
//     } catch (e) {
//       console.error(`Error parsing URL for tab ${tab.id}: ${e}`)
//     }
//   }

//   // For each domain group, sort the tabs by their index and group them
//   for (const domain in domainGroups) {
//     const tabsInGroup = domainGroups[domain]

//     // Sort tabs by their index to ensure they are adjacent
//     tabsInGroup.sort((a, b) => a.index - b.index)

//     // Get the tab IDs
//     const tabIds = tabsInGroup.map((tab) => tab.id)

//     // Group the tabs
//     try {
//       await browser.tabs.group({ tabIds })
//       console.log(`Grouped tabs for domain: ${domain}`)
//     } catch (e) {
//       console.error(`Error grouping tabs for domain ${domain}: ${e}`)
//     }
//   }
// }
*/

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

async function createTwoTabsInNewGroup() {
  // Create two tabs and put them in a new group.
  const tab1 = await browser.tabs.create({})
  const tab2 = await browser.tabs.create({})
  const groupId = await browser.tabs.group({
    tabIds: [tab1.id, tab2.id],
  })

  // Create another tab and add it to the group.
  const tab3 = await browser.tabs.create({})
  await browser.tabs.group({
    tabIds: tab3.id,
    groupId: groupId,
  })
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
