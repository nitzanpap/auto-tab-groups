/**
 * Simplified Tab Group Service - Browser as SSOT
 * Uses browser state as the single source of truth, no complex state management
 */

import type { Browser } from "wxt/browser"
import type { CustomRule, TabGroupColor } from "../types"
import { getRandomTabGroupColor } from "../utils/Constants"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils"
import { getGroupColor, groupColorMapping, updateGroupColor } from "../utils/storage"
import { type MatchedRule, rulesService } from "./RulesService"
import { tabGroupState } from "./TabGroupState"

/**
 * Collapse state result
 */
interface CollapseState {
  isCollapsed: boolean
}

class TabGroupServiceSimplified {
  /**
   * Checks if a URL is a new tab URL
   */
  isNewTabUrl(url: string): boolean {
    if (!url || typeof url !== "string") {
      return false
    }

    const newTabUrls = [
      "chrome://newtab/",
      "chrome-extension://",
      "moz-extension://",
      "about:newtab",
      "about:home",
      "edge://newtab/",
      "about:blank"
    ]

    return newTabUrls.some(newTabUrl => url.startsWith(newTabUrl))
  }

  /**
   * Handles a tab update - moves tab to correct group based on its current URL
   */
  async handleTabUpdate(tabId: number, forceGrouping = false): Promise<boolean> {
    if (!forceGrouping && !tabGroupState.autoGroupingEnabled) {
      return false
    }

    try {
      console.log(`[TabGroupService] Processing tab ${tabId}`)

      const tab = await browser.tabs.get(tabId)
      console.log(`[TabGroupService] Tab URL: ${tab.url}`)

      // Check if this is a system URL and user has disabled grouping system tabs
      if (!forceGrouping && !tabGroupState.groupNewTabs) {
        const domain = extractDomain(tab.url || "", false)
        if (domain === "system") {
          console.log(
            `[TabGroupService] Tab ${tabId} has a system URL and grouping system tabs is disabled`
          )
          return false
        }
      }

      // Skip pinned tabs
      if (tab.pinned) {
        console.log(`[TabGroupService] Tab ${tabId} is pinned, skipping`)
        return false
      }

      // Handle rules-only mode
      if (tabGroupState.groupByMode === "rules-only") {
        const customRule = await rulesService.findMatchingRule(tab.url || "")

        // Handle system URLs
        const domain = extractDomain(tab.url || "", false)
        if (!customRule && domain === "system") {
          return await this.moveTabToTargetGroup(tabId, tab, "System", null, "grey")
        }

        if (!customRule) {
          console.log(`[TabGroupService] Rules-only mode: No rule found for ${tab.url}`)
          return false
        }

        const groupName = customRule.effectiveGroupName || customRule.name
        return await this.moveTabToTargetGroup(tabId, tab, groupName, customRule)
      }

      // Domain/subdomain mode
      const includeSubDomain = tabGroupState.groupByMode === "subdomain"
      const domain = extractDomain(tab.url || "", includeSubDomain)
      if (!domain) {
        console.log(`[TabGroupService] No domain extracted, skipping`)
        return false
      }

      // Check for custom rules first
      const customRule = await rulesService.findMatchingRule(tab.url || "")
      const expectedTitle = customRule
        ? customRule.effectiveGroupName || customRule.name
        : getDomainDisplayName(domain)

      console.log(`[TabGroupService] Expected group title: "${expectedTitle}"`)

      return await this.moveTabToTargetGroup(tabId, tab, expectedTitle, customRule)
    } catch (error) {
      console.error(`[TabGroupService] Error processing tab ${tabId}:`, error)
      return false
    }
  }

  /**
   * Gets the effective minimum tabs required for a group
   */
  getEffectiveMinimumTabs(customRule: MatchedRule | CustomRule | null): number {
    if (customRule && customRule.minimumTabs !== null && customRule.minimumTabs !== undefined) {
      return customRule.minimumTabs
    }
    return tabGroupState.minimumTabsForGroup || 1
  }

