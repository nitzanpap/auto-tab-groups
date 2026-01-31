/**
 * Context Menu Service
 * Provides right-click menu functionality for tab groups
 */

import type { Browser } from "wxt/browser"
import type { TabGroupColor } from "../types"
import { extractDomain } from "../utils/DomainUtils"

/**
 * Data collected from a tab group for rule creation
 */
export interface GroupData {
  success: boolean
  name: string
  color: TabGroupColor
  domains: string[] // Base domains (simple mode)
  urls: string[] // Full URLs (explicit mode)
  error?: string
}

class ContextMenuService {
  private readonly MENU_ID_CREATE_RULE = "create-rule-from-group"
  private initialized = false

  /**
   * Initializes the context menu items
   * Should be called once when the extension starts
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[ContextMenuService] Already initialized")
      return
    }

    try {
      // Remove any existing menu items first (in case of reload)
      await browser.contextMenus.removeAll()

      // Create "Create Rule from Group" menu item
      // Uses "page" context - shows when right-clicking on any webpage
      // The tab info is still available in the callback to check if it's in a group
      await browser.contextMenus.create({
        id: this.MENU_ID_CREATE_RULE,
        title: "Create Rule from Group",
        contexts: ["page"]
      })

      // Listen for menu clicks
      browser.contextMenus.onClicked.addListener(this.handleMenuClick.bind(this))

      this.initialized = true
      console.log("[ContextMenuService] Initialized context menus")
    } catch (error) {
      console.error("[ContextMenuService] Failed to initialize:", error)
    }
  }

  /**
   * Handles context menu item clicks
   */
  private async handleMenuClick(
    info: Browser.contextMenus.OnClickData,
    tab?: Browser.tabs.Tab
  ): Promise<void> {
    if (info.menuItemId === this.MENU_ID_CREATE_RULE) {
      await this.handleCreateRuleFromGroup(tab)
    }
  }

  /**
   * Handles the "Create Rule from Group" menu item
   * Opens the rules modal with pre-populated data from the group
   */
  private async handleCreateRuleFromGroup(tab?: Browser.tabs.Tab): Promise<void> {
    if (!tab?.id) {
      console.log("[ContextMenuService] No tab provided")
      return
    }

    try {
      const groupData = await this.collectGroupData(tab.id)

      if (!groupData.success) {
        console.log(`[ContextMenuService] Cannot create rule: ${groupData.error}`)
        return
      }

      // Build URL with query params for the rules modal
      const params = new URLSearchParams({
        fromGroup: "true",
        name: groupData.name,
        color: groupData.color,
        domains: groupData.domains.join(","),
        urls: groupData.urls.join(",")
      })

      const url = browser.runtime.getURL(`/rules-modal.html?${params.toString()}`)
      await browser.tabs.create({ url, active: true })

      console.log(
        `[ContextMenuService] Opened rules modal for group "${groupData.name}" with ${groupData.domains.length} domains`
      )
    } catch (error) {
      console.error("[ContextMenuService] Error opening rules modal:", error)
    }
  }

  /**
   * Collects data from a tab group for rule creation
   */
  async collectGroupData(tabId: number): Promise<GroupData> {
    try {
      // Get the tab info
      const tab = await browser.tabs.get(tabId)

      // Check if tab is in a group
      if (!tab.groupId || tab.groupId === -1) {
        return {
          success: false,
          name: "",
          color: "blue",
          domains: [],
          urls: [],
          error: "Tab is not in a group. Please right-click on a tab that is part of a tab group."
        }
      }

      // Get all tabs in this group
      const groupTabs = await browser.tabs.query({
        groupId: tab.groupId,
        windowId: tab.windowId
      })

      if (groupTabs.length === 0) {
        return {
          success: false,
          name: "",
          color: "blue",
          domains: [],
          urls: [],
          error: "No tabs found in the group"
        }
      }

      // Extract both domains and full URLs
      const domains = this.extractUniqueDomains(groupTabs)
      const urls = this.extractFullUrls(groupTabs)

      if (domains.length === 0 && urls.length === 0) {
        return {
          success: false,
          name: "",
          color: "blue",
          domains: [],
          urls: [],
          error: "No valid URLs found in the group tabs"
        }
      }

      // Get current group info for the name and color
      const groups = await browser.tabGroups.query({ windowId: tab.windowId })
      const currentGroup = groups.find(g => g.id === tab.groupId)

      const groupName = currentGroup?.title || "New Rule"
      const groupColor = (currentGroup?.color || "blue") as TabGroupColor

      return {
        success: true,
        name: groupName,
        color: groupColor,
        domains,
        urls
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return {
        success: false,
        name: "",
        color: "blue",
        domains: [],
        urls: [],
        error: errorMessage
      }
    }
  }

  /**
   * Extracts URL patterns from an array of tabs (for explicit mode)
   * Strips the protocol to create valid patterns
   */
  extractFullUrls(tabs: Browser.tabs.Tab[]): string[] {
    const urlSet = new Set<string>()

    for (const tab of tabs) {
      if (!tab.url) continue

      // Skip system/extension URLs
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("moz-extension://")
      ) {
        continue
      }

      // Strip protocol to create a valid pattern
      // https://example.com/path -> example.com/path
      const pattern = tab.url.replace(/^https?:\/\//, "")
      urlSet.add(pattern)
    }

    return Array.from(urlSet).sort()
  }

  /**
   * Extracts unique domains from an array of tabs
   */
  extractUniqueDomains(tabs: Browser.tabs.Tab[]): string[] {
    const domainSet = new Set<string>()

    for (const tab of tabs) {
      if (!tab.url) continue

      const domain = extractDomain(tab.url)

      // Skip system/extension URLs and invalid domains
      if (domain && domain !== "system") {
        domainSet.add(domain)
      }
    }

    return Array.from(domainSet).sort()
  }
}

export const contextMenuService = new ContextMenuService()
