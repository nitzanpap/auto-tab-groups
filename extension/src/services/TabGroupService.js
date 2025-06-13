/**
 * Service for managing browser tab groups (Chrome-compatible version)
 */

import { tabGroupState } from "../state/TabGroupState.js"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils.js"
import { storageManager } from "../config/StorageManager.js"
import "../utils/BrowserAPI.js" // Import browser compatibility layer

// Access the unified browser API
const browserAPI = globalThis.browserAPI || (typeof browser !== "undefined" ? browser : chrome)

class TabGroupService {
  constructor() {
    // Track ongoing operations to prevent race conditions
    this.pendingOperations = new Set()
    // Flag to temporarily disable auto-grouping during bulk operations
    this.isPerformingBulkOperation = false
  }

  /**
   * Gets the domain of a group using the reliable stored mapping
   * @param {number} groupId
   * @returns {Promise<string|null>} The domain of the group or null if no mapping found
   */
  async getGroupDomain(groupId) {
    try {
      // Primary method: Use stored group-domain mapping
      const storedDomain = tabGroupState.getGroupDomain(groupId)
      if (storedDomain) {
        return storedDomain
      }

      // Fallback: Parse from group title for existing groups without stored mapping
      const group = await browserAPI.tabGroups.get(groupId)
      if (group && group.title) {
        const title = group.title
        if (title === "") return "extensions"

        // Convert display name back to domain
        const domain = title.includes(".") ? title : `${title}.com`

        // Store this mapping for future use
        tabGroupState.setGroupDomain(groupId, domain)
        await storageManager.saveState()

        return domain
      }

      return null
    } catch (error) {
      // Group was likely removed, check if we have it in our stored mappings
      const storedDomain = tabGroupState.getGroupDomain(groupId)
      if (storedDomain) {
        console.log(
          `[getGroupDomain] Group ${groupId} no longer exists but found stored domain: ${storedDomain}`
        )
        return storedDomain
      }

      // Only log as warning since this is expected behavior when groups are removed
      console.warn(`[getGroupDomain] Group ${groupId} no longer exists and no stored mapping found`)
      return null
    }
  }

  /**
   * Creates a new tab group for a domain
   * @param {string} domain
   * @param {number[]} tabIds
   */
  async createGroup(domain, tabIds) {
    if (tabIds.length === 0) return

    try {
      console.log(`[createGroup] Creating new group for domain "${domain}" with tabs:`, tabIds)
      const groupId = await browserAPI.tabs.group({ tabIds })
      console.log(`[createGroup] Created group with ID ${groupId} for domain "${domain}"`)

      // Store the group-domain mapping immediately
      tabGroupState.setGroupDomain(groupId, domain)

      if (browserAPI.tabGroups) {
        await this.setGroupTitleAndColor(groupId, domain)
        await this.handleGroupColorAssignment(groupId, domain)
      } else {
        console.log("[createGroup] tabGroups API not available in this browser version")
      }

      // Save the updated state with the new group mapping
      await storageManager.saveState()
    } catch (error) {
      console.error("[createGroup] Error creating group:", error)
    }
  }

  /**
   * Sets the title and color for a tab group
   * @param {number} groupId
   * @param {string} domain
   */
  async setGroupTitleAndColor(groupId, domain) {
    if (!groupId) return

    try {
      const displayName = getDomainDisplayName(domain)
      console.log(`[setGroupTitleAndColor] Setting title "${displayName}" for group ${groupId}`)
      const groupInfo = await browserAPI.tabGroups.get(groupId)
      const updateProperties = {
        title: displayName ?? groupInfo.title,
      }

      if (domain && tabGroupState.getColor(domain)) {
        updateProperties.color = tabGroupState.getColor(domain)
        console.log(
          `[setGroupTitleAndColor] Also setting color "${updateProperties.color}" for group ${groupId}`
        )
      }

      await browserAPI.tabGroups.update(groupId, updateProperties)
    } catch (error) {
      console.error("[setGroupTitleAndColor] Error setting group title/color:", error)
    }
  }