  /**
   * Counts tabs that would belong to the same group
   */
  async countTabsForGroup(
    expectedTitle: string,
    windowId: number,
    customRule: MatchedRule | CustomRule | null
  ): Promise<number> {
    try {
      const tabs = await browser.tabs.query({ windowId })
      let count = 0

      for (const tab of tabs) {
        if (tab.pinned) continue

        if (customRule) {
          const matchingRule = await rulesService.findMatchingRule(tab.url || "")
          const expectedGroupName =
            "effectiveGroupName" in customRule ? customRule.effectiveGroupName : customRule.name
          const matchGroupName = matchingRule
            ? matchingRule.effectiveGroupName || matchingRule.name
            : null
          if (matchingRule && matchGroupName === expectedGroupName) {
            count++
          }
        } else {
          // Handle empty/undefined URLs and system URLs as System tabs
          if (expectedTitle === "System") {
            const tabDomain = extractDomain(tab.url || "", false)
            if (!tab.url || tab.url === "" || tabDomain === "system") {
              count++
              continue
            }
          }

          const includeSubDomain = tabGroupState.groupByMode === "subdomain"
          const domain = extractDomain(tab.url || "", includeSubDomain)
          const displayName = getDomainDisplayName(domain || "")
          if (displayName === expectedTitle) {
            count++
          }
        }
      }

      return count
    } catch (error) {
      console.error(`[TabGroupService] Error counting tabs:`, error)
      return 0
    }
  }

  /**
   * Moves a tab to the target group
   */
  async moveTabToTargetGroup(
    tabId: number,
    tab: Browser.tabs.Tab,
    expectedTitle: string,
    customRule: MatchedRule | CustomRule | null = null,
    defaultColor: TabGroupColor | null = null
  ): Promise<boolean> {
    // Check for tabGroups API availability
    if (!browser.tabGroups) {
      console.warn("[TabGroupService] tabGroups API not available")
      return false
    }

    const existingGroup = await this.findGroupByTitle(expectedTitle, tab.windowId!)

    if (existingGroup) {
      if (tab.groupId === existingGroup.id) {
        console.log(`[TabGroupService] Tab ${tabId} already in correct group`)
        return true
      }

      console.log(`[TabGroupService] Moving tab ${tabId} to existing group ${existingGroup.id}`)
      await browser.tabs.group({
        tabIds: [tabId],
        groupId: existingGroup.id
      })

      // Update color if from custom rule
      if (customRule?.color && existingGroup.color !== customRule.color) {
        try {
          await browser.tabGroups.update(existingGroup.id, {
            color: customRule.color
          })
        } catch (error) {
          console.warn(`[TabGroupService] Failed to update group color:`, error)
        }
      }

      return true
    }

    // Check minimum threshold before creating new group
    const tabCount = await this.countTabsForGroup(expectedTitle, tab.windowId!, customRule)
    const minimumTabs = this.getEffectiveMinimumTabs(customRule)

    console.log(
      `[TabGroupService] Tab count for "${expectedTitle}": ${tabCount}, minimum: ${minimumTabs}`
    )

    if (tabCount < minimumTabs) {
      console.log(`[TabGroupService] Not enough tabs to create group "${expectedTitle}"`)

      if (tab.groupId && tab.groupId !== -1) {
        await browser.tabs.ungroup([tabId])
      }

      return false
    }

    // Create new group
    console.log(`[TabGroupService] Creating new group "${expectedTitle}"`)

    const groupId = await browser.tabs.group({ tabIds: [tabId] })

    try {
      const updateOptions: Browser.tabGroups.UpdateProperties = {
        title: expectedTitle
      }

      if (customRule?.color) {
        updateOptions.color = customRule.color as Browser.tabGroups.Color
      } else {
        const savedColor = await getGroupColor(expectedTitle)
        if (savedColor) {
          updateOptions.color = savedColor as Browser.tabGroups.Color
        } else {
          updateOptions.color = (defaultColor ||
            getRandomTabGroupColor()) as Browser.tabGroups.Color
        }
      }

      await browser.tabGroups.update(groupId, updateOptions)

      if (updateOptions.color) {
        await updateGroupColor(expectedTitle, updateOptions.color)
      }

      console.log(`[TabGroupService] Created group ${groupId} with title "${expectedTitle}"`)
    } catch (error) {
      console.warn(`[TabGroupService] Failed to update group ${groupId}:`, error)
    }

    // Group matching ungrouped tabs
    await this.groupMatchingUngroupedTabs(expectedTitle, tab.windowId!, customRule)

    return true
  }

