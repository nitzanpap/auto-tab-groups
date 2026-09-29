/**
 * Main background service worker for the Auto Tab Groups extension (Manifest V3)
 *
 * IMPORTANT: Single Source of Truth (SSOT) Architecture
 * - Browser storage is the authoritative source for all state
 * - In-memory state is only used for performance optimization
 * - Service workers can restart at any time, losing all in-memory state
 * - All operations must ensure state is loaded from storage before proceeding
 */

import {
  aiService,
  contextMenuService,
  rulesService,
  tabDiscardService,
  tabGroupService,
  tabGroupState
} from "../services"
import { handleCommand } from "../services/CommandService"
import { seedProtectedGroupsOnFirstRun } from "../services/FirstRunService"
import {
  parseAiRuleResponse,
  parseAiSuggestionResponse,
  parseConflictResolutionResponse
} from "../utils/AiResponseParser"
import { initI18n } from "../utils/i18n"
import {
  conflictResolutionPrompt,
  ruleGenerationPrompt,
  tabGroupSuggestionPrompt
} from "../utils/PromptTemplates"
import { detectConflicts } from "../utils/RuleConflictDetector"
import { cachedAiSuggestions, loadAllStorage, saveAllStorage } from "../utils/storage"
import { withTabEditRetry } from "../utils/withTabEditRetry"

