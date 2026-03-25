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

const INDEX_PREFIX_PATTERN = /^\d+\. /

/**
 * Strips a leading index prefix (e.g., "1. GitHub" → "GitHub").
 * Returns the title unchanged if no prefix is present.
 */
export function stripIndexPrefix(title: string): string {
  return title.replace(INDEX_PREFIX_PATTERN, "")
}

class TabSortService {
  /**
   * Sorts tab groups alphabetically (A-Z by title) in the current window,
   * then moves ungrouped non-pinned tabs to the end of the tab strip.
   * When indexing is enabled, applies numbered prefixes to titles.
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

      if (groups.length === 0) {
        return
      }

      // Sort by stripped title so existing prefixes don't affect order
      const sorted = [...groups].sort((a, b) =>
        stripIndexPrefix(a.title ?? "").localeCompare(stripIndexPrefix(b.title ?? ""), undefined, {
          sensitivity: "base"
        })
      )

      // When indexing is enabled, update titles BEFORE moving so the
      // browser shows correct numbers immediately after the move.
      if (tabGroupState.indexGroupTitles) {
        for (let i = 0; i < sorted.length; i++) {
          const group = sorted[i]
          const strippedTitle = stripIndexPrefix(group.title || "")
          const indexedTitle = `${i + 1}. ${strippedTitle}`

          if (group.title !== indexedTitle) {
            await withTabEditRetry(() =>
              browser.tabGroups.update(group.id, { title: indexedTitle })
            )
          }
        }
      }

      // Move groups in alphabetical order (skip if only 1 group)
      if (sorted.length > 1) {
        for (const group of sorted) {
          await withTabEditRetry(() => tabGroups.move(group.id, { index: -1 }))
          await new Promise(resolve => setTimeout(resolve, 10))
        }
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
   * Removes all index prefixes from group titles in the current window.
   * Called when the indexing feature is disabled.
   */
  async stripAllIndexPrefixes(): Promise<void> {
    try {
      if (!browser.tabGroups) return

      const currentWindow = await browser.windows.getCurrent()
      if (!currentWindow.id) return

      const groups = await browser.tabGroups.query({ windowId: currentWindow.id })

      for (const group of groups) {
        const strippedTitle = stripIndexPrefix(group.title || "")
        if (group.title !== strippedTitle) {
          await withTabEditRetry(() => browser.tabGroups.update(group.id, { title: strippedTitle }))
        }
      }
    } catch (error) {
      console.error("[TabSortService] Error stripping index prefixes:", error)
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