  /**
   * Handles color assignment for a new group
   * @param {number} groupId
   * @param {string} domain
   */
  async handleGroupColorAssignment(groupId, domain) {
    try {
      const groupInfo = await browserAPI.tabGroups.get(groupId)
      if (!tabGroupState.getColor(domain)) {
        tabGroupState.setColor(domain, groupInfo.color)
        await storageManager.saveState()
      }

      const displayName = getDomainDisplayName(domain)
      if (tabGroupState.getColor(domain) !== groupInfo.color || groupInfo.title !== displayName) {
        await this.setGroupTitleAndColor(groupId, domain)
      }
    } catch (error) {
      console.error("Error handling group color assignment:", error)
    }
  }

  /**
   * Groups all tabs in the current window by domain
   */
  async groupTabsByDomain() {
    // Prevent conflicts with ongoing moveTabToGroup operations
    const operationKey = "groupTabsByDomain"
    if (this.pendingOperations.has(operationKey)) {
      console.log("[groupTabsByDomain] Operation already in progress, skipping")
      return
    }

    this.pendingOperations.add(operationKey)
    this.isPerformingBulkOperation = true

    try {
      console.log("[groupTabsByDomain] Starting to group all tabs by domain")
      const tabs = await browserAPI.tabs.query({ currentWindow: true })
      console.log("[groupTabsByDomain] Found tabs:", tabs)
      const domainTabsMap = new Map()

      // Group tabs by domain
      for (const tab of tabs) {
        // Skip pinned tabs
        if (tab.pinned) {
          console.log(`[groupTabsByDomain] Skipping pinned tab ${tab.id}`)
          continue
        }

        if (!tab.url) continue
        const domain = extractDomain(tab.url, tabGroupState.groupBySubDomainEnabled)
        if (!domain) continue

        if (!domainTabsMap.has(domain)) {
          domainTabsMap.set(domain, [])
        }
        domainTabsMap.get(domain).push(tab.id)
      }

      console.log("[groupTabsByDomain] Grouped tabs by domain:", Object.fromEntries(domainTabsMap))

      // Get existing groups
      const existingGroups = await browserAPI.tabGroups.query({
        windowId: tabs[0].windowId,
      })
      console.log("[groupTabsByDomain] Existing groups:", existingGroups)

      // Process each domain
      for (const [domain, tabIds] of domainTabsMap.entries()) {
        // Find a matching group by checking the domain of its first tab
        let matchingGroup = null
        for (const group of existingGroups) {
          const groupDomain = await this.getGroupDomain(group.id)
          if (groupDomain === domain) {
            matchingGroup = group
            break
          }
        }

        if (matchingGroup) {
          console.log(`[groupTabsByDomain] Adding tabs to existing group for "${domain}":`, tabIds)
          await browserAPI.tabs.group({
            tabIds,
            groupId: matchingGroup.id,
          })
        } else {
          console.log(`[groupTabsByDomain] Creating new group for "${domain}":`, tabIds)
          await this.createGroup(domain, tabIds)
        }
      }

      await logTabsAndGroups(tabs)
      console.log("[groupTabsByDomain] Tab grouping complete")
    } catch (error) {
      console.error("[groupTabsByDomain] Error grouping tabs:", error)
    } finally {
      this.isPerformingBulkOperation = false
      this.pendingOperations.delete(operationKey)
    }
  }

  /**
   * Ungroups all tabs in the current window
   */
  async ungroupAllTabs() {
    this.isPerformingBulkOperation = true

    try {
      const tabs = await browserAPI.tabs.query({ currentWindow: true })
      for (const tab of tabs) {
        try {
          await browserAPI.tabs.ungroup(tab.id)
        } catch (error) {
          console.error(`Error ungrouping tab ${tab.id}:`, error)
        }
      }
      console.log("All tabs ungrouped")
    } catch (error) {
      console.error("Error ungrouping tabs:", error)
    } finally {
      this.isPerformingBulkOperation = false
    }
  }

