/**
 * Main background service worker for the Chrome extension (Manifest V3)
 */

import { tabGroupState } from "./state/TabGroupState.js"
import { tabGroupService } from "./services/TabGroupService.js"
import { storageManager } from "./config/StorageManager.js"
import "./utils/BrowserAPI.js" // Import browser compatibility layer
import { rulesService } from "./services/RulesService.js"

// Access the unified browser API
const browserAPI = globalThis.browserAPI || (typeof browser !== "undefined" ? browser : chrome)

// Initialize state when the extension loads
;(async () => {
  try {
    await storageManager.loadState()
    console.log("Extension initialized successfully")

    console.log("Auto-grouping enabled:", tabGroupState.autoGroupingEnabled)
    console.log("Only apply to new tabs:", tabGroupState.onlyApplyToNewTabsEnabled)

    // Auto-group existing tabs if auto-grouping is enabled
    if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
      console.log("Auto-grouping is enabled, grouping existing tabs...")
      await tabGroupService.groupTabsWithRules()
    } else {
      console.log("Auto-grouping conditions not met - either disabled or only-new-tabs is enabled")
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
          await tabGroupService.groupTabsWithRules()
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
            await tabGroupService.groupTabsWithRules()
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
            await tabGroupService.groupTabsWithRules()
          }
          result = { enabled: tabGroupState.groupBySubDomainEnabled }
          break

        // Custom Rules Management
        case "getCustomRules":
          const rules = await rulesService.getCustomRules()
          result = { customRules: rules }
          break

        case "addCustomRule":
          try {
            const ruleId = await rulesService.addRule(msg.ruleData)
            result = { success: true, ruleId }

            // Re-group tabs if auto-grouping is enabled
            if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
              await tabGroupService.groupTabsWithRules()
            }
          } catch (error) {
            result = { success: false, error: error.message }
          }
          break

        case "updateCustomRule":
          try {
            await rulesService.updateRule(msg.ruleId, msg.ruleData)
            result = { success: true }

            // Re-group tabs if auto-grouping is enabled
            if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
              await tabGroupService.ungroupAllTabs()
              await tabGroupService.groupTabsWithRules()
            }
          } catch (error) {
            result = { success: false, error: error.message }
          }
          break

        case "deleteCustomRule":
          try {
            await rulesService.deleteRule(msg.ruleId)
            result = { success: true }

            // Re-group tabs if auto-grouping is enabled
            if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
              await tabGroupService.ungroupAllTabs()
              await tabGroupService.groupTabsWithRules()
            }
          } catch (error) {
            result = { success: false, error: error.message }
          }
          break

        case "getRulesStats":
          const stats = await rulesService.getRulesStats()
          result = { stats }
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
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log(`[tabs.onUpdated] Tab ${tabId} updated:`, changeInfo)
  if (changeInfo.url) {
    console.log(`[tabs.onUpdated] URL changed to: ${changeInfo.url}`)
    tabGroupService.moveTabToGroup(tabId)
  }
})

browserAPI.tabs.onCreated.addListener((tab) => {
  console.log(`[tabs.onCreated] Tab ${tab.id} created with URL: ${tab.url}`)
  if (tab.url) {
    tabGroupService.moveTabToGroup(tab.id)
  }
})

browserAPI.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log(`[tabs.onRemoved] Tab ${tabId} removed from group: ${removeInfo.groupId}`)
  if (removeInfo.groupId) {
    tabGroupService.removeEmptyGroup(removeInfo.groupId)
  }
})

browserAPI.tabs.onMoved.addListener((tabId) => {
  console.log(`[tabs.onMoved] Tab ${tabId} moved`)
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

// Listen for tab group removal
if (browserAPI.tabGroups && browserAPI.tabGroups.onRemoved) {
  browserAPI.tabGroups.onRemoved.addListener(async (group) => {
    try {
      console.log(`[tabGroups.onRemoved] Group ${group.id} was removed, cleaning up mapping`)
      tabGroupState.removeGroup(group.id)
      await storageManager.saveState()
    } catch (error) {
      console.error("[tabGroups.onRemoved] Error handling group removal:", error)
    }
  })
}