  /**
   * Groups any ungrouped tabs that match the given group criteria
   */
  async groupMatchingUngroupedTabs(
    expectedTitle: string,
    windowId: number,
    customRule: MatchedRule | CustomRule | null
  ): Promise<void> {
    try {
      const existingGroup = await this.findGroupByTitle(expectedTitle, windowId)
      if (!existingGroup) return

      const allTabs = await browser.tabs.query({ windowId })
      const tabsToGroup: number[] = []

      for (const otherTab of allTabs) {
        if (otherTab.pinned || (otherTab.groupId && otherTab.groupId !== -1)) {
          continue
        }

        let shouldGroup = false
        if (customRule) {
          const matchingRule = await rulesService.findMatchingRule(otherTab.url || "")
          shouldGroup = !!matchingRule && matchingRule.name === customRule.name
        } else {
          const includeSubDomain = tabGroupState.groupByMode === "subdomain"
          const domain = extractDomain(otherTab.url || "", includeSubDomain)
          const displayName = getDomainDisplayName(domain || "")
          shouldGroup = displayName === expectedTitle
        }

        if (shouldGroup && otherTab.id) {
          tabsToGroup.push(otherTab.id)
        }
      }

      if (tabsToGroup.length > 0) {
        await browser.tabs.group({
          tabIds: tabsToGroup as [number, ...number[]],
          groupId: existingGroup.id
        })
        console.log(
          `[TabGroupService] Added ${tabsToGroup.length} tabs to group "${expectedTitle}"`
        )
      }
    } catch (error) {
      console.error(`[TabGroupService] Error grouping matching tabs:`, error)
    }
  }

  /**
   * Finds an existing group by title
   */
  async findGroupByTitle(
    title: string,
    windowId: number
  ): Promise<Browser.tabGroups.TabGroup | null> {
    try {
      if (!browser.tabGroups) return null

      const groups = await browser.tabGroups.query({ windowId })
      return groups.find(group => group.title === title) || null
    } catch (error) {
      console.error(`[TabGroupService] Error finding group:`, error)
      return null
    }
  }