  /**
   * Moves a tab to its appropriate group based on domain
   * @param {number} tabId
   */
  async moveTabToGroup(tabId) {
    if (!tabGroupState.autoGroupingEnabled) return

    // Skip auto-grouping during bulk operations to prevent race conditions
    if (this.isPerformingBulkOperation) {
      console.log(`[moveTabToGroup] Bulk operation in progress, skipping tab ${tabId}`)
      return
    }

    // Prevent race conditions by tracking ongoing operations
    const operationKey = `moveTab-${tabId}`
    if (this.pendingOperations.has(operationKey)) {
      console.log(`[moveTabToGroup] Operation already pending for tab ${tabId}, skipping`)
      return
    }

    this.pendingOperations.add(operationKey)

    try {
      // 1. Get tab info and extract domain
      const tab = await browserAPI.tabs.get(tabId)

      // Skip pinned tabs
      if (tab.pinned) {
        console.log(`[moveTabToGroup] Skipping pinned tab ${tabId}`)
        return
      }

      if (!tab.url) return

      const domain = extractDomain(tab.url, tabGroupState.groupBySubDomainEnabled)
      if (!domain) return

      console.log(
        `[moveTabToGroup] Processing tab ${tabId} with URL "${tab.url}" and domain "${domain}"`
      )
      console.log(`[moveTabToGroup] Tab is currently in group: ${tab.groupId}`)

      // 2. Get all groups in the current window
      const groups = await browserAPI.tabGroups.query({ windowId: tab.windowId })
      console.log(`[moveTabToGroup] Existing groups in window:`, groups)

      // 3. Find group with matching domain using the same logic as groupTabsByDomain
      let targetGroup = null
      for (const group of groups) {
        const groupDomain = await this.getGroupDomain(group.id)
        console.log(`[moveTabToGroup] Group ${group.id} has domain: ${groupDomain}`)
        if (groupDomain === domain) {
          targetGroup = group
          break
        }
      }

      if (targetGroup) {
        console.log(`[moveTabToGroup] Found target group ${targetGroup.id} for domain "${domain}"`)

        // Skip if tab is already in the correct group
        if (tab.groupId === targetGroup.id) {
          console.log(
            `[moveTabToGroup] Tab ${tabId} is already in the correct group for "${domain}"`
          )
          return
        }

        console.log(
          `[moveTabToGroup] Moving tab ${tabId} from group ${tab.groupId} to existing group ${targetGroup.id}`
        )

        // Store the old group ID for cleanup
        const oldGroupId = tab.groupId

        await browserAPI.tabs.group({
          tabIds: [tabId],
          groupId: targetGroup.id,
        })

        // Clean up the old group if it's now empty
        if (oldGroupId && oldGroupId !== targetGroup.id) {
          await this.removeEmptyGroup(oldGroupId)
        }
      } else {
        // Double-check: query groups again to avoid race conditions
        const freshGroups = await browserAPI.tabGroups.query({ windowId: tab.windowId })
        let freshTargetGroup = null
        for (const group of freshGroups) {
          const groupDomain = await this.getGroupDomain(group.id)
          if (groupDomain === domain) {
            freshTargetGroup = group
            break
          }
        }

        if (freshTargetGroup) {
          console.log(
            `[moveTabToGroup] Found existing group ${freshTargetGroup.id} on second check, moving tab ${tabId}`
          )

          // Store the old group ID for cleanup
          const oldGroupId = tab.groupId

          await browserAPI.tabs.group({
            tabIds: [tabId],
            groupId: freshTargetGroup.id,
          })

          // Clean up the old group if it's now empty
          if (oldGroupId && oldGroupId !== freshTargetGroup.id) {
            await this.removeEmptyGroup(oldGroupId)
          }
        } else {
          console.log(`[moveTabToGroup] Creating new group for "${domain}" with tab ${tabId}`)

          // Store the old group ID for cleanup
          const oldGroupId = tab.groupId

          await this.createGroup(domain, [tabId])

          // Clean up the old group if it's now empty
          if (oldGroupId) {
            await this.removeEmptyGroup(oldGroupId)
          }
        }
      }
    } catch (error) {
      console.error("[moveTabToGroup] Error moving tab to group:", error)
    } finally {
      this.pendingOperations.delete(operationKey)
    }
  }

