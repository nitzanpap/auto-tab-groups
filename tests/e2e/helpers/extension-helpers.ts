/**
 * E2E Test Helpers for Auto Tab Groups Extension
 *
 * Provides utilities for testing tab grouping functionality
 * through the extension popup and background service worker.
 */

import type { BrowserContext, Page } from "@playwright/test"
import { expect } from "@playwright/test"

/**
 * Test domain URLs for isolation
 */
export const TEST_URLS = {
  domain1: "https://example.com",
  domain1Page2: "https://example.com/page2",
  domain1Page3: "https://example.com/page3",
  domain2: "https://httpbin.org",
  domain2Page2: "https://httpbin.org/get",
  domain3: "https://jsonplaceholder.typicode.com",
  subDomain1: "https://api.github.com",
  subDomain2: "https://docs.github.com",
  ccSLD: "https://www.bbc.co.uk"
}

/**
 * Tab group information returned from browser API
 */
export interface TabGroupInfo {
  id: number
  title: string
  color: string
  collapsed: boolean
  windowId: number
}

/**
 * Tab information returned from browser API
 */
export interface TabInfo {
  id: number
  url: string
  groupId: number
  pinned: boolean
  windowId: number
}

/**
 * Get the extension ID from a browser context
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  return new Promise<string>(resolve => {
    const checkServiceWorker = () => {
      const workers = context.serviceWorkers()
      for (const worker of workers) {
        const url = worker.url()
        if (url.includes("chrome-extension://")) {
          resolve(url.split("/")[2])
          return
        }
      }
      setTimeout(checkServiceWorker, 100)
    }
    checkServiceWorker()
  })
}

/**
 * Open the extension popup
 */
export async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`
  const page = await context.newPage()
  await page.goto(popupUrl)
  await page.waitForLoadState("domcontentloaded")
  return page
}

/**
 * Open the extension sidebar
 */
export async function openSidebar(context: BrowserContext, extensionId: string): Promise<Page> {
  const sidebarUrl = `chrome-extension://${extensionId}/sidebar.html`
  const page = await context.newPage()
  await page.goto(sidebarUrl)
  await page.waitForLoadState("domcontentloaded")
  return page
}

/**
 * Send a message to the background service worker via the popup
 */
export async function sendMessage(
  popupPage: Page,
  action: string,
  payload: Record<string, unknown> = {}
): Promise<unknown> {
  return await popupPage.evaluate(
    async ({ action, payload }) => {
      return await new Promise(resolve => {
        chrome.runtime.sendMessage({ action, ...payload }, response => {
          resolve(response)
        })
      })
    },
    { action, payload }
  )
}

/**
 * Get all tab groups in the current window
 */
export async function getTabGroups(popupPage: Page): Promise<TabGroupInfo[]> {
  return await popupPage.evaluate(async () => {
    const groups = await chrome.tabGroups.query({})
    return groups.map(g => ({
      id: g.id,
      title: g.title || "",
      color: g.color,
      collapsed: g.collapsed,
      windowId: g.windowId
    }))
  })
}

/**
 * Get all tabs in the current window
 */
export async function getTabs(popupPage: Page): Promise<TabInfo[]> {
  return await popupPage.evaluate(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    return tabs.map(t => ({
      id: t.id!,
      url: t.url || "",
      groupId: t.groupId || -1,
      pinned: t.pinned || false,
      windowId: t.windowId!
    }))
  })
}

/**
 * Get tabs in a specific group
 */
export async function getTabsInGroup(popupPage: Page, groupId: number): Promise<TabInfo[]> {
  return await popupPage.evaluate(async groupId => {
    const tabs = await chrome.tabs.query({ groupId })
    return tabs.map(t => ({
      id: t.id!,
      url: t.url || "",
      groupId: t.groupId || -1,
      pinned: t.pinned || false,
      windowId: t.windowId!
    }))
  }, groupId)
}

/**
 * Create a new tab with the given URL and wait for it to load
 */
export async function createTab(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(url, { waitUntil: "domcontentloaded" })
  return page
}

/**
 * Create multiple tabs with the same URL
 */
export async function createTabs(
  context: BrowserContext,
  url: string,
  count: number
): Promise<Page[]> {
  const pages: Page[] = []
  for (let i = 0; i < count; i++) {
    const page = await createTab(context, url)
    pages.push(page)
  }
  return pages
}

/**
 * Wait for a specific group to exist with the given title
 */
