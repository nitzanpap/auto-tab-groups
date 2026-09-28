/**
 * Tab Comparison Service
 * Manages interactive comparison workflow between two tabs.
 * Workflow:
 * 1. User initiates compare mode on Tab A (source tab).
 * 2. Icon badge updates to 'CMP'.
 * 3. User navigates or switches to Tab B (target tab).
 * 4. Tabs A & B are grouped together into "Comparison" group with purple color.
 * 5. Badge clears, comparison session completes.
 * 6. User can cancel comparison to restore tabs back to their original groups.
 */

import type { Browser } from "wxt/browser"
import { comparisonSession } from "../utils/storage"
import { withTabEditRetry } from "../utils/withTabEditRetry"

export const COMPARISON_GROUP_TITLE = "Comparison"

export class TabComparisonService {
  private active = false
  private sourceTabId: number | null = null
  private targetTabId: number | null = null
  private comparisonGroupId: number | null = null
  private sourceParentGroupId: number | null = null
  private targetParentGroupId: number | null = null

  async initialize(): Promise<void> {
    try {
      const state = await comparisonSession.getValue()
      this.active = state.active
      this.sourceTabId = state.sourceTabId
      this.targetTabId = state.targetTabId ?? null
      this.comparisonGroupId = state.comparisonGroupId ?? null
      this.sourceParentGroupId = state.sourceParentGroupId ?? null
      this.targetParentGroupId = state.targetParentGroupId ?? null
      if (this.active) {
        await this.updateBadge(true)
      }
    } catch {
      this.resetState()
    }
  }

  isComparisonActive(): boolean {
    return this.active
  }

  getSourceTabId(): number | null {
    return this.sourceTabId
  }

  getTargetTabId(): number | null {
    return this.targetTabId
  }

  getComparisonGroupId(): number | null {
    return this.comparisonGroupId
  }

  async startComparison(sourceTabId: number): Promise<void> {
    this.active = true
    this.sourceTabId = sourceTabId
    this.targetTabId = null
    this.comparisonGroupId = null

    let sourceParentGroupId: number | null = null
    try {
      const sourceTab = await browser.tabs.get(sourceTabId)
      if (sourceTab?.groupId && sourceTab.groupId !== -1) {
        sourceParentGroupId = sourceTab.groupId
      }
    } catch {
      // Tab may not be ready or accessible
    }
    this.sourceParentGroupId = sourceParentGroupId
    this.targetParentGroupId = null

    await comparisonSession.setValue({
      active: true,
      sourceTabId,
      startedAt: Date.now(),
      targetTabId: null,
      comparisonGroupId: null,
      sourceParentGroupId,
      targetParentGroupId: null
    })
    await this.updateBadge(true)
    console.log(`[TabComparisonService] Started comparison with sourceTabId: ${sourceTabId}`)
  }

  async cancelComparison(): Promise<void> {
    const compGroupId = this.comparisonGroupId
    const sourceId = this.sourceTabId
    const targetId = this.targetTabId
    const sourceParentId = this.sourceParentGroupId
    const targetParentId = this.targetParentGroupId

    if (compGroupId !== null || sourceId !== null || targetId !== null) {
      const { tabGroupService } = await import("./TabGroupService")

      const restoreTab = async (tabId: number | null, parentGroupId: number | null) => {
        if (!tabId) return
        try {
          const tab = await browser.tabs.get(tabId)
          if (!tab) return

          let restoredToParent = false
          if (parentGroupId !== null && parentGroupId !== -1 && browser.tabGroups) {
            try {
              const parentGroup = await browser.tabGroups.get(parentGroupId)
              if (parentGroup) {
                await withTabEditRetry(() =>
                  browser.tabs.group({
                    tabIds: [tabId] as [number, ...number[]],
                    groupId: parentGroupId
                  })
                )
                restoredToParent = true
              }
            } catch {
              // Parent group no longer exists
            }
          }

          if (!restoredToParent) {
            if (tab.groupId && tab.groupId !== -1) {
              await withTabEditRetry(() => browser.tabs.ungroup([tabId]))
            }
            await tabGroupService.handleTabUpdate(tabId, true)
          }
        } catch {
          // Tab may have been closed
        }
      }

      await restoreTab(sourceId, sourceParentId)
      await restoreTab(targetId, targetParentId)
    }

    this.resetState()
    await comparisonSession.setValue({
      active: false,
      sourceTabId: null,
      targetTabId: null,
      startedAt: null,
      comparisonGroupId: null,
      sourceParentGroupId: null,
      targetParentGroupId: null
    })
    await this.updateBadge(false)
    console.log("[TabComparisonService] Comparison canceled and tabs restored")
  }