  /**
   * Groups all tabs in the current window
   */
  async groupAllTabs(): Promise<boolean> {
    if (!tabGroupState.autoGroupingEnabled) {
      return false
    }

    try {
      console.log(`[TabGroupService] Starting bulk grouping`)

      const tabs = await browser.tabs.query({ currentWindow: true })

      for (const tab of tabs) {
        if (tab.id) {
          // Skip extension pages but process all other tabs including empty URLs
          if (tab.url?.startsWith("chrome-extension://")) {
            continue
          }

          // Handle tabs with empty/undefined URLs as potential new tabs
          if (!tab.url || tab.url === "") {
            if (tabGroupState.groupNewTabs) {
              await this.moveTabToTargetGroup(tab.id, tab, "System", null, "grey")
            }
            continue
          }

          await this.handleTabUpdate(tab.id)
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      console.log(`[TabGroupService] Bulk grouping completed`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error during bulk grouping:`, error)
      return false
    }
  }

  /**
   * Manually groups all tabs (ignores auto-group setting but respects groupNewTabs)
   */
  async groupAllTabsManually(): Promise<boolean> {
    try {
      console.log(`[TabGroupService] Starting manual bulk grouping`)

      const tabs = await browser.tabs.query({ currentWindow: true })

      for (const tab of tabs) {
        if (tab.id) {
          // Skip extension pages but process all other tabs including empty URLs
          if (tab.url?.startsWith("chrome-extension://")) {
            continue
          }

          // Handle tabs with empty/undefined URLs as potential new tabs
          if (!tab.url || tab.url === "") {
            if (tabGroupState.groupNewTabs) {
              await this.moveTabToTargetGroup(tab.id, tab, "System", null, "grey")
            }
            continue
          }

          // For system URLs, respect the groupNewTabs setting
          const domain = extractDomain(tab.url, false)
          if (domain === "system" && !tabGroupState.groupNewTabs) {
            console.log(`[TabGroupService] Skipping system tab ${tab.id} - groupNewTabs disabled`)
            continue
          }

          await this.handleTabUpdate(tab.id, true)
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      console.log(`[TabGroupService] Manual bulk grouping completed`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error during manual bulk grouping:`, error)
      return false
    }
  }

  /**
   * Ungroups all tabs in the current window
   */
  async ungroupAllTabs(): Promise<boolean> {
    try {
      console.log(`[TabGroupService] Ungrouping all tabs`)
      const tabs = await browser.tabs.query({ currentWindow: true })
      const groupedTabs = tabs.filter(tab => tab.groupId && tab.groupId !== -1)

      if (groupedTabs.length > 0) {
        const tabIds = groupedTabs.map(tab => tab.id!).filter(id => id !== undefined)
        if (tabIds.length > 0) {
          await browser.tabs.ungroup(tabIds as [number, ...number[]])
        }
        console.log(`[TabGroupService] Ungrouped ${groupedTabs.length} tabs`)
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error ungrouping tabs:`, error)
      return false
    }
  }

  /**
   * Removes an empty group
   */
  async removeEmptyGroup(groupId: number): Promise<boolean> {
    await this.checkGroupThreshold(groupId)
    return true
  }

  /**
   * Check if group should be ungrouped based on threshold
   */
  async checkGroupThreshold(groupId: number): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})
      const group = groups.find(g => g.id === groupId)
      if (!group) return false

      let customRule: CustomRule | null = null
      const customRules = tabGroupState.getCustomRulesObject()
      for (const rule of Object.values(customRules)) {
        if (rule.enabled && rule.name === group.title) {
          customRule = rule
          break
        }
      }

      const minimumTabs = this.getEffectiveMinimumTabs(customRule)
      if (minimumTabs <= 1) return false

      const tabs = await browser.tabs.query({ groupId })
      const tabCount = tabs.filter(tab => !tab.pinned).length

      if (tabCount < minimumTabs) {
        console.log(`[TabGroupService] Group "${group.title}" below threshold, ungrouping`)
        const tabIds = tabs.map(tab => tab.id!).filter(id => id !== undefined)
        if (tabIds.length > 0) {
          await browser.tabs.ungroup(tabIds as [number, ...number[]])
        }
        return true
      }

      return false
    } catch (error) {
      console.error(`[TabGroupService] Error checking threshold:`, error)
      return false
    }
  }

  /**
   * Check all groups against threshold and disband those below minimum
   */
  async checkAllGroupsThreshold(): Promise<void> {
    try {
      if (!browser.tabGroups) return

      const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT })
      console.log(`[TabGroupService] Checking ${groups.length} groups against threshold`)

      for (const group of groups) {
        await this.checkGroupThreshold(group.id)
      }
    } catch (error) {
      console.error(`[TabGroupService] Error checking all groups threshold:`, error)
    }
  }

  /**
   * Ungroups all tabs from the System group (used when groupNewTabs is disabled)
   */
  async ungroupSystemTabs(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT })
      const systemGroup = groups.find(group => group.title === "System")

      if (!systemGroup) {
        console.log(`[TabGroupService] No System group found`)
        return true
      }

      const tabs = await browser.tabs.query({ groupId: systemGroup.id })
      if (tabs.length > 0) {
        const tabIds = tabs.map(tab => tab.id!).filter(id => id !== undefined)
        if (tabIds.length > 0) {
          await browser.tabs.ungroup(tabIds as [number, ...number[]])
          console.log(`[TabGroupService] Ungrouped ${tabIds.length} tabs from System group`)
        }
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error ungrouping System tabs:`, error)
      return false
    }
  }

  /**
   * Moves a tab to the correct group
   */
  async moveTabToGroup(tabId: number): Promise<boolean> {
    return await this.handleTabUpdate(tabId)
  }

  /**
   * Gets the domain for a given group
   */
  async getGroupDomain(groupId: number): Promise<string | null> {
    try {
      const tabs = await browser.tabs.query({ groupId })
      if (tabs.length === 0) return null

      const includeSubDomain = tabGroupState.groupByMode === "subdomain"
      return extractDomain(tabs[0].url || "", includeSubDomain)
    } catch (error) {
      console.error(`[TabGroupService] Error getting group domain:`, error)
      return null
    }
  }

  /**
   * Generates new random colors for all groups
   */
  async generateNewColors(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      console.log(`[TabGroupService] Generating new colors`)

      const groups = await browser.tabGroups.query({})
      const customRules = await rulesService.getCustomRules()
      const customRuleNames = new Set<string>()

      for (const rule of Object.values(customRules)) {
        if (rule.color && rule.name) {
          customRuleNames.add(rule.name)
        }
      }

      const colorMappingValue = await groupColorMapping.getValue()
      const newColorMapping = { ...colorMappingValue }

      for (const group of groups) {
        if (customRuleNames.has(group.title || "")) {
          continue
        }

        const randomColor = getRandomTabGroupColor()

        try {
          await browser.tabGroups.update(group.id, {
            color: randomColor as Browser.tabGroups.Color
          })
          newColorMapping[group.title || ""] = randomColor
        } catch (error) {
          console.warn(`[TabGroupService] Failed to update color:`, error)
        }
      }

      await groupColorMapping.setValue(newColorMapping)
      console.log(`[TabGroupService] Finished generating colors`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error generating colors:`, error)
      return false
    }
  }

  /**
   * Toggles collapse state of all groups
   */
  async toggleAllGroupsCollapse(): Promise<CollapseState> {
    try {
      if (!browser.tabGroups) return { isCollapsed: false }

      const groups = await browser.tabGroups.query({})
      if (groups.length === 0) return { isCollapsed: false }

      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTabGroupId = activeTab?.groupId !== -1 ? activeTab?.groupId : null

      const hasExpanded = groups.some(group => !group.collapsed)
      const newState = hasExpanded

      for (const group of groups) {
        if (newState && group.id === activeTabGroupId) continue

        try {
          await browser.tabGroups.update(group.id, { collapsed: newState })
        } catch (error) {
          console.warn(`[TabGroupService] Failed to toggle group:`, error)
        }
      }

      return { isCollapsed: newState }
    } catch (error) {
      console.error(`[TabGroupService] Error toggling collapse:`, error)
      return { isCollapsed: false }
    }
  }

  /**
   * Gets current collapse state
   */
  async getGroupsCollapseState(): Promise<CollapseState> {
    try {
      if (!browser.tabGroups) return { isCollapsed: false }

      const groups = await browser.tabGroups.query({})
      if (groups.length === 0) return { isCollapsed: false }

      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTabGroupId = activeTab?.groupId !== -1 ? activeTab?.groupId : null

      const nonActiveGroups = groups.filter(group => group.id !== activeTabGroupId)
      if (nonActiveGroups.length === 0) return { isCollapsed: false }

      const allCollapsed = nonActiveGroups.every(group => group.collapsed)
      return { isCollapsed: allCollapsed }
    } catch (error) {
      console.error(`[TabGroupService] Error getting collapse state:`, error)
      return { isCollapsed: false }
    }
  }

  /**
   * Restores saved colors
   */
  async restoreSavedColors(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})
      const colorMappingValue = await groupColorMapping.getValue()
      let restoredCount = 0

      for (const group of groups) {
        const savedColor = colorMappingValue[group.title || ""]
        if (savedColor && savedColor !== group.color) {
          try {
            await browser.tabGroups.update(group.id, {
              color: savedColor as Browser.tabGroups.Color
            })
            restoredCount++
          } catch (error) {
            console.warn(`[TabGroupService] Failed to restore color:`, error)
          }
        }
      }

      console.log(`[TabGroupService] Restored colors for ${restoredCount} groups`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error restoring colors:`, error)
      return false
    }
  }

  /**
   * Collapses all groups
   */
  async collapseAllGroups(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTabGroupId = activeTab?.groupId !== -1 ? activeTab?.groupId : null

      for (const group of groups) {
        if (group.id === activeTabGroupId) continue

        try {
          await browser.tabGroups.update(group.id, { collapsed: true })
        } catch (error) {
          console.warn(`[TabGroupService] Failed to collapse group:`, error)
        }
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error collapsing groups:`, error)
      return false
    }
  }

  /**
   * Expands all groups
   */
  async expandAllGroups(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})

      for (const group of groups) {
        try {
          await browser.tabGroups.update(group.id, { collapsed: false })
        } catch (error) {
          console.warn(`[TabGroupService] Failed to expand group:`, error)
        }
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error expanding groups:`, error)
      return false
    }
  }

