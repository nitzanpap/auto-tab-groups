/**
 * Main background service worker for the Chrome extension (Manifest V3)
 *
 * IMPORTANT: Single Source of Truth (SSOT) Architecture
 * - Browser storage (chrome.storage.local) is the authoritative source for all state
 * - In-memory state is only used for performance optimization
 * - Service workers can restart at any time, losing all in-memory state
 * - All operations must ensure state is loaded from storage before proceeding
 * - This prevents issues where rules "disappear" due to service worker restarts
 */

import { tabGroupState } from "./state/TabGroupState.js"
import { tabGroupService } from "./services/TabGroupService.js"
import { storageManager } from "./config/StorageManager.js"
import "./utils/BrowserAPI.js" // Import browser compatibility layer
import { rulesService } from "./services/RulesService.js"

// Access the unified browser API
const browserAPI = globalThis.browserAPI || (typeof browser !== "undefined" ? browser : chrome)

// State initialization flag to ensure it only happens once per service worker instance
let stateInitialized = false

/**
 * Ensures state is loaded from storage (SSOT) before any operations
 * This must be called before any tab grouping operations
 */
async function ensureStateLoaded() {
  if (!stateInitialized) {
    try {
      console.log("Service worker starting - loading state from storage...")
      await storageManager.loadState()
      stateInitialized = true
      console.log("State loaded successfully from storage")
      console.log("Auto-grouping enabled:", tabGroupState.autoGroupingEnabled)
      console.log("Only apply to new tabs:", tabGroupState.onlyApplyToNewTabsEnabled)
      console.log("Custom rules count:", Object.keys(tabGroupState.customRules || {}).length)
    } catch (error) {
      console.error("Error loading state from storage:", error)
      throw error
    }
  }
}

// Always load state when service worker starts - SSOT from browser storage
ensureStateLoaded()
  .then(async () => {
    try {
      // Rebuild group-domain mappings to handle stale group IDs after service worker restart
      console.log("Rebuilding group-domain mappings after service worker restart...")
      await tabGroupService.rebuildGroupDomainMappings()

      // Auto-group existing tabs if auto-grouping is enabled and conditions are met
      if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
        console.log("Auto-grouping is enabled, preserving existing colors and grouping tabs...")

        // First, preserve any existing group colors to maintain UX consistency
        await tabGroupService.preserveExistingGroupColors()

        // Then proceed with grouping
        await tabGroupService.groupTabsWithRules()
      } else {
        console.log(
          "Auto-grouping conditions not met - either disabled or only-new-tabs is enabled"
        )
      }
    } catch (error) {
      console.error("Error during initial auto-grouping:", error)
    }
  })
  .catch((error) => {
    console.error("Critical error: Failed to load state on service worker start:", error)
  })

// Message handler for popup communication (Chrome MV3 compatible)
browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    try {
      // Ensure state is loaded from storage before any operation (SSOT)
      await ensureStateLoaded()

      let result

      switch (msg.action) {
        case "group":
          // Rebuild mappings to ensure they're fresh before grouping
          await tabGroupService.rebuildGroupDomainMappings()
          // Preserve existing colors before regrouping for better UX
          await tabGroupService.preserveExistingGroupColors()
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
            await tabGroupService.preserveExistingGroupColors()
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
          console.log("[Background] Received addCustomRule message:", msg.ruleData)
          try {
            const ruleId = await rulesService.addRule(msg.ruleData)
            console.log("[Background] Rule added successfully with ID:", ruleId)
            result = { success: true, ruleId }

            // Re-group tabs if auto-grouping is enabled
            if (tabGroupState.autoGroupingEnabled && !tabGroupState.onlyApplyToNewTabsEnabled) {
              await tabGroupService.preserveExistingGroupColors()
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
browserAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    console.log(`[tabs.onUpdated] Tab ${tabId} updated:`, changeInfo)
    if (changeInfo.url) {
      console.log(`[tabs.onUpdated] URL changed to: ${changeInfo.url}`)
      await ensureStateLoaded() // Ensure state is loaded from storage (SSOT)
      await tabGroupService.moveTabToGroup(tabId)
    }
  } catch (error) {
    console.error(`[tabs.onUpdated] Error handling tab ${tabId} update:`, error)
  }
})

browserAPI.tabs.onCreated.addListener(async (tab) => {
  try {
    console.log(`[tabs.onCreated] Tab ${tab.id} created with URL: ${tab.url}`)
    if (tab.url) {
      await ensureStateLoaded() // Ensure state is loaded from storage (SSOT)
      await tabGroupService.moveTabToGroup(tab.id)
    }
  } catch (error) {
    console.error(`[tabs.onCreated] Error handling tab ${tab.id} creation:`, error)
  }
})

browserAPI.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    console.log(`[tabs.onRemoved] Tab ${tabId} removed from group: ${removeInfo.groupId}`)
    if (removeInfo.groupId) {
      await ensureStateLoaded() // Ensure state is loaded from storage (SSOT)
      await tabGroupService.removeEmptyGroup(removeInfo.groupId)
    }
  } catch (error) {
    console.error(`[tabs.onRemoved] Error handling tab ${tabId} removal:`, error)
  }
})

browserAPI.tabs.onMoved.addListener(async (tabId) => {
  try {
    console.log(`[tabs.onMoved] Tab ${tabId} moved`)
    await ensureStateLoaded() // Ensure state is loaded from storage (SSOT)
    await tabGroupService.moveTabToGroup(tabId)
  } catch (error) {
    console.error(`[tabs.onMoved] Error handling tab ${tabId} move:`, error)
  }
})

// Listen for tab group updates (including color changes)
if (browserAPI.tabGroups && browserAPI.tabGroups.onUpdated) {
  browserAPI.tabGroups.onUpdated.addListener(async (group) => {
    try {
      await ensureStateLoaded() // Ensure state is loaded from storage (SSOT)

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
