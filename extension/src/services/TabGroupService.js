/**
 * Simplified Tab Group Service - Browser as SSOT
 * Uses browser state as the single source of truth, no complex state management
 */

import { tabGroupState } from "../state/TabGroupState.js"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils.js"
import { rulesService } from "./RulesService.js"
import { storageManager } from "../config/StorageManager.js"
import { getRandomTabGroupColor } from "../config/Constants.js"
import "../utils/BrowserAPI.js"

const browserAPI = globalThis.browserAPI || (typeof browser !== "undefined" ? browser : chrome)

class TabGroupServiceSimplified {
  /**
   * Checks if a URL is a new tab URL that should be treated as a "new tab"
   * @param {string} url - The URL to check
   * @returns {boolean} True if it's a new tab URL
   */
  isNewTabUrl(url) {
    if (!url || typeof url !== "string") {
      return false
    }

    // Common new tab URLs across browsers
    const newTabUrls = [
      "chrome://newtab/",
      "chrome-extension://", // Chrome extension new tab pages
      "moz-extension://", // Firefox extension new tab pages
      "about:newtab", // Firefox new tab
      "about:home", // Firefox home page
      "edge://newtab/", // Edge new tab
      "about:blank" // Blank new tab
    ]

    return newTabUrls.some(newTabUrl => url.startsWith(newTabUrl))
  }

  /**
   * Handles a tab update - moves tab to correct group based on its current URL
   * @param {number} tabId - The tab ID that changed
   * @param {boolean} forceGrouping - If true, ignores auto-group setting (for manual operations)
   * @returns {Promise<boolean>} True if successful
   */
  async handleTabUpdate(tabId, forceGrouping = false) {
    if (!forceGrouping && !tabGroupState.autoGroupingEnabled) {
      return false
    }

    try {
      console.log(`[TabGroupService] Processing tab ${tabId}`)

      // Step 1: Get tab info from browser (SSOT)
      const tab = await browserAPI.tabs.get(tabId)
      console.log(`[TabGroupService] Tab URL: ${tab.url}`)

      // Check if this is a new tab URL and user has disabled grouping new tabs
      if (!forceGrouping && !tabGroupState.groupNewTabs && this.isNewTabUrl(tab.url)) {
        console.log(
          `[TabGroupService] Tab ${tabId} has a new tab URL and grouping new tabs is disabled, skipping`
        )
        return false
      }

      // Step 1.5: Check if tab is pinned - pinned tabs should not be grouped
      if (tab.pinned) {
        console.log(`[TabGroupService] Tab ${tabId} is pinned, skipping grouping`)
        return false
      }

      // Step 2: Handle grouping mode
      if (tabGroupState.groupByMode === "rules-only") {
        // Rules-only mode: only group by custom rules
        // Try both subdomain and base domain extraction to maximize rule matching
        const subDomain = extractDomain(tab.url, true) // Include subdomain
        const baseDomain = extractDomain(tab.url, false) // Base domain only

        if (!subDomain && !baseDomain) {
          console.log(
            `[TabGroupService] Rules-only mode: No domain extracted from ${tab.url}, skipping`
          )
          return false
        }

        // Try to find a matching rule for the full URL
        let customRule = await rulesService.findMatchingRule(tab.url)
        let matchedDomain = null

        if (customRule) {
          // For display purposes, use the most specific domain that was extracted
          matchedDomain = subDomain || baseDomain
        }

        // Special handling for system URLs - always group them even without custom rules
        if (!customRule && (subDomain === "system" || baseDomain === "system")) {
          console.log(
            `[TabGroupService] Rules-only mode: System URL detected (${tab.url}), grouping under System`
          )
          return await this.moveTabToTargetGroup(tabId, tab, "System", null, "grey")
        }

        if (!customRule) {
          console.log(
            `[TabGroupService] Rules-only mode: No custom rule found for ${subDomain || baseDomain} (from ${tab.url}), skipping`
          )
          return false
        }

        console.log(
          `[TabGroupService] Rules-only mode: Found rule "${customRule.name}" for domain ${matchedDomain}`
        )

        return await this.moveTabToTargetGroup(tabId, tab, customRule.name, customRule)
      }

      // Step 2: Extract domain for domain/subdomain modes
      const includeSubDomain = tabGroupState.groupByMode === "subdomain"
      const domain = extractDomain(tab.url, includeSubDomain)
      if (!domain) {
        console.log(`[TabGroupService] No domain extracted, skipping`)
        return false
      }

      // Step 3: Check for custom rules first
      const customRule = await rulesService.findMatchingRule(tab.url)
      const expectedTitle = customRule ? customRule.name : getDomainDisplayName(domain)

      console.log(`[TabGroupService] Expected group title: "${expectedTitle}"`)

      // Step 4: Move tab to target group (find existing or create new)
      return await this.moveTabToTargetGroup(tabId, tab, expectedTitle, customRule)
    } catch (error) {
      console.error(`[TabGroupService] Error processing tab ${tabId}:`, error)
      return false
    }
  }