export async function waitForGroup(
  popupPage: Page,
  expectedTitle: string,
  timeout = 5000
): Promise<TabGroupInfo> {
  let group: TabGroupInfo | undefined

  await expect(async () => {
    const groups = await getTabGroups(popupPage)
    group = groups.find(g => g.title === expectedTitle)
    expect(group).toBeDefined()
  }).toPass({ timeout })

  return group!
}

/**
 * Wait for a tab to be in a specific group
 */
export async function waitForTabInGroup(
  popupPage: Page,
  tabUrl: string,
  expectedGroupTitle: string,
  timeout = 5000
): Promise<void> {
  await expect(async () => {
    const tabs = await getTabs(popupPage)
    const groups = await getTabGroups(popupPage)

    const tab = tabs.find(t => t.url.includes(tabUrl))
    expect(tab).toBeDefined()

    if (tab!.groupId === -1) {
      throw new Error(`Tab ${tabUrl} is not in any group`)
    }

    const group = groups.find(g => g.id === tab!.groupId)
    expect(group).toBeDefined()
    expect(group!.title).toBe(expectedGroupTitle)
  }).toPass({ timeout })
}

/**
 * Wait for a tab to be ungrouped
 */
export async function waitForTabUngrouped(
  popupPage: Page,
  tabUrl: string,
  timeout = 5000
): Promise<void> {
  await expect(async () => {
    const tabs = await getTabs(popupPage)
    const tab = tabs.find(t => t.url.includes(tabUrl))
    expect(tab).toBeDefined()
    expect(tab!.groupId).toBe(-1)
  }).toPass({ timeout })
}

/**
 * Wait for no groups to exist
 */
export async function waitForNoGroups(popupPage: Page, timeout = 5000): Promise<void> {
  await expect(async () => {
    const groups = await getTabGroups(popupPage)
    expect(groups.length).toBe(0)
  }).toPass({ timeout })
}

/**
 * Wait for a specific number of groups
 */
export async function waitForGroupCount(
  popupPage: Page,
  count: number,
  timeout = 5000
): Promise<void> {
  await expect(async () => {
    const groups = await getTabGroups(popupPage)
    expect(groups.length).toBe(count)
  }).toPass({ timeout })
}

/**
 * Ungroup all tabs via the extension
 */
export async function ungroupAllTabs(popupPage: Page): Promise<void> {
  await sendMessage(popupPage, "ungroup")
  await waitForNoGroups(popupPage)
}

/**
 * Group all tabs via the extension (manual grouping)
 */
export async function groupAllTabs(popupPage: Page): Promise<void> {
  await sendMessage(popupPage, "group")
  // Wait a bit for grouping to complete
  await popupPage.waitForTimeout(500)
}

/**
 * Enable auto-grouping
 */
export async function enableAutoGroup(popupPage: Page): Promise<void> {
  await sendMessage(popupPage, "toggleAutoGroup", { enabled: true })
}

/**
 * Disable auto-grouping
 */
export async function disableAutoGroup(popupPage: Page): Promise<void> {
  await sendMessage(popupPage, "toggleAutoGroup", { enabled: false })
}

/**
 * Get auto-group state
 */
export async function getAutoGroupState(popupPage: Page): Promise<boolean> {
  const result = (await sendMessage(popupPage, "getAutoGroupState")) as { enabled: boolean }
  return result.enabled
}

/**
 * Set group-by mode
 */
export async function setGroupByMode(
  popupPage: Page,
  mode: "domain" | "subdomain" | "rules-only"
): Promise<void> {
  await sendMessage(popupPage, "setGroupByMode", { mode })
}

/**
 * Get group-by mode
 */
export async function getGroupByMode(
  popupPage: Page
): Promise<"domain" | "subdomain" | "rules-only"> {
  const result = (await sendMessage(popupPage, "getGroupByMode")) as {
    mode: "domain" | "subdomain" | "rules-only"
  }
  return result.mode
}

/**
 * Set minimum tabs for group
 */
export async function setMinimumTabs(popupPage: Page, minimumTabs: number): Promise<void> {
  await sendMessage(popupPage, "setMinimumTabsForGroup", { minimumTabs })
}

/**
 * Get minimum tabs for group
 */
export async function getMinimumTabs(popupPage: Page): Promise<number> {
  const result = (await sendMessage(popupPage, "getMinimumTabsForGroup")) as { minimumTabs: number }
  return result.minimumTabs
}

/**
 * Add a custom rule
 */
