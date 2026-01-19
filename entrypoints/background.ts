/**
 * Main background service worker for the Auto Tab Groups extension (Manifest V3)
 *
 * IMPORTANT: Single Source of Truth (SSOT) Architecture
 * - Browser storage is the authoritative source for all state
 * - In-memory state is only used for performance optimization
 * - Service workers can restart at any time, losing all in-memory state
 * - All operations must ensure state is loaded from storage before proceeding
 */

import { tabGroupState, tabGroupService, rulesService } from "../services"
import { loadAllStorage, saveAllStorage } from "../utils/storage"

export default defineBackground(() => {
  // State initialization flag to ensure it only happens once per service worker instance
  let stateInitialized = false

  /**
   * Ensures state is loaded from storage (SSOT) before any operations
   */
  async function ensureStateLoaded(): Promise<void> {
    if (!stateInitialized) {
      try {
        console.log("Service worker starting - loading state from storage...")
        const storageData = await loadAllStorage()
        tabGroupState.updateFromStorage(storageData)
        stateInitialized = true
        console.log("State loaded successfully from storage")
        console.log("Auto-grouping enabled:", tabGroupState.autoGroupingEnabled)
        console.log("Custom rules count:", tabGroupState.customRules.size)

        // Restore saved colors for existing groups
        await tabGroupService.restoreSavedColors()
      } catch (error) {
        console.error("Error loading state from storage:", error)
        throw error
      }
    }
  }

  /**
   * Save current state to storage
   */
  async function saveState(): Promise<void> {
    await saveAllStorage(tabGroupState.getStorageData())
  }

  // Always load state when service worker starts - SSOT from browser storage
  ensureStateLoaded()
    .then(async () => {
      try {
        if (tabGroupState.autoGroupingEnabled) {
          console.log("Auto-grouping is enabled, grouping existing tabs...")
          await tabGroupService.groupAllTabs()
        } else {
          console.log("Auto-grouping is disabled")
        }
      } catch (error) {
        console.error("Error during initial auto-grouping:", error)
      }
    })
    .catch(error => {
      console.error("Critical error: Failed to load state on service worker start:", error)
    })

  // Message handler for popup communication
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    ;(async () => {
      try {
        await ensureStateLoaded()

        let result: Record<string, unknown>

        switch (msg.action) {
          case "group":
            await tabGroupService.groupAllTabsManually()
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

          case "restoreSavedColors":
            await tabGroupService.restoreSavedColors()
            result = { success: true }
            break

          case "collapseAll":
            await tabGroupService.collapseAllGroups()
            result = { success: true }
            break

          case "expandAll":
            await tabGroupService.expandAllGroups()
            result = { success: true }
            break

          case "toggleCollapse": {
            const collapseResult = await tabGroupService.toggleAllGroupsCollapse()
            result = { success: true, isCollapsed: collapseResult.isCollapsed }
            break
          }

          case "getGroupsCollapseState": {
            const collapseState = await tabGroupService.getGroupsCollapseState()
            result = { isCollapsed: collapseState.isCollapsed }
            break
          }

          case "getAutoGroupState":
            result = { enabled: tabGroupState.autoGroupingEnabled }
            break

          case "getGroupNewTabsState":
            result = { enabled: tabGroupState.groupNewTabs }
            break

          case "getOnlyApplyToNewTabs":
          case "toggleAutoGroup":
            tabGroupState.autoGroupingEnabled = msg.enabled
            await saveState()

            if (tabGroupState.autoGroupingEnabled) {
              await tabGroupService.groupAllTabs()
            }
            result = { enabled: tabGroupState.autoGroupingEnabled }
            break

          case "toggleGroupNewTabs":
            tabGroupState.groupNewTabs = msg.enabled
            await saveState()
            result = { enabled: tabGroupState.groupNewTabs }
            break

          case "getGroupByMode":
            result = { mode: tabGroupState.groupByMode }
            break

          case "setGroupByMode":
            tabGroupState.groupByMode = msg.mode
            await saveState()

            if (tabGroupState.autoGroupingEnabled) {
              await tabGroupService.ungroupAllTabs()
              await tabGroupService.groupTabsWithRules()
            }
            result = { mode: tabGroupState.groupByMode }
            break

          case "getMinimumTabsForGroup":
            result = { minimumTabs: tabGroupState.minimumTabsForGroup || 1 }
            break

          case "setMinimumTabsForGroup":
            tabGroupState.minimumTabsForGroup = msg.minimumTabs || 1
            await saveState()

            if (tabGroupState.autoGroupingEnabled) {
              await tabGroupService.groupAllTabs()
            }
            result = { minimumTabs: tabGroupState.minimumTabsForGroup }
            break

          // Custom Rules Management
          case "getCustomRules": {
            const rules = await rulesService.getCustomRules()
            result = { customRules: rules }
            break
          }

          case "addCustomRule":
            console.log("[Background] Received addCustomRule message:", msg.ruleData)
            try {
              const ruleId = await rulesService.addRule(msg.ruleData)
              console.log("[Background] Rule added successfully with ID:", ruleId)
              result = { success: true, ruleId }

              if (tabGroupState.autoGroupingEnabled) {
                await tabGroupService.groupTabsWithRules()
              }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break

          case "updateCustomRule":
            try {
              await rulesService.updateRule(msg.ruleId, msg.ruleData)
              result = { success: true }

              if (tabGroupState.autoGroupingEnabled) {
                await tabGroupService.ungroupAllTabs()
                await tabGroupService.groupTabsWithRules()
              }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break

          case "deleteCustomRule":
            try {
              await rulesService.deleteRule(msg.ruleId)
              result = { success: true }

              if (tabGroupState.autoGroupingEnabled) {
                await tabGroupService.ungroupAllTabs()
                await tabGroupService.groupTabsWithRules()
              }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break

          case "getRulesStats": {
            const stats = await rulesService.getRulesStats()
            result = { stats }
            break
          }

          case "exportRules":
            try {
              const exportData = await rulesService.exportRules()
              result = { success: true, data: exportData }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break

          case "importRules":
            try {
              const importResult = await rulesService.importRules(msg.jsonData, msg.replaceExisting)
              result = { ...importResult }

              if (importResult.success && tabGroupState.autoGroupingEnabled) {
                await tabGroupService.ungroupAllTabs()
                await tabGroupService.groupTabsWithRules()
              }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break

          case "getExportStats":
            try {
              const exportStats = await rulesService.getExportStats()
              result = { success: true, stats: exportStats }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break

          default:
            result = { error: "Unknown action" }
        }

        sendResponse(result)
      } catch (error) {
        console.error("Background script error:", error)
        sendResponse({ error: (error as Error).message })
      }
    })()

    // Return true to indicate we will respond asynchronously
    return true
  })

  // Tab event listeners
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    try {
      console.log(`[tabs.onUpdated] Tab ${tabId} updated:`, changeInfo)
      if (changeInfo.url) {
        console.log(`[tabs.onUpdated] URL changed to: ${changeInfo.url}`)
        await ensureStateLoaded()
        await tabGroupService.handleTabUpdate(tabId)
      } else if (
        Object.prototype.hasOwnProperty.call(changeInfo, "pinned") &&
        changeInfo.pinned === false
      ) {
        console.log(`[tabs.onUpdated] Tab ${tabId} was unpinned, applying grouping`)
        await ensureStateLoaded()
        await tabGroupService.handleTabUpdate(tabId)
      }
    } catch (error) {
      console.error(`[tabs.onUpdated] Error handling tab ${tabId} update:`, error)
    }
  })

  browser.tabs.onCreated.addListener(async tab => {
    try {
      console.log(`[tabs.onCreated] Tab ${tab.id} created with URL: ${tab.url}`)
      if (tab.url && tab.id) {
        await ensureStateLoaded()
        await tabGroupService.handleTabUpdate(tab.id)
      }
    } catch (error) {
      console.error(`[tabs.onCreated] Error handling tab creation:`, error)
    }
  })

  browser.tabs.onRemoved.addListener(async tabId => {
    try {
      console.log(`[tabs.onRemoved] Tab ${tabId} removed`)
      await ensureStateLoaded()
    } catch (error) {
      console.error(`[tabs.onRemoved] Error handling tab ${tabId} removal:`, error)
    }
  })

  browser.tabs.onMoved.addListener(async tabId => {
    try {
      console.log(`[tabs.onMoved] Tab ${tabId} moved`)
      await ensureStateLoaded()
      await tabGroupService.moveTabToGroup(tabId)
    } catch (error) {
      console.error(`[tabs.onMoved] Error handling tab ${tabId} move:`, error)
    }
  })

  // Listen for tab group updates (including color changes)
  if (browser.tabGroups?.onUpdated) {
    browser.tabGroups.onUpdated.addListener(async group => {
      try {
        await ensureStateLoaded()

        const domain = await tabGroupService.getGroupDomain(group.id)
        if (!domain) return

        console.log(`[tabGroups.onUpdated] Group ${group.id} updated for domain "${domain}"`)
      } catch (error) {
        console.error("[tabGroups.onUpdated] Error handling group update:", error)
      }
    })
  }

  // Listen for tab group removal
  if (browser.tabGroups?.onRemoved) {
    browser.tabGroups.onRemoved.addListener(async group => {
      try {
        console.log(`[tabGroups.onRemoved] Group ${group.id} was removed`)
      } catch (error) {
        console.error("[tabGroups.onRemoved] Error handling group removal:", error)
      }
    })
  }
})