  /**
   * Counts tabs that would belong to the same group
   * @param {string} expectedTitle - The group title to check
   * @param {number} windowId - The window ID
   * @param {Object|null} customRule - The custom rule if applicable
   * @returns {Promise<number>} Count of tabs that match this group
   */
  async countTabsForGroup(expectedTitle, windowId, customRule) {
    try {
      const tabs = await browserAPI.tabs.query({ windowId })
      let count = 0

      for (const tab of tabs) {
        // Skip pinned tabs
        if (tab.pinned) continue

        // For rules-based grouping
        if (customRule) {
          const matchingRule = await rulesService.findMatchingRule(tab.url)
          if (matchingRule && matchingRule.name === customRule.name) {
            count++
          }
        } else {
          // For domain-based grouping
          const includeSubDomain = tabGroupState.groupByMode === "subdomain"
          const domain = extractDomain(tab.url, includeSubDomain)
          const displayName = getDomainDisplayName(domain)

          if (displayName === expectedTitle) {
            count++
          }
        }
      }

      return count
    } catch (error) {
      console.error(`[TabGroupService] Error counting tabs for group:`, error)
      return 0
    }
  }

  /**
   * Moves a tab to the target group, creating the group if it doesn't exist
   * @param {number} tabId - The tab ID to move
   * @param {Object} tab - The tab object
   * @param {string} expectedTitle - The expected group title
   * @param {Object|null} customRule - The custom rule if applicable
   * @param {string} defaultColor - Default color to use if no custom rule color or saved color exists
   * @returns {Promise<boolean>} True if successful
   */
  async moveTabToTargetGroup(tabId, tab, expectedTitle, customRule = null, defaultColor = null) {
    // Find existing group by title
    const existingGroup = await this.findGroupByTitle(expectedTitle, tab.windowId)

    if (existingGroup) {
      // Group exists - check if tab is already in it
      if (tab.groupId === existingGroup.id) {
        console.log(`[TabGroupService] Tab ${tabId} already in correct group ${existingGroup.id}`)
        return true
      }

      // Move tab to existing group
      console.log(`[TabGroupService] Moving tab ${tabId} to existing group ${existingGroup.id}`)
      await browserAPI.tabs.group({
        tabIds: [tabId],
        groupId: existingGroup.id
      })

      // Update group color if this is from a custom rule
      if (customRule && customRule.color && existingGroup.color !== customRule.color) {
        try {
          await browserAPI.tabGroups.update(existingGroup.id, {
            color: customRule.color
          })
          console.log(
            `[TabGroupService] Updated existing group ${existingGroup.id} color to "${customRule.color}" from rule "${customRule.name}"`
          )
        } catch (colorError) {
          console.warn(`[TabGroupService] Failed to update existing group color:`, colorError)
        }
      }

      return true
    }

    // No group exists - check if we meet the minimum threshold before creating
    const tabCount = await this.countTabsForGroup(expectedTitle, tab.windowId, customRule)
    const minimumTabs = tabGroupState.minimumTabsForGroup || 1

    console.log(
      `[TabGroupService] Tab count for "${expectedTitle}": ${tabCount}, minimum required: ${minimumTabs}`
    )

    if (tabCount < minimumTabs) {
      console.log(
        `[TabGroupService] Not enough tabs (${tabCount} < ${minimumTabs}) to create group "${expectedTitle}", keeping tab ungrouped`
      )

      // If tab is currently in a group, ungroup it since it doesn't meet threshold
      if (tab.groupId && tab.groupId !== -1) {
        await browserAPI.tabs.ungroup([tabId])
        console.log(`[TabGroupService] Ungrouped tab ${tabId} as it doesn't meet minimum threshold`)
      }

      return false
    }

    // Threshold is met - use standard grouping logic but group all matching tabs at once
    console.log(`[TabGroupService] Creating new group "${expectedTitle}" for tab ${tabId}`)

    const groupId = await browserAPI.tabs.group({
      tabIds: [tabId]
    })

    console.log(`[TabGroupService] Tab grouped, received group ID: ${groupId}`)

    // Set the group title and color
    try {
      const updateOptions = {
        title: expectedTitle
      }

      // If this is from a custom rule, apply the custom color
      if (customRule && customRule.color) {
        updateOptions.color = customRule.color
        console.log(
          `[TabGroupService] Applying custom color "${customRule.color}" from rule "${customRule.name}"`
        )
      } else {
        // Check if we have a saved color for this group title
        const savedColor = await storageManager.getGroupColor(expectedTitle)
        if (savedColor) {
          updateOptions.color = savedColor
          console.log(
            `[TabGroupService] Applying saved color "${savedColor}" for group "${expectedTitle}"`
          )
        } else {
          // Use provided default color or generate a random one
          updateOptions.color = defaultColor || getRandomTabGroupColor()
          console.log(
            `[TabGroupService] Applying ${defaultColor ? "default" : "random"} color "${updateOptions.color}" for group "${expectedTitle}"`
          )
        }
      }

      await browserAPI.tabGroups.update(groupId, updateOptions)

      // Save the color mapping if we applied a color
      if (updateOptions.color) {
        await storageManager.updateGroupColor(expectedTitle, updateOptions.color)
      }

      console.log(
        `[TabGroupService] Successfully updated group ${groupId} with title "${expectedTitle}" and color "${
          updateOptions.color || "default"
        }"`
      )
    } catch (updateError) {
      console.warn(`[TabGroupService] Failed to update group ${groupId}:`, updateError)
      // Continue anyway - the group exists even if title/color update failed
    }

    console.log(`[TabGroupService] Created group ${groupId} with title "${expectedTitle}"`)

    // After creating the group, check if any other ungrouped tabs should join it
    await this.groupMatchingUngroupedTabs(expectedTitle, tab.windowId, customRule)

    return true
  }

