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
   * Sorts tab groups alphabetically by title (A-Z or Z-A) in the current
   * window, then moves ungrouped non-pinned tabs to the end of the tab
   * strip. When indexing is enabled, applies numbered prefixes to titles.
   *
   * Optimized: compares current vs desired order and only moves groups
   * that are actually out of place to minimize visual flash.
   *
   * Chrome-only: browser.tabGroups.move() is not available in Firefox.
   */
  async sortGroups(): Promise<void> {
    const tabGroups = browser.tabGroups as unknown as TabGroupsWithMove | undefined

    if (!tabGroups?.move) {
      console.log("[TabSortService] tabGroups.move unavailable (Firefox?), skipping sort")
      return
    }

    try {
      const currentWindow = await browser.windows.getCurrent()
      if (!currentWindow.id) {
        return
      }

      const queriedGroups = await tabGroups.query({ windowId: currentWindow.id })

      if (queriedGroups.length === 0) {
        return
      }

      // browser.tabGroups.query() does not return groups in visual tab-strip
      // order (it's stable by creation/ID). To compare against the current
      // layout, derive visual order from the first tab of each group in
      // tab-index order. Falls back to queried order if no tabs resolve
      // groups (e.g., in tests).
      const allTabs = await browser.tabs.query({ windowId: currentWindow.id })
      const tabsByIndex = [...allTabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      const groupById = new Map(queriedGroups.map(g => [g.id, g]))
      const visualGroupIds: number[] = []
      const seenGroupIds = new Set<number>()
      for (const tab of tabsByIndex) {
        const gid = tab.groupId
        if (gid && gid !== -1 && !seenGroupIds.has(gid) && groupById.has(gid)) {
          seenGroupIds.add(gid)
          visualGroupIds.push(gid)
        }
      }
      const groups =
        visualGroupIds.length > 0
          ? visualGroupIds
              .map(id => groupById.get(id))
              .filter((g): g is NonNullable<typeof g> => g !== undefined)
          : queriedGroups

      // Compute desired alphabetical order by stripped title, respecting
      // the configured direction ("asc" = A-Z, "desc" = Z-A)
      const directionFactor = tabGroupState.sortGroupsDirection === "desc" ? -1 : 1
      const sorted = [...groups].sort(
        (a, b) =>
          directionFactor *
          stripIndexPrefix(a.title ?? "").localeCompare(
            stripIndexPrefix(b.title ?? ""),
            undefined,
            {
              sensitivity: "base"
            }
          )
      )

      console.log(
        `[TabSortService] sortGroups: direction=${tabGroupState.sortGroupsDirection}`,
        "current=",
        groups.map(g => g.title),
        "desired=",
        sorted.map(g => g.title)
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

      // Groups go to the front, in desired order. Ungrouped tabs are never moved:
      // they keep their order and end up after every group. Moving a single to
      // the end instead made Firefox join it to the group sitting last in the strip.
      const lastGroupedIndex = Math.max(
        -1,
        ...allTabs.filter(tab => tab.groupId && tab.groupId !== -1).map(tab => tab.index ?? 0)
      )
      const singleBeforeGroup = allTabs.some(
        tab =>
          !tab.pinned && (!tab.groupId || tab.groupId === -1) && (tab.index ?? 0) < lastGroupedIndex
      )

      if (sorted.length > 0 && (!isAlreadySorted(groups, sorted) || singleBeforeGroup)) {
        // index is a tab position, so each group goes after every tab of the groups placed before it.
        // Placing it inside an earlier group's range makes Firefox split that group.
        const groupSizes = new Map<number, number>()
        for (const tab of allTabs) {
          if (tab.groupId && tab.groupId !== -1) {
            groupSizes.set(tab.groupId, (groupSizes.get(tab.groupId) ?? 0) + 1)
          }
        }
        let targetIndex = allTabs.filter(tab => tab.pinned).length
        for (const group of sorted) {
          await withTabEditRetry(() => tabGroups.move(group.id, { index: targetIndex }))
          targetIndex += groupSizes.get(group.id) ?? 1
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    } catch (error) {
      console.error("[TabSortService] Error sorting groups:", error)
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