export default defineBackground(() => {
  // State initialization flag to ensure it only happens once per service worker instance
  let stateInitialized = false
  let stateLoadPromise: Promise<void> | null = null

  /**
   * Ensures state is loaded from storage (SSOT) before any operations
   */
  async function ensureStateLoaded(): Promise<void> {
    if (stateInitialized) return
    if (!stateLoadPromise) {
      stateLoadPromise = (async () => {
        try {
          console.log("Service worker starting - loading state from storage...")
          await seedProtectedGroupsOnFirstRun()
          const storageData = await loadAllStorage()
          tabGroupState.updateFromStorage(storageData)
          aiService.updateFromStorage(storageData)
          await initI18n(tabGroupState.userLocale)
          stateInitialized = true
          console.log("State loaded successfully from storage")
          console.log("Auto-grouping enabled:", tabGroupState.autoGroupingEnabled)
          console.log("Custom rules count:", tabGroupState.customRules.size)

      // Sanitize protected groups to ensure System is never protected
      if (
        tabGroupState.protectedGroupTitles.some(
          t => t.toLowerCase() === "system"
        )
      ) {
        tabGroupState.protectedGroupTitles = tabGroupState.protectedGroupTitles.filter(
          t => t.toLowerCase() !== "system"
        )
        await saveState()
      }

      // Initialize comparison service state
      const { tabComparisonService } = await import("../services/TabComparisonService")
      await tabComparisonService.initialize()
        } catch (error) {
          stateLoadPromise = null
          console.error("Error loading state from storage:", error)
          throw error
        }
      })()
    }
    await stateLoadPromise
  }

  /**
   * Save current state to storage
   */
  async function saveState(): Promise<void> {
    await saveAllStorage(tabGroupState.getStorageData())
  }

  const STARTUP_GRACE_PERIOD_MS = 10000

  // Defer all auto-grouping and background tab event interference for 10 seconds after Chrome startup
  tabGroupService.startStartupGracePeriod(STARTUP_GRACE_PERIOD_MS)

  // Always load state when service worker starts - SSOT from browser storage
  ensureStateLoaded()
    .then(async () => {
      try {
        // Initialize context menus
        await contextMenuService.initialize()
        // Initialize auto-discard monitor to free memory for tabs inactive > 1 minute
        tabDiscardService.initialize()
      } catch (error) {
        console.error("Error during background initialization:", error)
      }
    })
    .catch(error => {
      console.error("Critical error: Failed to load state on service worker start:", error)
    })

  // Keyboard commands. Inert until the user assigns keys in the browser's
  // shortcuts page — the manifest suggests none.
  browser.commands?.onCommand.addListener(async command => {
    try {
      await ensureStateLoaded()
      await handleCommand(command)
    } catch (error) {
      console.error(`Error handling command "${command}":`, error)
    }
  })

  // Configure Chrome Side Panel API (Manifest V3)
  if (typeof chrome !== "undefined" && chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: unknown) => {
        console.error("[Background] Failed to set side panel behavior:", error)
      })
  }

  // Fallback to open Side Panel when action icon is clicked in Chrome
  if (typeof chrome !== "undefined" && chrome.action?.onClicked) {
    chrome.action.onClicked.addListener(async tab => {
      if (tab.windowId !== undefined && chrome.sidePanel?.open) {
        try {
          await chrome.sidePanel.open({ windowId: tab.windowId })
        } catch (error) {
          console.error("[Background] Error opening side panel on action click:", error)
        }
      }
    })
  }

  browser.runtime.onInstalled?.addListener(() => {
    if (typeof chrome !== "undefined" && chrome.sidePanel?.setPanelBehavior) {
      chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error: unknown) => {
          console.error("[Background] Failed to set side panel behavior on install:", error)
        })
    }
  })

  // Message handler for popup communication
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    ;(async () => {
      try {
        await ensureStateLoaded()

        let result: Record<string, unknown>

        switch (msg.action) {
          case "group":
            tabGroupService.endStartupGracePeriod()
            await tabGroupService.groupAllTabsManually()
            result = { success: true }
            break

          case "ungroup":
            tabGroupService.endStartupGracePeriod()
            await tabGroupService.ungroupAllTabs(true)
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

          case "openGraph3d": {
            const url = browser.runtime.getURL("/graph-3d.html" as any)
            const tab = await browser.tabs.create({ url, active: true })
            result = { success: true, tabId: tab.id }
            break
          }

          case "getGraphData": {
            const tabs = await browser.tabs.query({})
            let groups: Browser.tabGroups.TabGroup[] = []
            if (browser.tabGroups?.query) {
              try {
                groups = await browser.tabGroups.query({})
              } catch (err) {
                console.error("[Background] Failed to query tab groups:", err)
              }
            }
            result = {
              tabs: tabs.map(t => ({
                id: t.id,
                groupId: t.groupId,
                title: t.title || "Untitled",
                url: t.url || "",
                favIconUrl: t.favIconUrl || "",
                windowId: t.windowId,
                active: t.active,
                pinned: t.pinned
              })),
              groups: groups.map(g => ({
                id: g.id,
                title: g.title || "Untitled Group",
                color: g.color || "grey",
                collapsed: g.collapsed,
                windowId: g.windowId
              }))
            }
            break
          }

          case "activateTab": {
            if (typeof msg.tabId === "number") {
              await browser.tabs.update(msg.tabId, { active: true })
              if (typeof msg.windowId === "number" && typeof chrome !== "undefined" && chrome.windows?.update) {
                await chrome.windows.update(msg.windowId, { focused: true })
              }
              result = { success: true }
            } else {
              result = { success: false, error: "tabId required" }
            }
            break
          }

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
            result = { enabled: false }
            break

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

            if (tabGroupState.autoGroupingEnabled) {
              if (msg.enabled) {
                // When enabled, group new/empty tabs into System
                await tabGroupService.groupAllTabs()
              } else {
                // When disabled, ungroup tabs from System group
                await tabGroupService.ungroupSystemTabs()
              }
            }
            result = { enabled: tabGroupState.groupNewTabs }
            break

          case "getSystemGroupEnabled":
            result = { enabled: tabGroupState.systemGroupEnabled }
            break

          case "toggleSystemGroup":
            tabGroupState.systemGroupEnabled = msg.enabled
            await saveState()

            if (msg.enabled) {
              if (tabGroupState.autoGroupingEnabled) {
                await tabGroupService.groupAllTabs()
              }
            } else {
              // Dissolve the System group regardless of auto-grouping: the user
              // asked for it gone, so it should disappear right away.
              await tabGroupService.ungroupSystemTabs()
            }
            result = { enabled: tabGroupState.systemGroupEnabled }
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
              // First check existing groups against new threshold and disband if needed
              await tabGroupService.checkAllGroupsThreshold()
              // Then re-group tabs with the new threshold
              await tabGroupService.groupAllTabs()
            }
            result = { minimumTabs: tabGroupState.minimumTabsForGroup }
            break

          case "getOpenTabNextToCurrent":
            result = { enabled: tabGroupState.openTabNextToCurrent }
            break

          case "toggleOpenTabNextToCurrent":
            tabGroupState.openTabNextToCurrent = msg.enabled
            await saveState()
            result = { enabled: tabGroupState.openTabNextToCurrent }
            break

          case "getSortGroupsAlphabetically":
            result = { enabled: tabGroupState.sortGroupsAlphabetically }
            break

          case "toggleSortGroupsAlphabetically": {
            tabGroupState.sortGroupsAlphabetically = msg.enabled
            await saveState()
            if (msg.enabled) {
              const { tabSortService } = await import("../services/TabSortService")
              await tabSortService.sortGroups()
            } else {
              // Sorting disabled — also disable indexing and strip prefixes
              if (tabGroupState.indexGroupTitles) {
                tabGroupState.indexGroupTitles = false
                await saveState()
                const { tabSortService } = await import("../services/TabSortService")
                await tabSortService.stripAllIndexPrefixes()
              }
            }
            result = { enabled: tabGroupState.sortGroupsAlphabetically }
            break
          }

          case "getSortGroupsDirection":
            result = { direction: tabGroupState.sortGroupsDirection }
            break

          case "setSortGroupsDirection": {
            console.log(
              `[Background] setSortGroupsDirection=${msg.direction} (sortEnabled=${tabGroupState.sortGroupsAlphabetically})`
            )
            tabGroupState.sortGroupsDirection = msg.direction
            await saveState()
            if (tabGroupState.sortGroupsAlphabetically) {
              const { tabSortService } = await import("../services/TabSortService")
              await tabSortService.sortGroups()
            }
            result = { direction: tabGroupState.sortGroupsDirection }
            break
          }

          case "getIndexGroupTitles":
            result = { enabled: tabGroupState.indexGroupTitles }
            break

          case "getHideContextMenu":
            result = { enabled: tabGroupState.hideContextMenu }
            break

          case "toggleHideContextMenu":
            tabGroupState.hideContextMenu = msg.enabled
            await saveState()
            await contextMenuService.applyVisibility()
            result = { enabled: tabGroupState.hideContextMenu }
            break

          case "getUserLocale":
            result = { locale: tabGroupState.userLocale }
            break

          case "setUserLocale":
            tabGroupState.userLocale = msg.locale
            await saveState()
            await initI18n(msg.locale)
            await contextMenuService.rebuildMenus()
            result = { locale: tabGroupState.userLocale }
            break

          case "getDeferGroupingUntilSeen":
            result = { enabled: tabGroupState.deferGroupingUntilSeen }
            break

          case "toggleDeferGroupingUntilSeen":
            tabGroupState.deferGroupingUntilSeen = msg.enabled
            await saveState()
            result = { enabled: tabGroupState.deferGroupingUntilSeen }
            break

          case "planGroupConsolidation":
            result = { moves: await tabGroupService.planGroupConsolidation() }
            break

          case "consolidateGroups":
            result = await tabGroupService.consolidateGroups()
            break

          case "moveTabToGroupWindow":
            result = await tabGroupService.moveTabToItsGroupWindow(msg.tabId)
            break

          case "getProtectedGroups":
            result = { titles: tabGroupState.protectedGroupTitles }
            break

          case "addProtectedGroup": {
            const title = msg.title.trim()
            if (title && !tabGroupState.protectedGroupTitles.includes(title)) {
              tabGroupState.protectedGroupTitles = [...tabGroupState.protectedGroupTitles, title]
              await saveState()
            }
            result = { titles: tabGroupState.protectedGroupTitles }
            break
          }

          case "removeProtectedGroup": {
            tabGroupState.protectedGroupTitles = tabGroupState.protectedGroupTitles.filter(
              title => title !== msg.title
            )
            await saveState()

            // The group is fair game again — pick it up on the next pass
            if (tabGroupState.autoGroupingEnabled) {
              await tabGroupService.groupAllTabs()
            }
            result = { titles: tabGroupState.protectedGroupTitles }
            break
          }

          case "toggleIndexGroupTitles": {
            tabGroupState.indexGroupTitles = msg.enabled
            await saveState()
            const { tabSortService } = await import("../services/TabSortService")
            if (msg.enabled) {
              await tabSortService.sortGroups()
            } else {
              await tabSortService.stripAllIndexPrefixes()
            }
            result = { enabled: tabGroupState.indexGroupTitles }
            break
          }

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
                if (msg.ruleData?.isBlacklist) {
                  // Blacklist rules need to ungroup currently grouped tabs that match
                  await tabGroupService.ungroupAllTabs()
                }
                await tabGroupService.groupTabsWithRules()
              }

              await contextMenuService.refreshRuleSubMenuItems()
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

              await contextMenuService.refreshRuleSubMenuItems()
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

              await contextMenuService.refreshRuleSubMenuItems()
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break

          case "addDomainToRule":
            try {
              const addResult = await contextMenuService.addDomainToRule(msg.ruleId, msg.domain)

              if (addResult.success && !addResult.alreadyExists) {
                // Always re-group after adding a domain — user explicitly took this action
                await tabGroupService.ungroupAllTabs()
                await tabGroupService.groupAllTabsManually()
              }

              result = { ...addResult }
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

              if (importResult.success) {
                await contextMenuService.refreshRuleSubMenuItems()
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

          case "updateAutoCollapse":
            tabGroupState.autoCollapseEnabled = msg.autoCollapseEnabled
            tabGroupState.autoCollapseDelayMs = msg.autoCollapseDelayMs
            await saveState()
            result = { success: true }
            break

          case "getAutoCollapseState":
            result = {
              enabled: tabGroupState.autoCollapseEnabled,
              delayMs: tabGroupState.autoCollapseDelayMs
            }
            break

          // AI Features
          case "getAiState":
            result = {
              settings: aiService.getSettings(),
              modelStatus: aiService.getModelStatus(),
              availableModels: aiService.getAvailableModels(),
              customModels: aiService.getCustomModels(),
              similarityThreshold: aiService.getSimilarityThreshold()
            }
            break

          case "addCustomAiModel":
            if (msg.model && typeof msg.model.id === "string") {
              await aiService.addCustomModel(msg.model)
              result = {
                success: true,
                availableModels: aiService.getAvailableModels(),
                customModels: aiService.getCustomModels()
              }
            } else {
              result = { success: false, error: "Invalid model specification" }
            }
            break

          case "removeCustomAiModel":
            if (typeof msg.modelId === "string") {
              await aiService.removeCustomModel(msg.modelId)
              result = {
                success: true,
                availableModels: aiService.getAvailableModels(),
                customModels: aiService.getCustomModels()
              }
            } else {
              result = { success: false, error: "modelId is required" }
            }
            break

          case "setAiSimilarityThreshold":
            if (typeof msg.threshold === "number") {
              await aiService.setSimilarityThreshold(msg.threshold)
              result = { success: true, threshold: aiService.getSimilarityThreshold() }
            } else {
              result = { success: false, error: "threshold must be a number" }
            }
            break

          case "smartGroupTabs": {
            const allTabs = await browser.tabs.query({ currentWindow: true })
            const eligibleTabs = allTabs.filter(
              tab =>
                tab.id !== undefined &&
                !tab.pinned &&
                tab.url &&
                !tab.url.startsWith("chrome-extension://") &&
                !tab.url.startsWith("moz-extension://") &&
                !tab.url.startsWith("chrome://") &&
                !tab.url.startsWith("about:")
            )

            if (eligibleTabs.length === 0) {
              result = { success: false, error: "No eligible tabs to group" }
              break
            }

            const threshold = aiService.getSimilarityThreshold()
            const { clusterTabsBySemanticSimilarity } = await import("../utils/SemanticGrouping")
            const clusters = clusterTabsBySemanticSimilarity(
              eligibleTabs.map(t => ({
                id: t.id!,
                url: t.url!,
                title: t.title,
                favIconUrl: t.favIconUrl
              })),
              threshold
            )

            let groupedCount = 0
            for (const cluster of clusters) {
              if (cluster.tabIds.length >= tabGroupState.minimumTabsForGroup) {
                try {
                  const groupId = await browser.tabs.group({
                    tabIds: cluster.tabIds as [number, ...number[]]
                  })
                  if (typeof groupId === "number") {
                    await browser.tabGroups.update(groupId, {
                      title: cluster.groupName,
                      color: cluster.color as Browser.tabGroups.Color
                    })
                  }
                  groupedCount += cluster.tabIds.length
                } catch (err) {
                  console.error("[Background] Failed to form cluster group:", err)
                }
              }
            }

            result = { success: true, groupedTabs: groupedCount, clusterCount: clusters.length }
            break
          }

          case "saveState":
            await saveState()
            result = { success: true }
            break

          case "setAiEnabled":
            await aiService.setEnabled(msg.enabled)
            result = { enabled: aiService.isEnabled() }
            break

          case "setAiProvider":
            await aiService.setProvider(msg.provider)
            result = { provider: aiService.getSelectedProvider() }
            break

          case "setAiModelId":
            await aiService.setModelId(msg.modelId)
            result = { modelId: aiService.getSelectedModelId() }
            break

          case "getAiModelStatus":
            result = { modelStatus: aiService.getModelStatus() }
            break

          case "loadAiModel":
            // Fire-and-forget — model loading is long-running, UI polls status
            aiService.loadModel().catch(err => {
              console.error("[Background] AI model load failed:", err)
            })
            result = { success: true }
            break

          case "unloadAiModel":
            await aiService.unloadModel()
            result = { success: true }
            break

          case "setCustomAiConfig":
            await aiService.setCustomAiConfig({
              endpoint: msg.endpoint,
              apiKey: msg.apiKey,
              modelName: msg.modelName
            })
            result = { success: true }
            break

          case "testAiConnection": {
            const testResult = await aiService.testConnection({
              endpoint: msg.endpoint,
              apiKey: msg.apiKey,
              modelName: msg.modelName
            })
            result = testResult
            break
          }

          case "startTabComparison": {
            const { tabComparisonService } = await import("../services/TabComparisonService")
            let sourceId = msg.sourceTabId
            if (!sourceId) {
              const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
              sourceId = activeTab?.id
            }
            if (sourceId) {
              await tabComparisonService.startComparison(sourceId)
              result = { success: true, sourceTabId: sourceId }
            } else {
              result = { success: false, error: "No active source tab found" }
            }
            break
          }

          case "cancelTabComparison": {
            const { tabComparisonService } = await import("../services/TabComparisonService")
            await tabComparisonService.cancelComparison()
            result = { success: true }
            break
          }

          case "getComparisonStatus": {
            const { tabComparisonService } = await import("../services/TabComparisonService")
            result = {
              active: tabComparisonService.isComparisonActive(),
              sourceTabId: tabComparisonService.getSourceTabId(),
              comparisonGroupId: tabComparisonService.getComparisonGroupId(),
              hasComparisonGroup: tabComparisonService.getComparisonGroupId() !== null
            }
            break
          }

          case "checkWebGpuSupport": {
            const webGpu = await aiService.checkWebGpuSupport()
            result = { webGpu }
            break
          }

          case "generateRule": {
            if (typeof msg.description !== "string" || !msg.description.trim()) {
              result = { success: false, error: "Description is required" }
              break
            }
            if (msg.description.length > 500) {
              result = { success: false, error: "Description too long (max 500 characters)" }
              break
            }
            if (!Array.isArray(msg.existingDomains)) {
              result = { success: false, error: "existingDomains must be an array" }
              break
            }
            if (!aiService.isEnabled()) {
              result = { success: false, error: "AI features are disabled" }
              break
            }
            const modelStatus = aiService.getModelStatus()
            if (modelStatus.status !== "ready") {
              result = {
                success: false,
                error: "AI model is not loaded. Please load a model first."
              }
              break
            }

            console.log("[AI] generateRule prompt:", {
              description: msg.description,
              existingDomains: msg.existingDomains
            })

            const prompt = ruleGenerationPrompt(msg.description, msg.existingDomains)
            const completion = await aiService.complete({
              messages: prompt,
              temperature: 0.3,
              maxTokens: 256,
              responseFormat: "json"
            })

            console.log("[AI] generateRule raw output:", completion.content)

            const parsed = parseAiRuleResponse(completion.content)
            console.log("[AI] generateRule parse result:", {
              success: parsed.success,
              error: parsed.error,
              warnings: parsed.warnings,
              ruleName: parsed.rule?.name
            })

            result = parsed as unknown as Record<string, unknown>
            break
          }

          case "suggestGroups": {
            tabGroupState.autoGroupingEnabled = false
            await saveState()

            if (!aiService.isEnabled()) {
              result = { success: false, error: "AI features are disabled" }
              break
            }
            const suggestModelStatus = aiService.getModelStatus()
            if (suggestModelStatus.status !== "ready") {
              result = {
                success: false,
                error: "AI model is not loaded. Please load a model first."
              }
              break
            }

            const allTabs = await browser.tabs.query({ currentWindow: true })
            const eligibleTabs = allTabs.filter(
              tab =>
                tab.id !== undefined &&
                !tab.pinned &&
                tab.url &&
                !tab.url.startsWith("chrome-extension://") &&
                !tab.url.startsWith("moz-extension://") &&
                !tab.url.startsWith("chrome://") &&
                !tab.url.startsWith("about:")
            )

            if (eligibleTabs.length === 0) {
              result = { success: false, error: "No eligible tabs to analyze" }
              break
            }

            const tabsToAnalyze = eligibleTabs.slice(0, 50)
            const tabsInfo = tabsToAnalyze.map(tab => ({
              title: tab.title || "Untitled",
              url: tab.url!
            }))
            const tabsWithIds = tabsToAnalyze.map(tab => ({
              tabId: tab.id!,
              title: tab.title || "Untitled",
              url: tab.url!
            }))

            console.log(
              "[AI] suggestGroups: analyzing",
              tabsWithIds.length,
              "tabs:",
              tabsInfo.map((t, i) => `${i + 1}. "${t.title}" - ${t.url}`)
            )

            const suggestPrompt = tabGroupSuggestionPrompt(tabsInfo)

            const existingRuleNames = Object.values(tabGroupState.getCustomRulesObject()).map(
              rule => rule.name
            )
            const suggestCompletion = await aiService.complete({
              messages: suggestPrompt,
              temperature: 0.3,
              maxTokens: 512,
              responseFormat: "json"
            })

            console.log("[AI] suggestGroups raw output:", suggestCompletion.content)

            const suggestParsed = parseAiSuggestionResponse(suggestCompletion.content, tabsWithIds)

            // Filter out suggestions that duplicate existing custom rules
            const ruleNamesLower = new Set(existingRuleNames.map(n => n.toLowerCase()))
            const filtered = suggestParsed.suggestions.filter(
              s => !ruleNamesLower.has(s.groupName.toLowerCase())
            )

            console.log("[AI] suggestGroups parse result:", {
              success: suggestParsed.success,
              count: filtered.length,
              filteredOut: suggestParsed.suggestions.length - filtered.length,
              error: suggestParsed.error,
              warnings: suggestParsed.warnings
            })

            const filteredResult = {
              ...suggestParsed,
              suggestions: filtered
            }

            if (filteredResult.success) {
              await cachedAiSuggestions.setValue({
                suggestions: [...filtered],
                appliedIndices: [],
                timestamp: Date.now()
              })
            }

            result = filteredResult as unknown as Record<string, unknown>
            break
          }

          case "applySuggestion": {
            if (
              !msg.suggestion ||
              !msg.suggestion.groupName ||
              !Array.isArray(msg.suggestion.tabs)
            ) {
              result = { success: false, error: "Invalid suggestion data" }
              break
            }

            const { groupName: sugGroupName, color: sugColor, tabs: sugTabs } = msg.suggestion
            const staleTabIds: number[] = []
            const validTabIds: number[] = []

            for (const tabInfo of sugTabs) {
              try {
                await browser.tabs.get(tabInfo.tabId)
                validTabIds.push(tabInfo.tabId)
              } catch {
                staleTabIds.push(tabInfo.tabId)
              }
            }

            if (validTabIds.length === 0) {
              result = {
                success: false,
                error: "All suggested tabs have been closed",
                staleTabIds
              }
              break
            }

            try {
              if (!browser.tabGroups) {
                result = { success: false, error: "Tab groups API not available" }
                break
              }

              const sugGroupId = await browser.tabs.group({
                tabIds: validTabIds as [number, ...number[]]
              })
              await browser.tabGroups.update(sugGroupId, {
                title: sugGroupName,
                color: (sugColor || "blue") as Parameters<
                  typeof browser.tabGroups.update
                >[1]["color"]
              })

              // Mark this suggestion as applied in cache
              const cached = await cachedAiSuggestions.getValue()
              if (cached) {
                const idx = cached.suggestions.findIndex(s => s.groupName === sugGroupName)
                if (idx !== -1 && !cached.appliedIndices.includes(idx)) {
                  await cachedAiSuggestions.setValue({
                    ...cached,
                    appliedIndices: [...cached.appliedIndices, idx]
                  })
                }
              }

              result = {
                success: true,
                groupId: sugGroupId,
                ...(staleTabIds.length > 0 ? { staleTabIds } : {})
              }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break
          }

          case "analyzeRuleConflicts": {
            if (!msg.ruleData || !Array.isArray(msg.ruleData.domains)) {
              result = {
                success: false,
                hasConflicts: false,
                conflicts: [],
                resolutions: [],
                error: "Invalid rule data"
              }
              break
            }

            const existingRules = Object.values(tabGroupState.getCustomRulesObject())
            const conflicts = detectConflicts(
              msg.ruleData.domains,
              existingRules,
              msg.excludeRuleId
            )

            let resolutions: string[] = []
            if (
              conflicts.length > 0 &&
              aiService.isEnabled() &&
              aiService.getModelStatus().status === "ready"
            ) {
              try {
                const conflictRuleIds = [...new Set(conflicts.map(c => c.targetRuleId))]
                const conflictingRules = existingRules
                  .filter(r => conflictRuleIds.includes(r.id))
                  .map(r => ({ name: r.name, domains: r.domains }))

                const resolutionPrompt = conflictResolutionPrompt(
                  msg.ruleData.name || "",
                  msg.ruleData.domains,
                  conflicts,
                  conflictingRules
                )
                const resolutionCompletion = await aiService.complete({
                  messages: resolutionPrompt,
                  temperature: 0.3,
                  maxTokens: 512,
                  responseFormat: "json"
                })
                const resolutionParsed = parseConflictResolutionResponse(
                  resolutionCompletion.content
                )
                if (resolutionParsed.success) {
                  resolutions = resolutionParsed.resolutions
                }
              } catch (error) {
                console.error("[AI] conflict resolution failed:", error)
              }
            }

            result = {
              success: true,
              hasConflicts: conflicts.length > 0,
              conflicts,
              resolutions
            }
            break
          }

          case "openSidePanel": {
            try {
              if (typeof chrome !== "undefined" && chrome.sidePanel?.open) {
                const targetWindowId = msg.windowId || _sender?.tab?.windowId
                if (targetWindowId) {
                  await chrome.sidePanel.open({ windowId: targetWindowId })
                  result = { success: true }
                } else {
                  const currentWindow = await browser.windows.getCurrent()
                  if (currentWindow.id) {
                    await chrome.sidePanel.open({ windowId: currentWindow.id })
                    result = { success: true }
                  } else {
                    result = { success: false, error: "No window found" }
                  }
                }
              } else {
                result = { success: false, error: "Side panel API not available" }
              }
            } catch (error) {
              result = { success: false, error: (error as Error).message }
            }
            break
          }

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
      if (tabGroupService.isStartupGracePeriodActive() || tabGroupService.isBulkOperationInProgress()) {
        return
      }

      // Ignore loading states completely to prevent interfering with tab reloads/restores
      if (changeInfo.status === "loading") {
        return
      }

      // Only evaluate if tab URL actually changed on a complete navigation
      if (changeInfo.url) {
        // If other tabs in the window are still loading, do not interfere
        const allTabs = await browser.tabs.query({ currentWindow: true })
        if (allTabs.some(t => t.status === "loading")) {
          return
        }

        console.log(`[tabs.onUpdated] URL changed to: ${changeInfo.url}`)
        await ensureStateLoaded()

        // If openTabNextToCurrent is enabled and the URL is still a newtab URL, don't group into System
        if (
          tabGroupState.openTabNextToCurrent &&
          tabGroupService.isNewTabUrl(changeInfo.url)
        ) {
          return
        }

        await tabGroupService.handleTabUpdate(tabId)
      } else if (Object.hasOwn(changeInfo, "pinned") && changeInfo.pinned === false) {
        console.log(`[tabs.onUpdated] Tab ${tabId} was unpinned, applying grouping`)
        await ensureStateLoaded()
        await tabGroupService.handleTabUpdate(tabId)
      } else if (changeInfo.title) {
        // Titles arrive after the URL and change again on client-side
        // navigation, so this only costs anything when a rule matches on them
        await ensureStateLoaded()
        if (rulesService.hasTitleRules()) {
          console.log(`[tabs.onUpdated] Title changed to: ${changeInfo.title}`)
          await tabGroupService.handleTabUpdate(tabId)
        }
      }
    } catch (error) {
      console.error(`[tabs.onUpdated] Error handling tab ${tabId} update:`, error)
    }
  })

  browser.tabs.onCreated.addListener(async tab => {
    try {
      if (tab.id) {
        tabGroupService.markAsNewTab(tab.id)
        tabDiscardService.recordTabActivity(tab.id)
      }
      if (tabGroupService.isStartupGracePeriodActive()) {
        return
      }
      console.log(`[tabs.onCreated] Tab ${tab.id} created with URL: ${tab.url}`)

      await ensureStateLoaded()

      // Position the new tab next to the active tab if openTabNextToCurrent is enabled
      if (tabGroupState.openTabNextToCurrent && tab.id && tab.windowId !== undefined) {
        try {
          const tabsInWindow = await browser.tabs.query({ windowId: tab.windowId })
          const anchorTab = tab.openerTabId
            ? tabsInWindow.find(t => t.id === tab.openerTabId)
            : tabsInWindow.find(t => t.active && t.id !== tab.id)
          if (anchorTab && anchorTab.index !== undefined) {
            const targetIndex = anchorTab.index + 1
            if (tab.index !== targetIndex && tab.index !== targetIndex - 1) {
              await withTabEditRetry(() => browser.tabs.move(tab.id!, { index: targetIndex }))
            }
            // If the anchor tab was in a group, keep the new tab in that group beside it until it navigates
            if (
              anchorTab.groupId &&
              anchorTab.groupId !== -1 &&
              tab.groupId !== anchorTab.groupId
            ) {
              await withTabEditRetry(() =>
                browser.tabs.group({ tabIds: [tab.id!], groupId: anchorTab.groupId })
              )
            }
          }
        } catch (err) {
          console.warn("[tabs.onCreated] Error positioning tab next to current:", err)
        }
      }

      // If openTabNextToCurrent is enabled, or if it has an opener tab, or if deferGroupingUntilSeen is enabled:
      // any new/empty tab (chrome://newtab, about:blank, empty) should defer grouping to onUpdated
      // rather than being immediately snatched into System away from the active tab.
      const isNewTab =
        !tab.url ||
        tab.url === "" ||
        tab.url === "about:blank" ||
        tabGroupService.isNewTabUrl(tab.url)

      if (
        isNewTab &&
        (tabGroupState.openTabNextToCurrent ||
          tab.openerTabId ||
          tabGroupState.deferGroupingUntilSeen)
      ) {
        console.log(
          `[tabs.onCreated] Tab ${tab.id} is new/pending ("${tab.url}"), deferring grouping to onUpdated`
        )
        return
      }

      // If tab was restored already inside an existing group, leave it alone
      if (tab.groupId && tab.groupId !== -1) {
        return
      }

      // Do not auto-group on tab creation during startup or bulk reload
      // Users can group cleanly via the "Group Tabs" button or shortcut
      console.log(`[tabs.onCreated] Tab ${tab.id} registered`)
    } catch (error) {
      console.error(`[tabs.onCreated] Error handling tab creation:`, error)
    }
  })

  browser.tabs.onRemoved.addListener(async tabId => {
    try {
      tabDiscardService.removeTab(tabId)
      if (tabGroupService.isStartupGracePeriodActive() || tabGroupService.isBulkOperationInProgress()) {
        return
      }
      console.log(`[tabs.onRemoved] Tab ${tabId} removed`)
      await ensureStateLoaded()

      // Check if any groups now fall below the minimum tabs threshold
      if (tabGroupState.autoGroupingEnabled) {
        // Small delay to allow browser to fully update tab counts (needed for Firefox)
        await new Promise(resolve => setTimeout(resolve, 100))
        await tabGroupService.checkAllGroupsThreshold()
      }

      // Re-sort to update index prefixes after group count may have changed
      const { tabSortService } = await import("../services/TabSortService")
      await tabSortService.applySorting()
    } catch (error) {
      console.error(`[tabs.onRemoved] Error handling tab ${tabId} removal:`, error)
    }
  })

  browser.tabs.onMoved.addListener(async tabId => {
    try {
      if (tabGroupService.isStartupGracePeriodActive() || tabGroupService.isBulkOperationInProgress()) {
        return
      }
      await ensureStateLoaded()

      const tab = await browser.tabs.get(tabId).catch(() => null)
      if (!tab) return

      if (tab.groupId && tab.groupId !== -1) {
        // Enforce leader tab pinning for Read Later / "فيما بعد" group
        if (tabGroupState.lockLaterGroupFirstTab) {
          await tabGroupService.enforceLaterGroupLeaderTab(tab.groupId)
        }
        return
      }

      console.log(`[tabs.onMoved] Tab ${tabId} moved (ungrouped), re-evaluating`)
      await tabGroupService.moveTabToGroup(tabId)
    } catch (error) {
      console.error(`[tabs.onMoved] Error handling tab ${tabId} move:`, error)
    }
  })

  // Auto-collapse: Track timeout for debouncing
  let autoCollapseTimeoutId: ReturnType<typeof setTimeout> | null = null

  // Handle tab activation for auto-collapse
  browser.tabs.onActivated.addListener(async activeInfo => {
    try {
      tabDiscardService.recordTabActivity(activeInfo.tabId)
      if (tabGroupService.isStartupGracePeriodActive()) {
        return
      }
      await ensureStateLoaded()

      // Handle interactive comparison pairing if active
      const { tabComparisonService } = await import("../services/TabComparisonService")
      if (tabComparisonService.isComparisonActive()) {
        const paired = await tabComparisonService.handleTabActivated(
          activeInfo.tabId,
          activeInfo.windowId
        )
        if (paired) {
          return
        }
      }

      // A tab that was left alone until first view gets grouped now
      if (
        tabGroupState.deferGroupingUntilSeen &&
        (tabGroupState.autoGroupingEnabled || tabGroupService.isRecentlyCreated(activeInfo.tabId))
      ) {
        await tabGroupService.handleTabUpdate(activeInfo.tabId)
      }

      if (!tabGroupState.autoCollapseEnabled) return

      // Clear any pending collapse
      if (autoCollapseTimeoutId) {
        clearTimeout(autoCollapseTimeoutId)
        autoCollapseTimeoutId = null
      }

      const delayMs = tabGroupState.autoCollapseDelayMs

      if (delayMs === 0) {
        // Immediate mode - call directly without delay
        // collapseOtherGroups queries for fresh active tab state
        await tabGroupService.collapseOtherGroups(activeInfo.tabId)
      } else {
        // Delayed mode - use the configured delay
        autoCollapseTimeoutId = setTimeout(async () => {
          await tabGroupService.collapseOtherGroups(activeInfo.tabId)
          autoCollapseTimeoutId = null
        }, delayMs)
      }
    } catch (error) {
      console.error(`[tabs.onActivated] Error handling tab activation:`, error)
    }
  })

  // Listen for tab group updates (including color changes)
  if (browser.tabGroups?.onUpdated) {
    browser.tabGroups.onUpdated.addListener(async group => {
      try {
        await ensureStateLoaded()

        // Keeps a hand-picked colour as the one we rebuild the group with
        await tabGroupService.rememberGroupColor(group)
      } catch (error) {
        console.error("[tabGroups.onUpdated] Error handling group update:", error)
      }
    })
  }

  // Listen for tab group removal — re-sort to update index prefixes
  if (browser.tabGroups?.onRemoved) {
    browser.tabGroups.onRemoved.addListener(async group => {
      try {
        console.log(`[tabGroups.onRemoved] Group ${group.id} was removed`)
        await ensureStateLoaded()
        // Small delay to let browser fully remove the group before re-querying
        await new Promise(resolve => setTimeout(resolve, 100))
        const { tabSortService } = await import("../services/TabSortService")
        await tabSortService.applySorting()
      } catch (error) {
        console.error("[tabGroups.onRemoved] Error handling group removal:", error)
      }
    })
  }
})