  /**
   * Groups any ungrouped tabs that match the given group criteria
   * @param {string} expectedTitle - The group title to match
   * @param {number} windowId - The window ID
   * @param {Object|null} customRule - The custom rule if applicable
   * @returns {Promise<void>}
   */
  async groupMatchingUngroupedTabs(expectedTitle, windowId, customRule) {
    try {
      // Find the existing group by title (fresh from browser)
      const existingGroup = await this.findGroupByTitle(expectedTitle, windowId)
      if (!existingGroup) {
        console.log(`[TabGroupService] No group found with title "${expectedTitle}" to add tabs to`)
        return
      }

      // Get all tabs in this window (fresh from browser)
      const allTabs = await browserAPI.tabs.query({ windowId })
      const tabsToGroup = []

      for (const otherTab of allTabs) {
        // Skip if pinned, already in a group, or doesn't match
        if (otherTab.pinned || (otherTab.groupId && otherTab.groupId !== -1)) {
          continue
        }

        // Check if this tab matches the same group using existing logic
        let shouldGroup = false
        if (customRule) {
          const matchingRule = await rulesService.findMatchingRule(otherTab.url)
          shouldGroup = matchingRule && matchingRule.name === customRule.name
        } else {
          const includeSubDomain = tabGroupState.groupByMode === "subdomain"
          const domain = extractDomain(otherTab.url, includeSubDomain)
          const displayName = getDomainDisplayName(domain)
          shouldGroup = displayName === expectedTitle
        }

        if (shouldGroup) {
          tabsToGroup.push(otherTab.id)
        }
      }

      // Group any matching ungrouped tabs
      if (tabsToGroup.length > 0) {
        await browserAPI.tabs.group({
          tabIds: tabsToGroup,
          groupId: existingGroup.id
        })
        console.log(
          `[TabGroupService] Added ${tabsToGroup.length} ungrouped tabs to group "${expectedTitle}"`
        )
      }
    } catch (error) {
      console.error(`[TabGroupService] Error grouping matching ungrouped tabs:`, error)
    }
  }

