/**
 * Handles sorting of tab groups and moving ungrouped tabs to the end.
 * Browser is SSOT — reads current state, computes desired order, applies moves.
 */

import { withTabEditRetry } from "../utils/withTabEditRetry"
import { tabGroupState } from "./TabGroupState"

/**
 * Extended tabGroups API with move() — Chrome-only, not in webextension-polyfill types
 */
interface TabGroupsWithMove {
  move(groupId: number, moveProperties: { index: number }): Promise<void>
  query(
    queryInfo: Record<string, unknown>
  ): Promise<Array<{ id: number; title?: string; windowId: number }>>
}

class TabSortService {
  /**
   * Sorts tab groups alphabetically (A-Z by title) in the current window,
   * then moves ungrouped non-pinned tabs to the end of the tab strip.
   *
   * Chrome-only: browser.tabGroups.move() is not available in Firefox.
   */
  async sortGroups(): Promise<void> {
    const tabGroups = browser.tabGroups as unknown as TabGroupsWithMove | undefined

    if (!tabGroups?.move) {
      return
    }

    try {
      const currentWindow = await browser.windows.getCurrent()
      if (!currentWindow.id) {
        return
      }

      const groups = await tabGroups.query({ windowId: currentWindow.id })

      if (groups.length <= 1) {
        return
      }

      const sorted = [...groups].sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" })
      )

      for (const group of sorted) {
        await withTabEditRetry(() => tabGroups.move(group.id, { index: -1 }))
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      await this.moveUngroupedTabsToEnd(currentWindow.id)
    } catch (error) {
      console.error("[TabSortService] Error sorting groups:", error)
    }
  }

  /**
   * Moves all ungrouped, non-pinned tabs to the end of the tab strip.
   */
  private async moveUngroupedTabsToEnd(windowId: number): Promise<void> {
    try {
      const allTabs = await browser.tabs.query({ windowId })
      const ungroupedTabs = allTabs.filter(
        tab => !tab.pinned && (!tab.groupId || tab.groupId === -1)
      )

      for (const tab of ungroupedTabs) {
        if (tab.id !== undefined) {
          await withTabEditRetry(() => browser.tabs.move(tab.id!, { index: -1 }))
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    } catch (error) {
      console.error("[TabSortService] Error moving ungrouped tabs:", error)
    }
  }

  /**
   * Applies sorting if the setting is enabled.
   * Called after grouping operations complete.
   */
  async applySorting(): Promise<void> {
    if (tabGroupState.sortGroupsAlphabetically) {
      await this.sortGroups()
    }
  }
}

export const tabSortService = new TabSortService()
