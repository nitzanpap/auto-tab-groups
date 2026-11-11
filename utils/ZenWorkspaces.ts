/**
 * Zen Browser workspace ("space") support.
 *
 * Zen keeps every workspace in a single window. Its tabs.query only returns
 * the tabs of the workspace the user is looking at, while tabGroups.query
 * returns the groups of every workspace. Filing a tab into another
 * workspace's group makes Zen move the tab there: it vanishes from view and
 * the browser can hang. Groups are therefore scoped to the active workspace,
 * recognised as the groups that have at least one tab tabs.query can see.
 */

import type { Browser } from "wxt/browser"

let zenDetection: Promise<boolean> | null = null

/**
 * Whether the extension runs in Zen Browser. Detected once and cached.
 */
export function isZenBrowser(): Promise<boolean> {
  if (!zenDetection) {
    const runtime = browser.runtime as typeof browser.runtime & {
      getBrowserInfo?: () => Promise<{ name: string }>
    }
    zenDetection = runtime.getBrowserInfo
      ? runtime
          .getBrowserInfo()
          .then(info => info.name === "Zen")
          .catch(() => false)
      : Promise.resolve(false)
  }
  return zenDetection
}

/** Test hook: forget the cached detection */
export function resetZenDetection(): void {
  zenDetection = null
}

/**
 * The groups of a window that belong to the active workspace.
 * Outside Zen this is every group in the window.
 */
export async function queryGroupsInWorkspace(
  windowId: number
): Promise<Browser.tabGroups.TabGroup[]> {
  const groups = await browser.tabGroups.query({ windowId })
  if (!(await isZenBrowser())) return groups

  const tabs = await browser.tabs.query({ windowId })
  const visibleGroupIds = new Set(tabs.map(tab => tab.groupId))
  return groups.filter(group => visibleGroupIds.has(group.id))
}

/**
 * Whether a tab is in the active workspace. Always true outside Zen.
 */
export async function isInActiveWorkspace(tab: Browser.tabs.Tab): Promise<boolean> {
  if (!(await isZenBrowser())) return true

  const tabs = await browser.tabs.query({ windowId: tab.windowId })
  return tabs.some(t => t.id === tab.id)
}
