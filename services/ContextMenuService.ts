/**
 * Context Menu Service
 * Provides right-click menu functionality for tab groups and adding tabs to rules
 */

import type { Browser } from "wxt/browser"
import type { CustomRule, TabGroupColor } from "../types"
import { extractDomain } from "../utils/DomainUtils"
import { rulesService } from "./RulesService"
import { tabGroupService } from "./TabGroupService"
import { tabGroupState } from "./TabGroupState"

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

/**
 * Result of adding a domain to a rule
 */
export interface AddDomainResult {
  success: boolean
  alreadyExists?: boolean
  error?: string
}

/** Prefix for dynamic "add to rule" sub-menu item IDs */
const ADD_TO_RULE_PREFIX = "add-to-rule-"

/** Detect Firefox at runtime */
const isFirefox = (): boolean => {
  try {
    return navigator.userAgent.includes("Firefox")
  } catch {
    return false
  }
}

class ContextMenuService {
  private readonly MENU_ID_CREATE_RULE = "create-rule-from-group"
  private readonly MENU_ID_ADD_TO_RULE_PARENT = "add-tab-to-rule"
  private readonly MENU_ID_NO_RULES = "add-to-rule-none"
  private initialized = false
  /** Track current sub-menu rule IDs for cleanup */
  private currentRuleMenuIds: string[] = []

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

      const contexts = this.getContextTypes()

      // Create "Create Rule from Group" menu item
      await browser.contextMenus.create({
        id: this.MENU_ID_CREATE_RULE,
        title: "Create Rule from Group",
        contexts
      })

      // Create "Add Tab to Existing Rule" parent menu item
      await browser.contextMenus.create({
        id: this.MENU_ID_ADD_TO_RULE_PARENT,
        title: "Add Tab to Existing Rule",
        contexts
      })

      // Populate rule sub-menu items
      await this.refreshRuleSubMenuItems()

      // Listen for menu clicks
      browser.contextMenus.onClicked.addListener(this.handleMenuClick.bind(this))

      this.initialized = true
      console.log("[ContextMenuService] Initialized context menus")
    } catch (error) {
      console.error("[ContextMenuService] Failed to initialize:", error)
    }
  }

  /**
   * Returns the appropriate context types based on browser
   * Firefox supports "tab" context (tab strip); Chrome does not
   * Uses type assertion because WXT types are Chrome-based and don't include "tab"
   */
  private getContextTypes(): [
    `${Browser.contextMenus.ContextType}`,
    ...`${Browser.contextMenus.ContextType}`[]
  ] {
    if (isFirefox()) {
      // "tab" is valid in Firefox but not in Chrome's type defs
      return ["page", "tab" as `${Browser.contextMenus.ContextType}`]
    }
    return ["page"]
  }

  /**
   * Rebuilds the sub-menu items under "Add Tab to Existing Rule"
   * Call this after any rule add/update/delete to keep the menu in sync
   */
  async refreshRuleSubMenuItems(): Promise<void> {
    // Remove old sub-menu items
    for (const menuId of this.currentRuleMenuIds) {
      try {
        await browser.contextMenus.remove(menuId)
      } catch {
        // Item may already be gone after removeAll
      }
    }
    this.currentRuleMenuIds = []

    const rules = tabGroupState.getCustomRulesObject()
    const enabledRules = Object.values(rules).filter(
      (rule: CustomRule) => rule.enabled && !rule.isBlacklist
    )

    if (enabledRules.length === 0) {
      // Show a disabled placeholder
      await browser.contextMenus.create({
        id: this.MENU_ID_NO_RULES,
        parentId: this.MENU_ID_ADD_TO_RULE_PARENT,
        title: "No rules yet",
        enabled: false,
        contexts: this.getContextTypes()
      })
      this.currentRuleMenuIds.push(this.MENU_ID_NO_RULES)
      return
    }

    // Sort by priority then name
    const sortedRules = [...enabledRules].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.name.localeCompare(b.name)
    })

    for (const rule of sortedRules) {
      const menuId = `${ADD_TO_RULE_PREFIX}${rule.id}`
      await browser.contextMenus.create({
        id: menuId,
        parentId: this.MENU_ID_ADD_TO_RULE_PARENT,
        title: rule.name,
        contexts: this.getContextTypes()
      })
      this.currentRuleMenuIds.push(menuId)
    }
  }

  /**
   * Handles context menu item clicks
   */
  private async handleMenuClick(
    info: Browser.contextMenus.OnClickData,
    tab?: Browser.tabs.Tab
  ): Promise<void> {
    const menuId = String(info.menuItemId)

    if (menuId === this.MENU_ID_CREATE_RULE) {
      await this.handleCreateRuleFromGroup(tab)
      return
    }

    if (menuId.startsWith(ADD_TO_RULE_PREFIX)) {
      const ruleId = menuId.slice(ADD_TO_RULE_PREFIX.length)
      await this.handleAddTabToRule(ruleId, tab)
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
   * Handles adding the current tab's domain to an existing rule
   */
  private async handleAddTabToRule(ruleId: string, tab?: Browser.tabs.Tab): Promise<void> {
    if (!tab?.url) return

    const domain = extractDomain(tab.url)
    if (!domain || domain === "system") return

    const result = await this.addDomainToRule(ruleId, domain)
    if (result.success && !result.alreadyExists) {
      // Re-group all tabs so the new domain takes effect immediately
      await tabGroupService.ungroupAllTabs()
      await tabGroupService.groupAllTabsManually()
    }
  }

  /**
   * Adds a domain to an existing rule's patterns
   * Returns whether the operation succeeded and if the domain was already present
   */
  async addDomainToRule(ruleId: string, domain: string): Promise<AddDomainResult> {
    try {
      const rules = await rulesService.getCustomRules()
      const rule = rules[ruleId]

      if (!rule) {
        return { success: false, error: `Rule with ID ${ruleId} not found` }
      }

      const normalizedDomain = domain.toLowerCase().trim()

      // Check if domain already exists in rule patterns
      if (rule.domains.some(d => d.toLowerCase() === normalizedDomain)) {
        return { success: true, alreadyExists: true }
      }

      // Append domain to patterns and update the rule
      const updatedDomains = [...rule.domains, normalizedDomain]
      await rulesService.updateRule(ruleId, {
        name: rule.name,
        domains: updatedDomains,
        color: rule.color,
        enabled: rule.enabled,
        priority: rule.priority,
        minimumTabs: rule.minimumTabs
      })

      return { success: true, alreadyExists: false }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return { success: false, error: errorMessage }
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
