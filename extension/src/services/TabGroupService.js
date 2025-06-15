/**
 * Simplified Tab Group Service - Browser as SSOT
 * Uses browser state as the single source of truth, no complex state management
 */

import { tabGroupState } from "../state/TabGroupState.js"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils.js"
import { rulesService } from "./RulesService.js"
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

      // Step 2: Extract domain and determine expected group title
      const domain = extractDomain(tab.url, tabGroupState.groupBySubDomainEnabled)
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
          groupId: existingGroup.id,
        })
        return true
      }

      // Step 5: No group exists - create new one by grouping the tab first
      console.log(`[TabGroupService] Creating new group "${expectedTitle}" for tab ${tabId}`)

      // In Chrome, you create a group by grouping tabs, not by creating an empty group
      const groupId = await browserAPI.tabs.group({
        tabIds: [tabId],
        // windowId: tab.windowId, // Not needed when grouping existing tabs
      })

      console.log(`[TabGroupService] Tab grouped, received group ID: ${groupId}`)

      // Set the group title (with error handling)
      try {
        await browserAPI.tabGroups.update(groupId, {
          title: expectedTitle,
        })
        console.log(
          `[TabGroupService] Successfully set group ${groupId} title to "${expectedTitle}"`
        )
      } catch (updateError) {
        console.warn(`[TabGroupService] Failed to update group ${groupId} title:`, updateError)
        // Continue anyway - the group exists even if title update failed
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
      const matchingGroup = groups.find((group) => group.title === title)

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
          await new Promise((resolve) => setTimeout(resolve, 10))
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
      const groupedTabs = tabs.filter((tab) => tab.groupId && tab.groupId !== -1)

      if (groupedTabs.length > 0) {
        await browserAPI.tabs.ungroup(groupedTabs.map((tab) => tab.id))
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
      const domain = extractDomain(tabs[0].url, tabGroupState.groupBySubDomainEnabled)
      return domain
    } catch (error) {
      console.error(`[TabGroupService] Error getting group domain:`, error)
      return null
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
