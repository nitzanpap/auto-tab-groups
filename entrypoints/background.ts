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
  tabGroupService,
  tabGroupState
} from "../services"
import {
  parseAiRuleResponse,
  parseAiSuggestionResponse,
  parseConflictResolutionResponse
} from "../utils/AiResponseParser"
import {
  conflictResolutionPrompt,
  ruleGenerationPrompt,
  tabGroupSuggestionPrompt
} from "../utils/PromptTemplates"
import { detectConflicts } from "../utils/RuleConflictDetector"
import { cachedAiSuggestions, loadAllStorage, saveAllStorage } from "../utils/storage"

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
        aiService.updateFromStorage(storageData)
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
        // Initialize context menus
        await contextMenuService.initialize()

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
              availableModels: aiService.getAvailableModels()
            }
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
      } else if (Object.hasOwn(changeInfo, "pinned") && changeInfo.pinned === false) {
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

      // Check if any groups now fall below the minimum tabs threshold
      if (tabGroupState.autoGroupingEnabled) {
        // Small delay to allow browser to fully update tab counts (needed for Firefox)
        await new Promise(resolve => setTimeout(resolve, 100))
        await tabGroupService.checkAllGroupsThreshold()
      }
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

  // Auto-collapse: Track timeout for debouncing
  let autoCollapseTimeoutId: ReturnType<typeof setTimeout> | null = null

  // Handle tab activation for auto-collapse
  browser.tabs.onActivated.addListener(async activeInfo => {
    try {
      await ensureStateLoaded()

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