  /**
   * Finds an existing group by title in the given window
   * @param {string} title - The group title to search for
   * @param {number} windowId - The window ID
   * @returns {Promise<Object|null>} The group object or null
   */
  async findGroupByTitle(title, windowId) {
    try {
      const groups = await browserAPI.tabGroups.query({ windowId })
      const matchingGroup = groups.find(group => group.title === title)

      if (matchingGroup) {
        console.log(
          `[TabGroupService] Found existing group ${matchingGroup.id} with title "${title}"`
        )
      } else {
        console.log(`[TabGroupService] No existing group found with title "${title}"`)
      }

      return matchingGroup || null
    } catch (error) {
      console.error(`[TabGroupService] Error finding group by title "${title}":`, error)
      return null
    }
  }

  /**
   * Groups all tabs in the current window (bulk operation)
   * @returns {Promise<boolean>} True if successful
   */
  async groupAllTabs() {
    if (!tabGroupState.autoGroupingEnabled) {
      return false
    }

    try {
      console.log(`[TabGroupService] Starting bulk grouping of all tabs`)

      const tabs = await browserAPI.tabs.query({ currentWindow: true })

      for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith("chrome-extension://")) {
          await this.handleTabUpdate(tab.id)
          // Small delay to prevent overwhelming the browser
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
   * Manually groups all tabs in the current window (ignores auto-group setting)
   * This is used for the "Group Tabs" button functionality
   * @returns {Promise<boolean>} True if successful
   */
  async groupAllTabsManually() {
    try {
      console.log(`[TabGroupService] Starting manual bulk grouping of all tabs`)

      const tabs = await browserAPI.tabs.query({ currentWindow: true })

      for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith("chrome-extension://")) {
          await this.handleTabUpdate(tab.id, true) // forceGrouping = true
          // Small delay to prevent overwhelming the browser
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
   * @returns {Promise<boolean>} True if successful
   */
  async ungroupAllTabs() {
    try {
      console.log(`[TabGroupService] Ungrouping all tabs`)
      const tabs = await browserAPI.tabs.query({ currentWindow: true })
      const groupedTabs = tabs.filter(tab => tab.groupId && tab.groupId !== -1)

      if (groupedTabs.length > 0) {
        await browserAPI.tabs.ungroup(groupedTabs.map(tab => tab.id))
        console.log(`[TabGroupService] Ungrouped ${groupedTabs.length} tabs`)
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error ungrouping tabs:`, error)
      return false
    }
  }

  /**
   * Checks if a group should be ungrouped based on minimum threshold
   * Uses browser-fetched state to handle Chrome's memory optimizations
   * @param {number} groupId - The group ID to check
   * @returns {Promise<boolean>} True if group was ungrouped
   */
  async checkGroupThreshold(groupId) {
    try {
      const minimumTabs = tabGroupState.minimumTabsForGroup || 1

      // If minimum is 1, no need to check
      if (minimumTabs <= 1) return false

      // Get fresh group details from browser (following established pattern to avoid stale state)
      const groups = await browserAPI.tabGroups.query({ groupId })
      if (groups.length === 0) return false

      const group = groups[0]

      // Get fresh tab count from browser
      const tabs = await browserAPI.tabs.query({ groupId })
      const tabCount = tabs.filter(tab => !tab.pinned).length

      console.log(
        `[TabGroupService] Group "${group.title}" has ${tabCount} tabs, minimum required: ${minimumTabs}`
      )

      if (tabCount < minimumTabs) {
        console.log(
          `[TabGroupService] Group "${group.title}" no longer meets minimum threshold, ungrouping all tabs`
        )

        // Ungroup all tabs - let browser handle the rest
        const tabIds = tabs.map(tab => tab.id)
        if (tabIds.length > 0) {
          await browserAPI.tabs.ungroup(tabIds)
          console.log(
            `[TabGroupService] Ungrouped ${tabIds.length} tabs from group "${group.title}"`
          )
        }

        return true
      }

      return false
    } catch (error) {
      console.error(`[TabGroupService] Error checking group threshold:`, error)
      return false
    }
  }

  /**
   * Removes an empty group (no-op in simplified version, browser handles this)
   * @param {number} groupId - The group ID to check and remove if empty
   * @returns {Promise<boolean>} True if successful
   */
  async removeEmptyGroup(groupId) {
    // Check if group should be ungrouped based on threshold
    await this.checkGroupThreshold(groupId)

    // Let the browser handle empty group cleanup
    console.log(`[TabGroupService] Group ${groupId} cleanup handled by browser`)
    return true
  }

  /**
   * Moves a tab to the correct group based on its current URL
   * @param {number} tabId - The tab ID to move
   * @returns {Promise<boolean>} True if successful
   */
  async moveTabToGroup(tabId) {
    // This is essentially the same as handleTabUpdate
    return await this.handleTabUpdate(tabId)
  }

  /**
   * Gets the domain for a given group ID by examining its tabs
   * @param {number} groupId - The group ID
   * @returns {Promise<string|null>} Domain or null if not found
   */
  async getGroupDomain(groupId) {
    try {
      const tabs = await browserAPI.tabs.query({ groupId })
      if (tabs.length === 0) return null

      // Extract domain from the first tab's URL
      const includeSubDomain = tabGroupState.groupByMode === "subdomain"
      const domain = extractDomain(tabs[0].url, includeSubDomain)
      return domain
    } catch (error) {
      console.error(`[TabGroupService] Error getting group domain:`, error)
      return null
    }
  }

  /**
   * Generates new random colors for all existing tab groups
   * @returns {Promise<boolean>} True if successful
   */
  async generateNewColors() {
    try {
      console.log(`[TabGroupService] Generating new colors for all groups`)

      // Get all tab groups in the current window
      const groups = await browserAPI.tabGroups.query({
        windowId: browserAPI.windows.WINDOW_ID_CURRENT
      })

      // Get all custom rules to check which groups should be skipped
      const customRules = await rulesService.getCustomRules()
      const customRuleNames = new Set()

      // Collect custom rule names that have colors defined
      for (const rule of Object.values(customRules)) {
        if (rule.color && rule.name) {
          customRuleNames.add(rule.name)
          console.log(
            `[TabGroupService] Found custom rule "${rule.name}" with color "${rule.color}" - will skip this group`
          )
        }
      }

      // Get current color mapping to update it
      const colorMapping = await storageManager.getGroupColorMapping()

      for (const group of groups) {
        // Skip groups that match custom rules with colors
        if (customRuleNames.has(group.title)) {
          console.log(
            `[TabGroupService] Skipping group "${group.title}" - it matches a custom rule with a defined color`
          )
          continue
        }

        // Pick a random color
        const randomColor = getRandomTabGroupColor()

        try {
          await browserAPI.tabGroups.update(group.id, {
            color: randomColor
          })

          // Save the color mapping for persistence
          colorMapping[group.title] = randomColor

          console.log(
            `[TabGroupService] Set group ${group.id} ("${group.title}") to color ${randomColor}`
          )
        } catch (updateError) {
          console.warn(
            `[TabGroupService] Failed to update color for group ${group.id}:`,
            updateError
          )
        }
      }

      // Save the updated color mapping
      await storageManager.saveGroupColorMapping(colorMapping)

      console.log(`[TabGroupService] Finished generating new colors for groups`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error generating new colors:`, error)
      return false
    }
  }

  /**
   * Toggles the collapsed state of all tab groups
   * @returns {Promise<Object>} Object with isCollapsed state
   */
  async toggleAllGroupsCollapse() {
    try {
      console.log(`[TabGroupService] Toggling collapse state for all groups`)

      // Get all tab groups in the current window
      const groups = await browserAPI.tabGroups.query({
        windowId: browserAPI.windows.WINDOW_ID_CURRENT
      })

      if (groups.length === 0) {
        console.log(`[TabGroupService] No groups found to toggle`)
        return { isCollapsed: false }
      }

      // Get the currently active tab to check if it's in a group
      const [activeTab] = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
      })

      let activeTabGroupId = null
      if (activeTab && activeTab.groupId !== browserAPI.tabGroups.TAB_GROUP_ID_NONE) {
        activeTabGroupId = activeTab.groupId
        console.log(
          `[TabGroupService] Active tab is in group ${activeTabGroupId}, will avoid collapsing this group`
        )
      }

      // Check current state - if any group is expanded, we'll collapse all. If all are collapsed, we'll expand all.
      const hasExpandedGroups = groups.some(group => !group.collapsed)
      const newCollapsedState = hasExpandedGroups

      for (const group of groups) {
        try {
          // Skip collapsing the group that contains the active tab (Firefox compatibility)
          if (newCollapsedState && group.id === activeTabGroupId) {
            console.log(
              `[TabGroupService] Skipping collapse of group ${group.id} containing active tab`
            )
            continue
          }

          await browserAPI.tabGroups.update(group.id, {
            collapsed: newCollapsedState
          })
          console.log(
            `[TabGroupService] Set group ${group.id} ("${group.title}") collapsed state to ${newCollapsedState}`
          )
        } catch (updateError) {
          console.warn(
            `[TabGroupService] Failed to update collapse state for group ${group.id}:`,
            updateError
          )
        }
      }

      const action = newCollapsedState ? "collapsed" : "expanded"
      console.log(`[TabGroupService] Finished ${action} ${groups.length} groups`)
      return { isCollapsed: newCollapsedState }
    } catch (error) {
      console.error(`[TabGroupService] Error toggling group collapse:`, error)
      return { isCollapsed: false }
    }
  }

  /**
   * Gets the current collapse state of all groups
   * @returns {Promise<Object>} Object with isCollapsed state
   */
  async getGroupsCollapseState() {
    try {
      const groups = await browserAPI.tabGroups.query({
        windowId: browserAPI.windows.WINDOW_ID_CURRENT
      })

      if (groups.length === 0) {
        return { isCollapsed: false }
      }

      // Get the currently active tab to check if it's in a group
      const [activeTab] = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
      })

      let activeTabGroupId = null
      if (activeTab && activeTab.groupId !== browserAPI.tabGroups.TAB_GROUP_ID_NONE) {
        activeTabGroupId = activeTab.groupId
      }

      // Check if all non-active groups are collapsed
      // (We don't count the active group since it can't be collapsed in Firefox)
      const nonActiveGroups = groups.filter(group => group.id !== activeTabGroupId)

      if (nonActiveGroups.length === 0) {
        // All groups contain the active tab (shouldn't happen, but handle it)
        return { isCollapsed: false }
      }

      const allNonActiveCollapsed = nonActiveGroups.every(group => group.collapsed)
      return { isCollapsed: allNonActiveCollapsed }
    } catch (error) {
      console.error(`[TabGroupService] Error getting collapse state:`, error)
      return { isCollapsed: false }
    }
  }

