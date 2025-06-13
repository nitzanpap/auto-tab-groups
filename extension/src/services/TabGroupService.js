/**
 * Service for managing browser tab groups (Chrome-compatible version)
 */

import { tabGroupState } from "../state/TabGroupState.js"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils.js"
import { storageManager } from "../config/StorageManager.js"
import { rulesService } from "./RulesService.js"
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

      // Validate that all tabs still exist before trying to group them
      const validTabIds = []
      for (const tabId of tabIds) {
        try {
          await browserAPI.tabs.get(tabId)
          validTabIds.push(tabId)
        } catch (error) {
          console.warn(`[createGroup] Tab ${tabId} no longer exists, skipping`)
        }
      }

      if (validTabIds.length === 0) {
        console.log(`[createGroup] No valid tabs remaining for domain "${domain}"`)
        return
      }

      const groupId = await browserAPI.tabs.group({ tabIds: validTabIds })
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
  /**
   * Moves a single tab to the appropriate group based on custom rules or domain
   * @param {number} tabId - The ID of the tab to move
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
      // 1. Get tab info
      const tab = await browserAPI.tabs.get(tabId)

      // Skip pinned tabs
      if (tab.pinned) {
        console.log(`[moveTabToGroup] Skipping pinned tab ${tabId}`)
        return
      }

      if (!tab.url) return

      // 2. Resolve appropriate group using rules service
      const groupInfo = await this.resolveGroupForTab(tab)
      if (!groupInfo) return

      console.log(
        `[moveTabToGroup] Processing tab ${tabId} with URL "${tab.url}" - resolved to group "${groupInfo.displayName}" (${groupInfo.type})`
      )
      console.log(`[moveTabToGroup] Tab is currently in group: ${tab.groupId}`)

      // 3. Get all groups in the current window
      const groups = await browserAPI.tabGroups.query({ windowId: tab.windowId })
      console.log(`[moveTabToGroup] Existing groups in window:`, groups)

      // 4. Find matching existing group
      let targetGroup = null
      for (const group of groups) {
        let isMatch = false

        if (groupInfo.type === "custom") {
          // For custom rules, match by group title
          isMatch = group.title === groupInfo.name
        } else {
          // For domain groups, match by stored domain mapping
          const groupDomain = await this.getGroupDomain(group.id)
          isMatch = groupDomain === groupInfo.domain
        }

        if (isMatch) {
          targetGroup = group
          console.log(
            `[moveTabToGroup] Found matching ${groupInfo.type} group ${group.id} for "${groupInfo.displayName}"`
          )
          break
        }
      }

      if (targetGroup) {
        // Skip if tab is already in the correct group
        if (tab.groupId === targetGroup.id) {
          console.log(
            `[moveTabToGroup] Tab ${tabId} is already in the correct group for "${groupInfo.displayName}"`
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
        // 5. Create new group
        console.log(
          `[moveTabToGroup] Creating new group for "${groupInfo.displayName}" with tab ${tabId}`
        )

        // Store the old group ID for cleanup
        const oldGroupId = tab.groupId

        if (groupInfo.type === "custom") {
          await this.createCustomRuleGroup(groupInfo.name, groupInfo.rule, [tabId])
        } else {
          await this.createGroup(groupInfo.domain, [tabId])
        }

        // Clean up the old group if it's now empty
        if (oldGroupId) {
          await this.removeEmptyGroup(oldGroupId)
        }
      }
    } catch (error) {
      // Handle specific error cases
      if (error.message?.includes("No tab with id")) {
        console.log(`[moveTabToGroup] Tab ${tabId} no longer exists, skipping grouping`)
      } else {
        console.error("[moveTabToGroup] Error moving tab to group:", error)
      }
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

  /**
   * Resolves the appropriate group for a tab based on custom rules or domain
   * @param {Object} tab - The tab object
   * @returns {Promise<Object|null>} Group resolution info or null
   */
  async resolveGroupForTab(tab) {
    if (!tab.url) return null

    // Use the rules service to determine grouping
    const groupInfo = await rulesService.resolveGroupForTab(tab.url)
    if (!groupInfo) return null

    return {
      name: groupInfo.name,
      type: groupInfo.type, // 'custom' or 'domain'
      rule: groupInfo.rule,
      domain: groupInfo.domain,
      displayName:
        groupInfo.type === "custom" ? groupInfo.name : getDomainDisplayName(groupInfo.domain),
    }
  }

  /**
   * Groups all tabs using custom rules with domain fallback
   */
  async groupTabsWithRules() {
    // Prevent conflicts with ongoing operations
    const operationKey = "groupTabsWithRules"
    if (this.pendingOperations.has(operationKey)) {
      console.log("[groupTabsWithRules] Operation already in progress, skipping")
      return
    }

    this.pendingOperations.add(operationKey)
    this.isPerformingBulkOperation = true

    try {
      console.log("[groupTabsWithRules] Starting to group all tabs with rules")
      const tabs = await browserAPI.tabs.query({ currentWindow: true })
      console.log("[groupTabsWithRules] Found tabs:", tabs)
      const groupTabsMap = new Map() // Maps group name to tab IDs

      // Resolve grouping for each tab
      for (const tab of tabs) {
        // Skip pinned tabs
        if (tab.pinned) {
          console.log(`[groupTabsWithRules] Skipping pinned tab ${tab.id}`)
          continue
        }

        const groupInfo = await this.resolveGroupForTab(tab)
        if (!groupInfo) continue

        const groupKey = `${groupInfo.type}:${groupInfo.name}`
        if (!groupTabsMap.has(groupKey)) {
          groupTabsMap.set(groupKey, {
            tabs: [],
            info: groupInfo,
          })
        }
        groupTabsMap.get(groupKey).tabs.push(tab.id)
      }

      console.log(
        "[groupTabsWithRules] Grouped tabs:",
        Object.fromEntries(
          Array.from(groupTabsMap.entries()).map(([key, value]) => [key, value.tabs])
        )
      )

      // Get existing groups
      const existingGroups = await browserAPI.tabGroups.query({
        windowId: tabs[0]?.windowId,
      })
      console.log("[groupTabsWithRules] Existing groups:", existingGroups)

      // Process each group
      for (const [groupKey, groupData] of groupTabsMap.entries()) {
        const { tabs: tabIds, info } = groupData

        // Find matching existing group using robust domain resolution
        let matchingGroup = null
        for (const group of existingGroups) {
          if (info.type === "custom") {
            // For custom rules, match by group title
            if (group.title === info.name) {
              matchingGroup = group
              break
            }
          } else {
            // For domain groups, resolve domain using actual tabs in the group
            try {
              const groupTabs = await browserAPI.tabs.query({ groupId: group.id })
              if (groupTabs.length > 0) {
                const firstTab = groupTabs[0]
                const existingGroupInfo = await this.resolveGroupForTab(firstTab)
                if (existingGroupInfo && existingGroupInfo.domain === info.domain) {
                  matchingGroup = group
                  console.log(
                    `[groupTabsWithRules] Found matching group ${group.id} for domain "${info.domain}"`
                  )
                  break
                }
              }
            } catch (error) {
              console.warn(`[groupTabsWithRules] Error checking group ${group.id}:`, error)
            }
          }
        }

        if (matchingGroup) {
          console.log(
            `[groupTabsWithRules] Adding tabs to existing group "${info.displayName}":`,
            tabIds
          )
          await browserAPI.tabs.group({
            tabIds,
            groupId: matchingGroup.id,
          })
        } else {
          console.log(`[groupTabsWithRules] Creating new group "${info.displayName}":`, tabIds)

          if (info.type === "custom") {
            await this.createCustomRuleGroup(info.name, info.rule, tabIds)
          } else {
            await this.createGroup(info.domain, tabIds)
          }
        }
      }

      await logTabsAndGroups(tabs)
      console.log("[groupTabsWithRules] Tab grouping with rules complete")
    } catch (error) {
      console.error("[groupTabsWithRules] Error grouping tabs with rules:", error)
    } finally {
      this.isPerformingBulkOperation = false
      this.pendingOperations.delete(operationKey)
    }
  }

  /**
   * Creates a new tab group for a custom rule
   * @param {string} ruleName - The name of the custom rule
   * @param {Object} rule - The rule object
   * @param {number[]} tabIds - Array of tab IDs to group
   */
  async createCustomRuleGroup(ruleName, rule, tabIds) {
    if (tabIds.length === 0) return

    try {
      console.log(
        `[createCustomRuleGroup] Creating new custom group "${ruleName}" with tabs:`,
        tabIds
      )
      const groupId = await browserAPI.tabs.group({ tabIds })
      console.log(`[createCustomRuleGroup] Created group with ID ${groupId} for rule "${ruleName}"`)

      // Store the group-rule mapping (using rule name as identifier)
      tabGroupState.setGroupDomain(groupId, `custom:${ruleName}`)

      if (browserAPI.tabGroups) {
        await browserAPI.tabGroups.update(groupId, {
          title: ruleName,
          color: rule.color || "blue",
        })
        console.log(
          `[createCustomRuleGroup] Set group title to "${ruleName}" and color to ${
            rule.color || "blue"
          }`
        )
      }

      // Save the updated state with the new group mapping
      await storageManager.saveState()
    } catch (error) {
      console.error("[createCustomRuleGroup] Error creating custom rule group:", error)
    }
  }
  /**
   * Preserves existing group colors before regrouping operations
   * This ensures consistent UX when service worker restarts trigger regrouping
   * IMPORTANT: Uses same domain resolution logic as regrouping to ensure matching
   */
  async preserveExistingGroupColors() {
    try {
      console.log(
        "[preserveExistingGroupColors] Scanning existing groups to preserve current colors..."
      )

      // Check if tab groups are supported
      if (!browserAPI.tabGroups) {
        console.log("[preserveExistingGroupColors] Tab groups not supported, skipping")
        return
      }

      // Get the target window
      const targetWindow = await this.getTargetWindow()
      if (!targetWindow) {
        console.log("[preserveExistingGroupColors] No suitable window found")
        return
      }

      // Get all existing groups
      const existingGroups = await browserAPI.tabGroups.query({
        windowId: targetWindow.id,
      })

      console.log(`[preserveExistingGroupColors] Found ${existingGroups.length} existing groups`)

      let colorsPreserved = 0

      // For each existing group, determine how regrouping would resolve its tabs
      for (const group of existingGroups) {
        try {
          // Get tabs in this group to determine the domain regrouping would use
          const groupTabs = await browserAPI.tabs.query({ groupId: group.id })
          if (groupTabs.length === 0) continue

          // Use the first tab to determine how regrouping would resolve this group
          const firstTab = groupTabs[0]
          const groupInfo = await this.resolveGroupForTab(firstTab)

          if (groupInfo && group.color) {
            const targetDomain = groupInfo.domain
            const storedColor = tabGroupState.getColor(targetDomain)

            // Always update stored color to match current group color for UX consistency
            if (storedColor !== group.color) {
              console.log(
                `[preserveExistingGroupColors] Updating stored color for "${targetDomain}" from "${
                  storedColor || "none"
                }" to current "${group.color}"`
              )
              tabGroupState.setColor(targetDomain, group.color)
              colorsPreserved++
            } else {
              console.log(
                `[preserveExistingGroupColors] Color for "${targetDomain}" already matches current "${group.color}"`
              )
            }
          }
        } catch (error) {
          console.warn(`[preserveExistingGroupColors] Error processing group ${group.id}:`, error)
        }
      }

      if (colorsPreserved > 0) {
        await storageManager.saveState()
        console.log(
          `[preserveExistingGroupColors] Updated ${colorsPreserved} group colors to match current state`
        )
      } else {
        console.log(
          "[preserveExistingGroupColors] All stored colors already match current group colors"
        )
      }
    } catch (error) {
      console.error("[preserveExistingGroupColors] Error preserving existing group colors:", error)
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