  /**
   * Removes a group if it's empty
   * @param {number} groupId
   */
  async removeEmptyGroup(groupId) {
    try {
      console.log(`[removeEmptyGroup] Checking if group ${groupId} is empty`)
      const tabs = await browserAPI.tabs.query({ groupId })
      if (tabs.length === 0) {
        console.log(`[removeEmptyGroup] Group ${groupId} is empty, cleaning up mapping`)
        // Remove the group-domain mapping
        tabGroupState.removeGroup(groupId)
        await storageManager.saveState()
        // Note: In Chrome, empty groups are automatically removed by the browser
      } else {
        console.log(`[removeEmptyGroup] Group ${groupId} still has ${tabs.length} tabs, keeping it`)
      }
    } catch (error) {
      console.error(`[removeEmptyGroup] Error checking empty group ${groupId}:`, error)
    }
  }

  /**
   * Generates new colors for all domains in the current window
   */
  async generateNewColors() {
    try {
      console.log("[generateNewColors] Starting to generate new colors for all groups")

      // Check if tab groups are supported in this browser
      if (!browserAPI.tabGroups) {
        console.log("[generateNewColors] Tab groups not supported in this browser, skipping")
        return
      }

      // Available Chrome tab group colors
      const colors = ["blue", "cyan", "grey", "green", "orange", "pink", "purple", "red", "yellow"]

      // Get the main browser window (not popup) that contains tab groups
      const targetWindow = await this.getTargetWindow()
      if (!targetWindow) {
        console.log("[generateNewColors] No suitable window found")
        return
      }

      const groups = await browserAPI.tabGroups.query({
        windowId: targetWindow.id,
      })
      console.log("[generateNewColors] Found groups:", groups)

      // Clear existing color mappings, except manually set ones if preserveManualColors is true
      if (tabGroupState.preserveManualColors) {
        // Only clear colors for domains that weren't manually set
        for (const [domain] of tabGroupState.getDomainColors()) {
          if (!tabGroupState.manuallySetColors.has(domain)) {
            tabGroupState.domainColors.delete(domain)
          }
        }
      } else {
        tabGroupState.domainColors.clear()
        tabGroupState.manuallySetColors.clear()
      }

      // Create a copy of the colors array to track available colors
      let availableColors = [...colors]

      // Assign random colors to each group
      for (const group of groups) {
        const domain = await this.getGroupDomain(group.id)
        if (!domain) continue

        // Skip if the domain has a manually set color and we're preserving manual colors
        if (tabGroupState.preserveManualColors && tabGroupState.manuallySetColors.has(domain)) {
          console.log(`[generateNewColors] Preserving manual color for domain "${domain}"`)
          continue
        }

        // If we've used all colors, refill the available colors
        if (availableColors.length === 0) {
          availableColors = [...colors]
        }

        // Pick a random color from the available ones
        const randomIndex = Math.floor(Math.random() * availableColors.length)
        const newColor = availableColors[randomIndex]
        // Remove the used color from available colors
        availableColors.splice(randomIndex, 1)

        tabGroupState.setColor(domain, newColor)

        // Update the group's color
        try {
          await browserAPI.tabGroups.update(group.id, { color: newColor })
          console.log(`[generateNewColors] Assigned color "${newColor}" to domain "${domain}"`)
        } catch (updateError) {
          console.error(`[generateNewColors] Error updating group ${group.id}:`, updateError)
        }
      }

      // Save the new color mappings
      await storageManager.saveState()
      console.log("[generateNewColors] New colors generated and saved successfully")
    } catch (error) {
      console.error("[generateNewColors] Error generating new colors:", error)
    }
  }

  /**
   * Toggles collapse state for all groups in the current window
   * @param {boolean} collapse - Whether to collapse (true) or expand (false)
   */
  async toggleAllGroupsCollapse(collapse) {
    try {
      console.log(
        `[toggleAllGroupsCollapse] Setting all groups to ${collapse ? "collapsed" : "expanded"}`
      )

      // Check if tab groups are supported in this browser
      if (!browserAPI.tabGroups) {
        console.log("[toggleAllGroupsCollapse] Tab groups not supported in this browser, skipping")
        return
      }

      // Get the main browser window (not popup) that contains tab groups
      const targetWindow = await this.getTargetWindow()
      if (!targetWindow) {
        console.log("[toggleAllGroupsCollapse] No suitable window found")
        return
      }

      const groups = await browserAPI.tabGroups.query({
        windowId: targetWindow.id,
      })
      console.log("[toggleAllGroupsCollapse] Found groups:", groups)

      // Update each group's collapsed state
      for (const group of groups) {
        try {
          await browserAPI.tabGroups.update(group.id, { collapsed: collapse })
        } catch (updateError) {
          console.error(`[toggleAllGroupsCollapse] Error updating group ${group.id}:`, updateError)
        }
      }

      console.log(
        `[toggleAllGroupsCollapse] Successfully ${collapse ? "collapsed" : "expanded"} all groups`
      )
    } catch (error) {
      console.error("[toggleAllGroupsCollapse] Error toggling groups:", error)
    }
  }