  /**
   * Helper to update a tab group with retry logic using exponential backoff.
   * Chrome throws "Tabs cannot be edited right now" during tab transitions.
   * This retries the operation with increasing delays when that error occurs.
   *
   * Retry timeline with defaults (maxRetries=5, initialDelayMs=25):
   * - Attempt 0: Immediate
   * - Attempt 1: Wait 25ms
   * - Attempt 2: Wait 50ms
   * - Attempt 3: Wait 100ms
   * - Attempt 4: Wait 200ms
   * - Attempt 5: Wait 400ms
   * - Total window: ~775ms
   */
  private async updateTabGroupWithRetry(
    groupId: number,
    updateProperties: { collapsed?: boolean; title?: string; color?: TabGroupColor },
    maxRetries = 5,
    initialDelayMs = 25
  ): Promise<boolean> {
    let delayMs = initialDelayMs

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await browser.tabGroups.update(groupId, updateProperties)
        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const isTransientError = errorMessage.includes("cannot be edited right now")

        if (isTransientError && attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delayMs))
          delayMs *= 2 // Exponential backoff: 25 -> 50 -> 100 -> 200 -> 400ms
          continue
        }

        // Non-transient error or max retries reached
        if (attempt === maxRetries && isTransientError) {
          console.warn(
            `[TabGroupService] Failed to update group ${groupId} after ${maxRetries} retries (~775ms total)`
          )
        }
        return false
      }
    }
    return false
  }

  /**
   * Collapse all groups except the one containing the active tab.
   * Used by auto-collapse feature.
   *
   * Note: We query for the current active tab fresh instead of using the
   * tab ID from the event, because browser.tabs.get() can return stale
   * groupId data immediately after tab activation.
   */
  async collapseOtherGroups(activeTabId: number): Promise<void> {
    try {
      if (!browser.tabGroups) return

      // Get the window from the original tab ID
      const targetTab = await browser.tabs.get(activeTabId)
      const windowId = targetTab.windowId

      // Query for the CURRENT active tab in this window to get fresh state
      // This is more reliable than using browser.tabs.get(tabId) which can
      // return stale groupId data immediately after tab activation
      const activeTabs = await browser.tabs.query({ active: true, windowId })
      const currentActiveTab = activeTabs[0]

      if (!currentActiveTab) {
        console.warn("[TabGroupService] No active tab found in window")
        return
      }

      const activeGroupId = currentActiveTab.groupId

      // Tab not in a group - collapse all groups
      if (!activeGroupId || activeGroupId === -1) {
        await this.collapseAllGroups()
        return
      }

      const groups = await browser.tabGroups.query({ windowId })

      for (const group of groups) {
        if (group.id !== activeGroupId && !group.collapsed) {
          await this.updateTabGroupWithRetry(group.id, { collapsed: true })
        }
      }

      // Expand the active group if collapsed
      const activeGroup = groups.find(g => g.id === activeGroupId)
      if (activeGroup?.collapsed) {
        await this.updateTabGroupWithRetry(activeGroup.id, { collapsed: false })
      }
    } catch (error) {
      console.error(`[TabGroupService] Error in collapseOtherGroups:`, error)
    }
  }

  // Legacy aliases
  async groupTabsWithRules(): Promise<boolean> {
    return await this.groupAllTabs()
  }

  async preserveExistingGroupColors(): Promise<boolean> {
    return true
  }
}

export const tabGroupService = new TabGroupServiceSimplified()
