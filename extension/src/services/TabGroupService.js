/**
 * Simplified Tab Group Service - Browser as SSOT
 * Uses browser state as the single source of truth, no complex state management
 */

import { tabGroupState } from "../state/TabGroupState.js"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils.js"
import { rulesService } from "./RulesService.js"
import { storageManager } from "../config/StorageManager.js"
import "../utils/BrowserAPI.js"

const browserAPI = globalThis.browserAPI || (typeof browser !== "undefined" ? browser : chrome)

class TabGroupServiceSimplified {
  /**
   * Handles a tab update - moves tab to correct group based on its current URL
   * @param {number} tabId - The tab ID that changed
   * @returns {Promise<boolean>} True if successful
   */
  async handleTabUpdate(tabId) {
    if (!tabGroupState.autoGroupingEnabled) {
      return false
    }

    try {
      console.log(`[TabGroupService] Processing tab ${tabId}`)

      // Step 1: Get tab info from browser (SSOT)
      const tab = await browserAPI.tabs.get(tabId)
      console.log(`[TabGroupService] Tab URL: ${tab.url}`)

      // Step 1.5: Check if tab is pinned - pinned tabs should not be grouped
      if (tab.pinned) {
        console.log(`[TabGroupService] Tab ${tabId} is pinned, skipping grouping`)
        return false
      }

      // Step 2: Handle grouping mode
      if (tabGroupState.groupByMode === "rules") {
        // Rules-only mode: only group by custom rules
        const customRule = await rulesService.findMatchingRule(tab.url)
        if (!customRule) {
          console.log(`[TabGroupService] Rules-only mode: No custom rule found for ${tab.url}, skipping`)
          return false
        }
        
        const expectedTitle = customRule.name
        
        // Find or create group based on custom rule
        const existingGroup = await this.findGroupByTitle(expectedTitle, tab.windowId)
        
        if (existingGroup) {
          if (tab.groupId === existingGroup.id) {
            console.log(`[TabGroupService] Tab ${tabId} already in correct group ${existingGroup.id}`)
            return true
          }
          
          await browserAPI.tabs.group({
            tabIds: [tabId],
            groupId: existingGroup.id
          })
          
          if (customRule.color && existingGroup.color !== customRule.color) {
            try {
              await browserAPI.tabGroups.update(existingGroup.id, {
                color: customRule.color
              })
            } catch (colorError) {
              console.warn(`[TabGroupService] Failed to update existing group color:`, colorError)
            }
          }
          return true
        }
        
        // Create new group
        const groupId = await browserAPI.tabs.group({
          tabIds: [tabId]
        })
        
        try {
          await browserAPI.tabGroups.update(groupId, {
            title: expectedTitle,
            color: customRule.color || "blue"
          })
          
          if (customRule.color) {
            await storageManager.updateGroupColor(expectedTitle, customRule.color)
          }
        } catch (updateError) {
          console.warn(`[TabGroupService] Failed to update group ${groupId}:`, updateError)
        }
        
        return true
      }
      
      // Step 2: Extract domain for domain/subdomain modes
      const includeSubDomain = tabGroupState.groupByMode === "subdomain"
      const domain = extractDomain(tab.url, includeSubDomain)
      if (!domain) {
        console.log(`[TabGroupService] No domain extracted, skipping`)
        return false
      }

      // Step 3: Check for custom rules first
      const customRule = await rulesService.findMatchingRule(domain)
      const expectedTitle = customRule ? customRule.name : getDomainDisplayName(domain)

      console.log(`[TabGroupService] Expected group title: "${expectedTitle}"`)

      // Step 4: Find existing group by title (browser as SSOT)
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

      // Step 5: No group exists - create new one by grouping the tab first
      console.log(`[TabGroupService] Creating new group "${expectedTitle}" for tab ${tabId}`)

      // In Chrome, you create a group by grouping tabs, not by creating an empty group
      const groupId = await browserAPI.tabs.group({
        tabIds: [tabId]
        // windowId: tab.windowId, // Not needed when grouping existing tabs
      })

      console.log(`[TabGroupService] Tab grouped, received group ID: ${groupId}`)

      // Set the group title and color (with error handling)
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
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error processing tab ${tabId}:`, error)
      return false
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
   * Removes an empty group (no-op in simplified version, browser handles this)
   * @param {number} groupId - The group ID to check and remove if empty
   * @returns {Promise<boolean>} True if successful
   */
  async removeEmptyGroup(groupId) {
    // In the simplified version, we let the browser handle empty group cleanup
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

      // Available colors in Chrome
      const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"]

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
        const randomColor = colors[Math.floor(Math.random() * colors.length)]

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