  /**
   * Gets the collapse state of groups in the current window
   * @returns {Promise<boolean>} True if any group is collapsed, false if all are expanded
   */
  async getGroupsCollapseState() {
    try {
      // Check if tab groups are supported in this browser
      if (!browserAPI.tabGroups) {
        console.log("[getGroupsCollapseState] Tab groups not supported in this browser")
        return false
      }

      // Get the main browser window (not popup) that contains tab groups
      const targetWindow = await this.getTargetWindow()
      if (!targetWindow) {
        console.log("[getGroupsCollapseState] No suitable window found")
        return false
      }

      const groups = await browserAPI.tabGroups.query({
        windowId: targetWindow.id,
      })

      // Check if any group is collapsed
      const isCollapsed = groups.some((group) => group.collapsed)
      return isCollapsed
    } catch (error) {
      console.error("[getGroupsCollapseState] Error getting groups state:", error)
      return false
    }
  }

  /**
   * Gets the target browser window for tab group operations
   * Avoids popup windows and finds the main browser window with tab groups
   * @returns {Promise<Object|null>} The target window object or null if none found
   */
  async getTargetWindow() {
    try {
      const windows = await browserAPI.windows.getAll({ windowTypes: ["normal"] })

      if (windows.length === 0) {
        console.log("[getTargetWindow] No normal windows found")
        return null
      }

      if (windows.length === 1) {
        // Only one normal window, use it
        return windows[0]
      }

      // Multiple windows, try to find the focused one first
      const focusedWindow = windows.find((w) => w.focused)
      if (focusedWindow) {
        return focusedWindow
      }

      // Fall back to the window with the most tabs
      let targetWindow = windows[0]
      let maxTabs = 0

      for (const window of windows) {
        const tabs = await browserAPI.tabs.query({ windowId: window.id })
        if (tabs.length > maxTabs) {
          maxTabs = tabs.length
          targetWindow = window
        }
      }

      return targetWindow
    } catch (error) {
      console.error("[getTargetWindow] Error determining target window:", error)
      return null
    }
  }
}

export const tabGroupService = new TabGroupService()

async function logTabsAndGroups(tabs) {
  console.log(
    "[groupTabsByDomain] All current tabs before cleanup:",
    tabs.map((tab) => (tab.url ? tab.url : "No URL"))
  )
  console.log("[groupTabsByDomain] Tab grouping complete")

  // Check if tab groups are supported in this browser
  if (!browserAPI.tabGroups) {
    console.log(
      "[logTabsAndGroups] Tab groups not supported in this browser, skipping group logging"
    )
    return
  }

  const allGroups = await browserAPI.tabGroups.query({
    windowId: tabs[0].windowId,
  })
  const groupedDomains = await Promise.all(
    allGroups.map(async (group) => {
      const groupDomain = await tabGroupService.getGroupDomain(group.id)
      if (!groupDomain) {
        console.warn(`[groupTabsByDomain] Group ${group.id} has no domain, skipping`)
        return null
      }
      const tabsInGroup = await browserAPI.tabs.query({ groupId: group.id })
      const domainsInGroup = tabsInGroup
        .filter((tab) => tab.url) // Filter out tabs without URLs
        .map((tab) => extractDomain(tab.url, tabGroupState.groupBySubDomainEnabled))
        .filter(Boolean)
      return {
        groupTitle: group.title || groupDomain,
        tabsDomainsInside: Array.from(new Set(domainsInGroup)),
      }
    })
  )
  console.log("[groupTabsByDomain] All groups with domains:", groupedDomains)
}
