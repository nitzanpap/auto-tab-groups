/**
 * Handles sorting of tab groups and moving ungrouped tabs to the end.
 * Browser is SSOT — reads current state, computes desired order, applies moves.
 *
 * Minimizes visual flash by comparing current order against desired order
 * and only moving groups that are actually out of place.
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

/**
 * Compares current group order against desired order by group ID sequence.
 * Returns true if the groups are already in the correct order.
 */
function isAlreadySorted(
  currentOrder: Array<{ id: number }>,
  desiredOrder: Array<{ id: number }>
): boolean {
  if (currentOrder.length !== desiredOrder.length) return false
  return currentOrder.every((group, i) => group.id === desiredOrder[i].id)
}

class TabSortService {
  /**
   * Sorts tab groups alphabetically (A-Z by title) in the current window,
   * then moves ungrouped non-pinned tabs to the end of the tab strip.
   * When indexing is enabled, applies numbered prefixes to titles.
   *
   * Optimized: compares current vs desired order and only moves groups
   * that are actually out of place to minimize visual flash.
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

      // Compute desired alphabetical order by stripped title
      const sorted = [...groups].sort((a, b) =>
        stripIndexPrefix(a.title ?? "").localeCompare(stripIndexPrefix(b.title ?? ""), undefined, {
          sensitivity: "base"
        })
      )

      // Update index prefixes if enabled (title-only, no moves yet)
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

      // Only move groups if the order actually changed
      if (sorted.length > 1 && !isAlreadySorted(groups, sorted)) {
        // Find groups that are out of position and only move those.
        // We move out-of-place groups to index -1 in desired order.
        // To maintain correctness, we move ALL groups from the first
        // mismatch onward — moving only individual groups could leave
        // gaps or wrong relative order.
        const firstMismatch = groups.findIndex((group, i) => group.id !== sorted[i].id)

        if (firstMismatch >= 0) {
          for (let i = firstMismatch; i < sorted.length; i++) {
            await withTabEditRetry(() => tabGroups.move(sorted[i].id, { index: -1 }))
            await new Promise(resolve => setTimeout(resolve, 10))
          }
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
