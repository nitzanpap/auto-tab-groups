/**
 * Service for managing browser tab groups (Chrome-compatible version)
 */

import { tabGroupState } from "../state/TabGroupState.js"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils.js"
import { storageManager } from "../config/StorageManager.js"
import "../utils/BrowserAPI.js" // Import browser compatibility layer

class TabGroupService {
  constructor() {
    // Track ongoing operations to prevent race conditions
    this.pendingOperations = new Set()
    // Flag to temporarily disable auto-grouping during bulk operations
    this.isPerformingBulkOperation = false
  }

  /**
   * Gets the domain of a group by looking at its first tab
   * @param {number} groupId
   * @returns {Promise<string|null>} The domain of the group or null if no tabs found
   */
  async getGroupDomain(groupId) {
    try {
      const tabs = await browserAPI.tabs.query({ groupId })
      if (tabs.length === 0) return null

      const firstTab = tabs[0]
      return extractDomain(firstTab.url, tabGroupState.groupBySubDomainEnabled)
    } catch (error) {
      console.error(`[getGroupDomain] Error getting domain for group ${groupId}:`, error)
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

      if (browserAPI.tabGroups) {
        await this.setGroupTitleAndColor(groupId, domain)
        await this.handleGroupColorAssignment(groupId, domain)
      } else {
        console.log("[createGroup] tabGroups API not available in this browser version")
      }
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

      // 2. Get all groups in the current window
      const groups = await browserAPI.tabGroups.query({ windowId: tab.windowId })
      console.log(`[moveTabToGroup] Existing groups in window:`, groups)

      // 3. Find group with matching domain using the same logic as groupTabsByDomain
      let targetGroup = null
      for (const group of groups) {
        const groupDomain = await this.getGroupDomain(group.id)
        if (groupDomain === domain) {
          targetGroup = group
          break
        }
      }

      if (targetGroup) {
        // Skip if tab is already in the correct group
        if (tab.groupId === targetGroup.id) {
          console.log(
            `[moveTabToGroup] Tab ${tabId} is already in the correct group for "${domain}"`
          )
          return
        }

        console.log(`[moveTabToGroup] Moving tab ${tabId} to existing group ${targetGroup.id}`)
        await browserAPI.tabs.group({
          tabIds: [tabId],
          groupId: targetGroup.id,
        })
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
          await browserAPI.tabs.group({
            tabIds: [tabId],
            groupId: freshTargetGroup.id,
          })
        } else {
          console.log(`[moveTabToGroup] Creating new group for "${domain}" with tab ${tabId}`)
          await this.createGroup(domain, [tabId])
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
      const tabs = await browserAPI.tabs.query({ groupId })
      if (tabs.length === 0) {
        console.log(`[removeEmptyGroup] Removing empty group ${groupId}`)
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

      // Available Chrome tab group colors (different from Firefox)
      const colors = ["blue", "cyan", "grey", "green", "orange", "pink", "purple", "red", "yellow"]

      // Get all groups in the current window
      const currentWindow = await browserAPI.windows.getCurrent()
      const groups = await browserAPI.tabGroups.query({
        windowId: currentWindow.id,
      })

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
        await browserAPI.tabGroups.update(group.id, { color: newColor })
        console.log(`[generateNewColors] Assigned random color "${newColor}" to domain "${domain}"`)
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

      // Get all groups in the current window
      const currentWindow = await browserAPI.windows.getCurrent()
      const groups = await browserAPI.tabGroups.query({
        windowId: currentWindow.id,
      })

      // Update each group's collapsed state
      for (const group of groups) {
        await browserAPI.tabGroups.update(group.id, { collapsed: collapse })
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
      const currentWindow = await browserAPI.windows.getCurrent()
      const groups = await browserAPI.tabGroups.query({
        windowId: currentWindow.id,
      })

      // Check if any group is collapsed
      return groups.some((group) => group.collapsed)
    } catch (error) {
      console.error("[getGroupsCollapseState] Error getting groups state:", error)
      return false
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