export async function addCustomRule(
  popupPage: Page,
  ruleData: {
    name: string
    domains: string[]
    color?: string
    enabled?: boolean
    minimumTabs?: number
  }
): Promise<string | null> {
  const result = (await sendMessage(popupPage, "addCustomRule", { ruleData })) as {
    success: boolean
    ruleId?: string
  }
  return result.success ? result.ruleId || null : null
}

/**
 * Delete a custom rule
 */
export async function deleteCustomRule(popupPage: Page, ruleId: string): Promise<boolean> {
  const result = (await sendMessage(popupPage, "deleteCustomRule", { ruleId })) as {
    success: boolean
  }
  return result.success
}

/**
 * Get all custom rules
 */
export async function getCustomRules(
  popupPage: Page
): Promise<Record<string, { id: string; name: string; domains: string[]; enabled: boolean }>> {
  const result = (await sendMessage(popupPage, "getCustomRules")) as { customRules: unknown }
  return result.customRules as Record<
    string,
    { id: string; name: string; domains: string[]; enabled: boolean }
  >
}

/**
 * Update a custom rule
 */
export async function updateCustomRule(
  popupPage: Page,
  ruleId: string,
  ruleData: {
    name?: string
    domains?: string[]
    color?: string
    enabled?: boolean
    minimumTabs?: number
  }
): Promise<boolean> {
  const result = (await sendMessage(popupPage, "updateCustomRule", { ruleId, ruleData })) as {
    success: boolean
  }
  return result.success
}

/**
 * Collapse all groups
 */
export async function collapseAllGroups(popupPage: Page): Promise<void> {
  await sendMessage(popupPage, "collapseAll")
}

/**
 * Expand all groups
 */
export async function expandAllGroups(popupPage: Page): Promise<void> {
  await sendMessage(popupPage, "expandAll")
}

/**
 * Toggle collapse state of all groups
 */
export async function toggleCollapseGroups(popupPage: Page): Promise<boolean> {
  const result = (await sendMessage(popupPage, "toggleCollapse")) as { isCollapsed: boolean }
  return result.isCollapsed
}

/**
 * Get collapse state of groups
 */
export async function getCollapseState(popupPage: Page): Promise<boolean> {
  const result = (await sendMessage(popupPage, "getGroupsCollapseState")) as {
    isCollapsed: boolean
  }
  return result.isCollapsed
}

/**
 * Wait for all groups to be collapsed
 */
export async function waitForGroupsCollapsed(popupPage: Page, timeout = 5000): Promise<void> {
  await expect(async () => {
    const groups = await getTabGroups(popupPage)
    const nonActiveGroups = groups.filter(g => !g.collapsed === false)
    expect(groups.every(g => g.collapsed)).toBe(true)
  }).toPass({ timeout })
}

/**
 * Wait for all groups to be expanded
 */
export async function waitForGroupsExpanded(popupPage: Page, timeout = 5000): Promise<void> {
  await expect(async () => {
    const groups = await getTabGroups(popupPage)
    expect(groups.every(g => !g.collapsed)).toBe(true)
  }).toPass({ timeout })
}

/**
 * Pin a tab
 */
export async function pinTab(popupPage: Page, tabUrl: string): Promise<void> {
  await popupPage.evaluate(async url => {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const tab = tabs.find(t => t.url?.includes(url))
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { pinned: true })
    }
  }, tabUrl)
}

/**
 * Unpin a tab
 */
export async function unpinTab(popupPage: Page, tabUrl: string): Promise<void> {
  await popupPage.evaluate(async url => {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const tab = tabs.find(t => t.url?.includes(url))
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { pinned: false })
    }
  }, tabUrl)
}

/**
 * Close all test tabs (keeps popup and about:blank)
 */
export async function closeTestTabs(context: BrowserContext): Promise<void> {
  const pages = context.pages()
  for (const page of pages) {
    const url = page.url()
    if (url.startsWith("http") && !url.includes("chrome-extension://")) {
      await page.close()
    }
  }
}

/**
 * Reset extension state to defaults
 */
export async function resetExtensionState(popupPage: Page): Promise<void> {
  await disableAutoGroup(popupPage)
  await ungroupAllTabs(popupPage)
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")

  // Delete all custom rules
  const rules = await getCustomRules(popupPage)
  for (const ruleId of Object.keys(rules)) {
    await deleteCustomRule(popupPage, ruleId)
  }
}

/**
 * Setup test with clean state
 */
export async function setupCleanState(context: BrowserContext, extensionId: string): Promise<Page> {
  await closeTestTabs(context)
  const popupPage = await openPopup(context, extensionId)
  await resetExtensionState(popupPage)
  return popupPage
}