  /**
   * Restores saved colors for existing groups
   * @returns {Promise<boolean>} True if successful
   */
  async restoreSavedColors() {
    try {
      console.log(`[TabGroupService] Restoring saved colors for existing groups`)

      // Get all tab groups in the current window
      const groups = await browserAPI.tabGroups.query({
        windowId: browserAPI.windows.WINDOW_ID_CURRENT
      })

      const colorMapping = await storageManager.getGroupColorMapping()
      let restoredCount = 0

      for (const group of groups) {
        const savedColor = colorMapping[group.title]
        if (savedColor && savedColor !== group.color) {
          try {
            await browserAPI.tabGroups.update(group.id, {
              color: savedColor
            })
            restoredCount++
            console.log(
              `[TabGroupService] Restored color "${savedColor}" for group "${group.title}"`
            )
          } catch (updateError) {
            console.warn(
              `[TabGroupService] Failed to restore color for group ${group.id}:`,
              updateError
            )
          }
        }
      }

      console.log(`[TabGroupService] Restored colors for ${restoredCount} groups`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error restoring saved colors:`, error)
      return false
    }
  }

  /**
   * Collapses all tab groups
   * @returns {Promise<boolean>} True if successful
   */
  async collapseAllGroups() {
    try {
      console.log(`[TabGroupService] Collapsing all groups`)

      // Get all tab groups in the current window
      const groups = await browserAPI.tabGroups.query({
        windowId: browserAPI.windows.WINDOW_ID_CURRENT
      })

      if (groups.length === 0) {
        console.log(`[TabGroupService] No groups found to collapse`)
        return true
      }

      // Get the currently active tab to check if it's in a group
      const [activeTab] = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
      })

      let activeTabGroupId = null
      if (activeTab && activeTab.groupId !== browserAPI.tabGroups.TAB_GROUP_ID_NONE) {
        activeTabGroupId = activeTab.groupId
        console.log(
          `[TabGroupService] Active tab is in group ${activeTabGroupId}, will avoid collapsing this group`
        )
      }

      for (const group of groups) {
        try {
          // Skip collapsing the group that contains the active tab (Firefox compatibility)
          if (group.id === activeTabGroupId) {
            console.log(
              `[TabGroupService] Skipping collapse of group ${group.id} containing active tab`
            )
            continue
          }

          await browserAPI.tabGroups.update(group.id, {
            collapsed: true
          })
          console.log(`[TabGroupService] Collapsed group ${group.id} ("${group.title}")`)
        } catch (updateError) {
          console.warn(`[TabGroupService] Failed to collapse group ${group.id}:`, updateError)
        }
      }

      console.log(`[TabGroupService] Finished collapsing groups`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error collapsing groups:`, error)
      return false
    }
  }

  /**
   * Expands all tab groups
   * @returns {Promise<boolean>} True if successful
   */
  async expandAllGroups() {
    try {
      console.log(`[TabGroupService] Expanding all groups`)

      // Get all tab groups in the current window
      const groups = await browserAPI.tabGroups.query({
        windowId: browserAPI.windows.WINDOW_ID_CURRENT
      })

      if (groups.length === 0) {
        console.log(`[TabGroupService] No groups found to expand`)
        return true
      }

      for (const group of groups) {
        try {
          await browserAPI.tabGroups.update(group.id, {
            collapsed: false
          })
          console.log(`[TabGroupService] Expanded group ${group.id} ("${group.title}")`)
        } catch (updateError) {
          console.warn(`[TabGroupService] Failed to expand group ${group.id}:`, updateError)
        }
      }

      console.log(`[TabGroupService] Finished expanding all groups`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error expanding groups:`, error)
      return false
    }
  }

  // Legacy method aliases for backward compatibility
  async groupTabsWithRules() {
    return await this.groupAllTabs()
  }

  async preserveExistingGroupColors() {
    // No-op in simplified version - browser manages colors
    return true
  }
}

export const tabGroupService = new TabGroupServiceSimplified()