  private resetState(): void {
    this.active = false
    this.sourceTabId = null
    this.targetTabId = null
    this.comparisonGroupId = null
    this.sourceParentGroupId = null
    this.targetParentGroupId = null
  }

  /**
   * Handles tab activation event. If comparison mode is waiting for target tab,
   * pairs source tab with this target tab into a comparison group.
   */
  async handleTabActivated(targetTabId: number, _windowId: number): Promise<boolean> {
    if (!this.active || !this.sourceTabId) {
      return false
    }

    if (targetTabId === this.sourceTabId) {
      // User switched back to the same tab, wait for next distinct tab
      return false
    }

    const sourceId = this.sourceTabId
    console.log(`[TabComparisonService] Pairing tabs: source ${sourceId} and target ${targetTabId}`)

    try {
      // Validate both tabs exist
      const [sourceTab, targetTab] = await Promise.all([
        browser.tabs.get(sourceId).catch(() => null),
        browser.tabs.get(targetTabId).catch(() => null)
      ])

      if (!sourceTab || !targetTab) {
        console.warn("[TabComparisonService] One of the tabs no longer exists, aborting comparison")
        await this.cancelComparison()
        return false
      }

      if (sourceTab.groupId && sourceTab.groupId !== -1) {
        this.sourceParentGroupId = sourceTab.groupId
      }
      if (targetTab.groupId && targetTab.groupId !== -1) {
        this.targetParentGroupId = targetTab.groupId
      }
      this.targetTabId = targetTabId

      let createdGroupId: number | null = null

      // Group both tabs together into a "Comparison" group
      if (browser.tabGroups) {
        const groupId = await withTabEditRetry(() =>
          browser.tabs.group({
            tabIds: [sourceId, targetTabId] as [number, ...number[]]
          })
        )

        if (typeof groupId === "number") {
          createdGroupId = groupId
          await withTabEditRetry(() =>
            browser.tabGroups.update(groupId, {
              title: COMPARISON_GROUP_TITLE,
              color: "purple" as Browser.tabGroups.Color
            })
          )
        }
      }

      this.active = false
      this.comparisonGroupId = createdGroupId
      await comparisonSession.setValue({
        active: false,
        sourceTabId: this.sourceTabId,
        targetTabId: this.targetTabId,
        startedAt: null,
        comparisonGroupId: this.comparisonGroupId,
        sourceParentGroupId: this.sourceParentGroupId,
        targetParentGroupId: this.targetParentGroupId
      })
      await this.updateBadge(false)
      console.log(`[TabComparisonService] Paired comparison in group ${createdGroupId}`)
      return true
    } catch (err) {
      console.error("[TabComparisonService] Failed to pair comparison tabs:", err)
      await this.cancelComparison()
      return false
    }
  }

  /**
   * Updates extension action badge
   */
  private async updateBadge(active: boolean): Promise<void> {
    try {
      if (browser.action?.setBadgeText) {
        await browser.action.setBadgeText({ text: active ? "CMP" : "" })
        if (active && browser.action.setBadgeBackgroundColor) {
          await browser.action.setBadgeBackgroundColor({ color: "#8B5CF6" }) // Tailwind violet-500
        }
      }
    } catch (err) {
      console.warn("[TabComparisonService] Could not update badge:", err)
    }
  }
}

export const tabComparisonService = new TabComparisonService()
