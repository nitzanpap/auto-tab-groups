/**
 * Main background service worker for the Chrome extension (Manifest V3)
 */

import { tabGroupState } from "./state/TabGroupState.js"
import { tabGroupService } from "./services/TabGroupService.js"
import { storageManager } from "./config/StorageManager.js"
import "./utils/BrowserAPI.js" // Import browser compatibility layer

// Initialize state when the extension loads
;(async () => {
  try {
    await storageManager.loadState()
    console.log("Extension initialized successfully")

    // Auto-group existing tabs if auto-grouping is enabled
    if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
      console.log("Auto-grouping is enabled, grouping existing tabs...")
      await tabGroupService.groupTabsByDomain()
    }
  } catch (error) {
    console.error("Error initializing extension:", error)
  }
})()

// Message handler for popup communication (Chrome MV3 compatible)
browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    try {
      let result

      switch (msg.action) {
        case "group":
          await tabGroupService.groupTabsByDomain()
          result = { success: true }
          break

        case "ungroup":
          await tabGroupService.ungroupAllTabs()
          result = { success: true }
          break

        case "generateNewColors":
          await tabGroupService.generateNewColors()
          result = { success: true }
          break

        case "toggleCollapse":
          await tabGroupService.toggleAllGroupsCollapse(msg.collapse)
          result = { success: true }
          break

        case "getGroupsCollapseState":
          result = { isCollapsed: await tabGroupService.getGroupsCollapseState() }
          break

        case "getAutoGroupState":
          result = { enabled: tabGroupState.autoGroupingEnabled }
          break

        case "getOnlyApplyToNewTabs":
          result = { enabled: tabGroupState.onlyApplyToNewTabsEnabled }
          break

        case "getPreserveManualColors":
          result = { enabled: tabGroupState.preserveManualColors }
          break

        case "toggleAutoGroup":
          tabGroupState.autoGroupingEnabled = msg.enabled
          await storageManager.saveState()

          if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
            await tabGroupService.groupTabsByDomain()
          }
          result = { enabled: tabGroupState.autoGroupingEnabled }
          break

        case "toggleOnlyNewTabs":
          tabGroupState.onlyApplyToNewTabsEnabled = msg.enabled
          await storageManager.saveState()
          result = { enabled: tabGroupState.onlyApplyToNewTabsEnabled }
          break

        case "togglePreserveManualColors":
          tabGroupState.preserveManualColors = msg.enabled
          await storageManager.saveState()
          result = { enabled: tabGroupState.preserveManualColors }
          break

        case "getGroupBySubDomain":
          result = { enabled: tabGroupState.groupBySubDomainEnabled }
          break

        case "toggleGroupBySubDomain":
          tabGroupState.groupBySubDomainEnabled = msg.enabled
          await storageManager.saveState()

          if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
            await tabGroupService.ungroupAllTabs()
            await tabGroupService.groupTabsByDomain()
          }
          result = { enabled: tabGroupState.groupBySubDomainEnabled }
          break

        default:
          result = { error: "Unknown action" }
      }

      sendResponse(result)
    } catch (error) {
      console.error("Background script error:", error)
      sendResponse({ error: error.message })
    }
  })()

  // Return true to indicate we will respond asynchronously
  return true
})

// Tab event listeners
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    tabGroupService.moveTabToGroup(tabId)
  }
})

browserAPI.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    tabGroupService.moveTabToGroup(tab.id)
  }
})

browserAPI.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (removeInfo.groupId) {
    tabGroupService.removeEmptyGroup(removeInfo.groupId)
  }
})

browserAPI.tabs.onMoved.addListener((tabId) => {
  tabGroupService.moveTabToGroup(tabId)
})

// Listen for tab group updates (including color changes)
if (browserAPI.tabGroups && browserAPI.tabGroups.onUpdated) {
  browserAPI.tabGroups.onUpdated.addListener(async (group) => {
    try {
      const domain = await tabGroupService.getGroupDomain(group.id)
      if (!domain) return

      // If the color has changed and it's different from our stored color
      if (group.color && group.color !== tabGroupState.getColor(domain)) {
        console.log(
          `[tabGroups.onUpdated] User changed color for domain "${domain}" to "${group.color}"`
        )
        tabGroupState.setColor(domain, group.color, true)
        await storageManager.saveState()
      }
    } catch (error) {
      console.error("[tabGroups.onUpdated] Error handling group update:", error)
    }
  })
}
