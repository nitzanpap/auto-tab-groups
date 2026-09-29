/**
 * Simplified Tab Group Service - Browser as SSOT
 * Uses browser state as the single source of truth, no complex state management
 */

import type { Browser } from "wxt/browser"
import type { CustomRule, TabGroupColor } from "../types"
import { getRandomTabGroupColor } from "../utils/Constants"
import { extractDomain, getDomainDisplayName } from "../utils/DomainUtils"
import { detectEntityAndColor } from "../utils/EntityServiceDetector"
import { getGroupColor, groupColorMapping, updateGroupColor } from "../utils/storage"
import { withTabEditRetry } from "../utils/withTabEditRetry"
import { rulesService, type MatchedRule } from "./RulesService"
import { COMPARISON_GROUP_TITLE, tabComparisonService } from "./TabComparisonService"
import { tabGroupState } from "./TabGroupState"
import { stripIndexPrefix, tabSortService } from "./TabSortService"

/**
 * One group's tabs moving to the window that already holds most of that group
 */
export interface ConsolidationMove {
  title: string
  fromWindowId: number
  toWindowId: number
  tabIds: number[]
}

/**
 * Collapse state result
 */
interface CollapseState {
  isCollapsed: boolean
}

class TabGroupServiceSimplified {
  private recentlyCreatedTabIds = new Set<number>()
  private processingTabs = new Set<number>()
  private bulkOperationInProgress = false
  private startupGracePeriod = false
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private burstDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private updateQueue: Promise<unknown> = Promise.resolve()
  private readonly BURST_DEBOUNCE_MS = 1500

  /**
   * Starts a startup grace period (default 3 seconds) where individual tab grouping
   * and auto-actions are delayed, allowing the browser to boot and restore tabs cleanly.
   * After the duration expires, auto-grouping runs once in a controlled batch.
   */
  startStartupGracePeriod(durationMs = 10000): void {
    this.startupGracePeriod = true
    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
    }
    console.log(`[TabGroupService] Startup quiet period active (${durationMs}ms) - extension is completely dormant`)
    this.startupTimer = setTimeout(() => {
      this.startupGracePeriod = false
      this.startupTimer = null
      console.log("[TabGroupService] Startup quiet period finished")
    }, durationMs)
  }

  isStartupGracePeriodActive(): boolean {
    return this.startupGracePeriod
  }

  isBulkOperationInProgress(): boolean {
    return this.bulkOperationInProgress
  }

  endStartupGracePeriod(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
      this.startupTimer = null
    }
    this.startupGracePeriod = false
  }

  /**
   * Schedules a coordinated bulk grouping pass ONLY after all tabs have finished loading
   * and tab activity has completely settled.
   */
  scheduleDebouncedGrouping(delayMs = 2000): void {
    if (this.burstDebounceTimer) {
      clearTimeout(this.burstDebounceTimer)
    }
    this.burstDebounceTimer = setTimeout(async () => {
      this.burstDebounceTimer = null
      if (!tabGroupState.autoGroupingEnabled) return

      try {
        const tabs = await browser.tabs.query({ currentWindow: true })
        // If any tab is still actively loading, wait further until it finishes
        const anyLoading = tabs.some(t => t.status === "loading")
        if (anyLoading) {
          console.log("[TabGroupService] Tabs are still loading, deferring grouping until complete...")
          this.scheduleDebouncedGrouping(1500)
          return
        }

        console.log("[TabGroupService] All tabs finished loading and settled. Executing atomic grouping...")
        await this.groupAllTabs()
      } catch (err) {
        console.error("[TabGroupService] Error in debounced grouping:", err)
      }
    }, delayMs)
  }

  markAsNewTab(tabId: number): void {
    this.recentlyCreatedTabIds.add(tabId)
  }

  isRecentlyCreated(tabId: number): boolean {
    return this.recentlyCreatedTabIds.has(tabId)
  }

  private consumeNewTabFlag(tabId: number): boolean {
    return this.recentlyCreatedTabIds.delete(tabId)
  }

  /**
   * Whether this tab was opened in the background and the user hasn't switched
   * to it yet, with the "wait until I view it" setting on.
   *
   * Filing a tab the moment it appears is what makes it seem to vanish: you
   * middle-click a search result, look away, and it has been moved to a group
   * elsewhere in the strip before you ever saw it. Waiting until the tab is
   * activated leaves it next to the tab it came from, where you expect it, and
   * changes nothing for tabs that open in the foreground — those are active
   * immediately, so they group exactly as before.
   *
   * Only applies to tabs opened from another tab (openerTabId) that this
   * service saw created, so restored sessions and address-bar tabs are
   * untouched.
   */
  private shouldWaitForFirstView(tab: Browser.tabs.Tab): boolean {
    if (!tabGroupState.deferGroupingUntilSeen) return false
    if (tab.active) return false
    if (!tab.openerTabId) return false
    return tab.id !== undefined && this.recentlyCreatedTabIds.has(tab.id)
  }

  /**
   * Checks if a URL is a new tab URL
   */
  isNewTabUrl(url: string): boolean {
    if (!url || typeof url !== "string") {
      return false
    }

    const newTabUrls = [
      "chrome://newtab/",
      "chrome-extension://",
      "moz-extension://",
      "about:newtab",
      "about:home",
      "edge://newtab/",
      "about:blank"
    ]

    return newTabUrls.some(newTabUrl => url.startsWith(newTabUrl))
  }

  /**
   * Handles a tab update - moves tab to correct group based on its current URL
   */
  async handleTabUpdate(tabId: number, forceGrouping = false): Promise<boolean> {
    if (!forceGrouping && this.startupGracePeriod) {
      console.log(`[TabGroupService] Startup grace period active, skipping tab ${tabId}`)
      return false
    }

    const isNewTab = this.recentlyCreatedTabIds.has(tabId)
    if (!forceGrouping && !tabGroupState.autoGroupingEnabled && !isNewTab) {
      return false
    }

    // Prevent concurrent processing of the same tab (e.g. onMoved firing
    // while we are still setting the group title after tabs.group())
    if (this.processingTabs.has(tabId)) {
      console.log(`[TabGroupService] Tab ${tabId} already being processed, skipping`)
      return false
    }

    this.processingTabs.add(tabId)
    try {
      const run = async () => {
        const result = await this._doHandleTabUpdate(tabId, forceGrouping)
        if (result && !this.bulkOperationInProgress) {
          await tabSortService.applySorting()
        }
        return result
      }
      // Serialize tab updates to prevent concurrent race conditions when tabs arrive rapidly
      const result = await (this.updateQueue = this.updateQueue.then(run, run))
      return result as boolean
    } finally {
      this.processingTabs.delete(tabId)
    }
  }

  private async _doHandleTabUpdate(tabId: number, forceGrouping: boolean): Promise<boolean> {
    try {
      console.log(`[TabGroupService] Processing tab ${tabId}`)

      const tab = await browser.tabs.get(tabId).catch(() => null)
      if (!tab) {
        this.consumeNewTabFlag(tabId)
        return false
      }
      console.log(`[TabGroupService] Tab URL: ${tab.url}`)

      const isNewTab = this.recentlyCreatedTabIds.has(tabId)

      // Check if this is a system URL and user has disabled grouping system tabs.
      // systemGroupEnabled wins over forceGrouping: when the System group is off
      // it must never appear, not even from an explicit "Group Tabs" click.
      if (!tabGroupState.systemGroupEnabled || (!forceGrouping && !tabGroupState.groupNewTabs)) {
        const domain = extractDomain(tab.url || "", false)
        if (domain === "system") {
          console.log(
            `[TabGroupService] Tab ${tabId} has a system URL and grouping system tabs is disabled`
          )
          this.consumeNewTabFlag(tabId)
          return false
        }
      }

      // Skip pinned tabs
      if (tab.pinned) {
        console.log(`[TabGroupService] Tab ${tabId} is pinned, skipping`)
        this.consumeNewTabFlag(tabId)
        return false
      }

      // Never move a tab out of a group the user marked protected unless this is a newly
      // opened tab that was only placed beside its anchor group temporarily before navigating.
      if (!isNewTab && (await this.isInProtectedGroup(tab))) {
        console.log(`[TabGroupService] Tab ${tabId} is in a protected group, leaving it alone`)
        return false
      }

      // Leave a background tab where it was opened until the user looks at it.
      // forceGrouping bypasses this, so "Group Tabs" still files everything.
      if (!forceGrouping && this.shouldWaitForFirstView(tab)) {
        console.log(`[TabGroupService] Tab ${tabId} not viewed yet, leaving it next to its opener`)
        return false
      }

      // Check blacklist rules — if matched, ungroup the tab and skip all grouping
      const blacklistMatch = await rulesService.findBlacklistMatch(tab.url || "", tab.title)
      if (blacklistMatch) {
        console.log(
          `[TabGroupService] Tab ${tabId} matches blacklist rule "${blacklistMatch.name}", skipping grouping`
        )
        if (tab.groupId && tab.groupId !== -1) {
          await withTabEditRetry(() => browser.tabs.ungroup([tabId]))
        }
        this.consumeNewTabFlag(tabId)
        return false
      }

      // Handle rules-only mode
      if (tabGroupState.groupByMode === "rules-only") {
        const customRule = await rulesService.findMatchingRule(tab.url || "", tab.title)

        // Handle system URLs
        const domain = extractDomain(tab.url || "", false)
        if (!customRule && domain === "system") {
          if (!tabGroupState.systemGroupEnabled) {
            this.consumeNewTabFlag(tabId)
            return false
          }
          return await this.moveTabToTargetGroup(tabId, tab, "System", null, "grey")
        }

        // Nothing matched — fall back to a catch-all ("*") rule if the user has one
        const effectiveRule =
          customRule ?? (await rulesService.findCatchAllRule(tab.url || "", tab.title))

        if (!effectiveRule) {
          console.log(`[TabGroupService] Rules-only mode: No rule found for ${tab.url}`)
          if (
            tab.groupId &&
            tab.groupId !== -1 &&
            (isNewTab || (await this.isOwnGroupId(tab.groupId)))
          ) {
            await withTabEditRetry(() => browser.tabs.ungroup([tabId]))
          }
          this.consumeNewTabFlag(tabId)
          return false
        }

        const groupName = effectiveRule.effectiveGroupName || effectiveRule.name
        return await this.moveTabToTargetGroup(tabId, tab, groupName, effectiveRule)
      }

      // Domain/subdomain mode
      const expectedTitle = await this.getExpectedGroupTitle(tab)
      if (!expectedTitle) {
        console.log(`[TabGroupService] No domain extracted, skipping`)
        if (
          tab.groupId &&
          tab.groupId !== -1 &&
          (isNewTab || (await this.isOwnGroupId(tab.groupId)))
        ) {
          await withTabEditRetry(() => browser.tabs.ungroup([tabId]))
        }
        this.consumeNewTabFlag(tabId)
        return false
      }

      const customRule = await rulesService.findMatchingRule(tab.url || "", tab.title)

      console.log(`[TabGroupService] Expected group title: "${expectedTitle}"`)

      return await this.moveTabToTargetGroup(tabId, tab, expectedTitle, customRule)
    } catch (error) {
      console.error(`[TabGroupService] Error processing tab ${tabId}:`, error)
      return false
    }
  }

  /**
   * Whether a group title is on the user's protected list.
   * Titles are compared with any sort-index prefix stripped, so protection
   * survives the "number groups" setting being toggled.
   */
  isProtectedTitle(title: string | undefined): boolean {
    if (tabGroupState.protectedGroupTitles.length === 0) return false
    if (!title) return false
    return tabGroupState.protectedGroupTitles.includes(stripIndexPrefix(title))
  }

  /**
   * Whether a tab currently sits in a comparison group or a group the user marked protected.
   * Cheap no-op when nothing is protected and no comparison group exists.
   */
  private async isInProtectedGroup(tab: Browser.tabs.Tab): Promise<boolean> {
    if (!tab.groupId || tab.groupId === -1) return false
    if (!browser.tabGroups) return false

    if (tabComparisonService.getComparisonGroupId() === tab.groupId) {
      return true
    }

    if (tabGroupState.protectedGroupTitles.length === 0) return false

    try {
      const group = await browser.tabGroups.get(tab.groupId)
      return this.isProtectedTitle(group?.title)
    } catch {
      // Group vanished between reads — nothing to protect
      return false
    }
  }

  /**
   * Whether a group is one this extension would have built itself.
   *
   * Other extensions create and manage their own tab groups, and they often
   * name them per session, so no title list can protect them (#96). The
   * cheapest reliable signal is the title: if it is not a title Auto Tab
   * Groups produces, the group belongs to someone else and we leave it alone.
   *
   * A title counts as ours when it is "System", an enabled rule's name, a
   * title we have created before, or the title a tab currently in the group
   * would be filed under. Untitled groups are never ours — every group this
   * extension creates gets a title.
   */
  private async isOwnGroup(
    group: Pick<Browser.tabGroups.TabGroup, "title">,
    tabsInGroup: Browser.tabs.Tab[]
  ): Promise<boolean> {
    const title = stripIndexPrefix(group.title || "")
    if (!title) return false
    if (title === "System") return true

    const rules = Object.values(tabGroupState.getCustomRulesObject())
    if (rules.some(rule => rule.enabled && rule.name === title)) return true

    // Creating a group records its colour under its title, which makes the
    // colour mapping a ledger of every title this extension has produced —
    // it still recognises our group after its last tab navigates elsewhere.
    if (await getGroupColor(title)) return true

    for (const tab of tabsInGroup) {
      if ((await this.getExpectedGroupTitle(tab)) === title) return true
    }

    return false
  }

  /**
   * isOwnGroup for a group we only have the id of. Errs on "not ours", so a
   * group that disappears mid-read is left alone rather than dismantled.
   */
  private async isOwnGroupId(groupId: number): Promise<boolean> {
    try {
      const group = await browser.tabGroups.get(groupId)
      const tabs = await browser.tabs.query({ groupId })
      return await this.isOwnGroup(group, tabs)
    } catch {
      return false
    }
  }

  /**
   * Ids of every protected group in the current window
   */
  private async getProtectedGroupIds(): Promise<Set<number>> {
    if (!browser.tabGroups) return new Set()

    const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT })
    return new Set(groups.filter(g => this.isProtectedTitle(g.title)).map(g => g.id))
  }

  /**
   * One group's worth of tabs that would move to another window.
   */
  private buildConsolidationMove(
    group: Browser.tabGroups.TabGroup,
    target: { windowId: number; groupId: number },
    tabs: Browser.tabs.Tab[]
  ): ConsolidationMove | null {
    const tabIds = tabs
      .filter(tab => tab.groupId === group.id && !tab.pinned && tab.id !== undefined)
      .map(tab => tab.id as number)

    if (tabIds.length === 0) return null

    return {
      title: stripIndexPrefix(group.title || ""),
      fromWindowId: group.windowId,
      toWindowId: target.windowId,
      tabIds
    }
  }

  /**
   * Works out which groups are split across windows, and where each one would
   * end up if they were merged.
   *
   * A group's home is the window already holding most of its tabs, decided up
   * front so it can't shift while tabs are moving. Deliberately keyed on the
   * group title rather than on rules: this merges groups that already exist,
   * so the question is which window owns a title, not where a URL belongs.
   */
  async planGroupConsolidation(): Promise<ConsolidationMove[]> {
    try {
      if (!browser.tabGroups) return []

      const groups = await browser.tabGroups.query({})
      const tabs = await browser.tabs.query({})

      const sizeOf = new Map<number, number>()
      for (const tab of tabs) {
        if (tab.groupId && tab.groupId !== -1) {
          sizeOf.set(tab.groupId, (sizeOf.get(tab.groupId) ?? 0) + 1)
        }
      }

      const home = new Map<string, { windowId: number; groupId: number; size: number }>()
      for (const group of groups) {
        const title = stripIndexPrefix(group.title || "")
        if (!title) continue

        // "Never auto-group this" should also mean "don't haul it between
        // windows in a bulk sweep". System is the extension's own bucket for
        // browser pages, not a topic anyone arranges windows around.
        if (title === "System" || this.isProtectedTitle(title)) continue

        const size = sizeOf.get(group.id) ?? 0
        const best = home.get(title)
        if (!best || size > best.size || (size === best.size && group.id < best.groupId)) {
          home.set(title, { windowId: group.windowId, groupId: group.id, size })
        }
      }

      const moves: ConsolidationMove[] = []
      for (const group of groups) {
        const target = home.get(stripIndexPrefix(group.title || ""))
        if (!target || target.windowId === group.windowId) continue

        const move = this.buildConsolidationMove(group, target, tabs)
        if (move) moves.push(move)
      }

      return moves
    } catch (error) {
      console.error(`[TabGroupService] Error planning group consolidation:`, error)
      return []
    }
  }

  /**
   * Merges every group that is split across windows into a single window each.
   *
   * Recomputes the plan rather than replaying one the UI captured earlier:
   * group ids go stale as soon as anything moves, and "consolidate everything
   * as it is now" is the honest reading of the button.
   *
   * There is no undo — nothing records where a tab came from — which is why
   * the UI shows the plan and asks before calling this.
   */
  async consolidateGroups(): Promise<{ movedTabs: number; movedGroups: number }> {
    const moves = await this.planGroupConsolidation()
    if (moves.length === 0) return { movedTabs: 0, movedGroups: 0 }

    this.bulkOperationInProgress = true
    try {
      let movedTabs = 0
      let movedGroups = 0

      for (const move of moves) {
        try {
          const target = (await browser.tabGroups.query({ windowId: move.toWindowId })).find(
            group => stripIndexPrefix(group.title || "") === move.title
          )
          if (!target) continue

          const tabIds = move.tabIds as [number, ...number[]]
          await withTabEditRetry(() =>
            browser.tabs.move(tabIds, { windowId: move.toWindowId, index: -1 })
          )
          await withTabEditRetry(() => browser.tabs.group({ tabIds, groupId: target.id }))

          movedTabs += move.tabIds.length
          movedGroups += 1
        } catch (error) {
          // One group failing shouldn't strand the rest half-done
          console.error(`[TabGroupService] Could not consolidate "${move.title}":`, error)
        }
      }

      console.log(`[TabGroupService] Consolidated ${movedGroups} group(s), ${movedTabs} tab(s)`)
      return { movedTabs, movedGroups }
    } finally {
      this.bulkOperationInProgress = false
      await tabSortService.applySorting()
    }
  }

  /**
   * The group title this tab would be filed under, or null if it wouldn't be.
   *
   * Shared with the "move to its group's window" command so a manual move and
   * automatic grouping can never disagree about where a tab belongs.
   */
  async getExpectedGroupTitle(tab: Browser.tabs.Tab): Promise<string | null> {
    const url = tab.url || ""
    const title = tab.title

    if (tabGroupState.groupByMode === "rules-only") {
      const customRule = await rulesService.findMatchingRule(url, title)

      if (!customRule && extractDomain(url, false) === "system") {
        return tabGroupState.systemGroupEnabled ? "System" : null
      }

      const effectiveRule = customRule ?? (await rulesService.findCatchAllRule(url, title))
      if (!effectiveRule) return null

      return effectiveRule.effectiveGroupName || effectiveRule.name
    }

    const domain = extractDomain(url, tabGroupState.groupByMode === "subdomain")
    if (!domain) return null

    const customRule = await rulesService.findMatchingRule(url, title)
    return customRule
      ? customRule.effectiveGroupName || customRule.name
      : getDomainDisplayName(domain)
  }

  /**
   * Sends a tab to the window where its group already lives.
   *
   * Requested in #68: when you keep windows roughly by topic, a tab opened in
   * the wrong one is easier to deal with by sending it home than by hunting for
   * it later. Nothing automatic — the user asks for this per tab.
   *
   * When several windows hold a group of that name, the largest wins, which is
   * almost always the "main" one for that topic.
   */
  async moveTabToItsGroupWindow(
    tabId: number
  ): Promise<{ moved: boolean; reason?: "pinned" | "no-title" | "no-group" }> {
    try {
      if (!browser.tabGroups) return { moved: false, reason: "no-group" }

      const tab = await browser.tabs.get(tabId)
      if (tab.pinned) return { moved: false, reason: "pinned" }

      const title = await this.getExpectedGroupTitle(tab)
      if (!title) return { moved: false, reason: "no-title" }

      const groups = await browser.tabGroups.query({})
      const candidates = groups.filter(
        group => group.windowId !== tab.windowId && stripIndexPrefix(group.title || "") === title
      )
      if (candidates.length === 0) return { moved: false, reason: "no-group" }

      const withCounts = await Promise.all(
        candidates.map(async group => ({
          group,
          count: (await browser.tabs.query({ groupId: group.id })).length
        }))
      )
      withCounts.sort((a, b) => b.count - a.count || a.group.id - b.group.id)
      const target = withCounts[0].group

      await withTabEditRetry(() =>
        browser.tabs.move(tabId, { windowId: target.windowId, index: -1 })
      )
      await withTabEditRetry(() => browser.tabs.group({ tabIds: [tabId], groupId: target.id }))

      console.log(`[TabGroupService] Moved tab ${tabId} to "${title}" in window ${target.windowId}`)
      return { moved: true }
    } catch (error) {
      console.error(`[TabGroupService] Error moving tab ${tabId} to its group's window:`, error)
      return { moved: false, reason: "no-group" }
    }
  }

  /**
   * Gets the effective minimum tabs required for a group
   */
  getEffectiveMinimumTabs(customRule: MatchedRule | CustomRule | null): number {
    if (customRule && customRule.minimumTabs !== null && customRule.minimumTabs !== undefined) {
      return customRule.minimumTabs
    }

    // A catch-all group collects what nothing else wanted, so the global minimum
    // does not apply: needing N leftovers before bucketing them is the opposite
    // of what a leftovers group is for. An explicit per-rule minimum still wins.
    if (customRule && rulesService.isCatchAllRule(customRule)) {
      return 1
    }

    return tabGroupState.minimumTabsForGroup || 1
  }

  /**
   * Counts tabs that would belong to the same group
   */
  async countTabsForGroup(
    expectedTitle: string,
    windowId: number,
    customRule: MatchedRule | CustomRule | null
  ): Promise<number> {
    try {
      const tabs = await browser.tabs.query({ windowId })
      let count = 0

      for (const tab of tabs) {
        if (tab.pinned) continue

        // Skip blacklisted tabs from count
        const blacklisted = await rulesService.findBlacklistMatch(tab.url || "", tab.title)
        if (blacklisted) continue

        if (customRule) {
          const expectedGroupName =
            "effectiveGroupName" in customRule ? customRule.effectiveGroupName : customRule.name

          // A catch-all rule only owns tabs that no normal rule claimed.
          // ponytail: in domain mode this over-counts tabs that domain grouping
          // will happily group itself. Harmless — over-counting only makes the
          // leftovers group easier to form, and its minimum is usually 1.
          const isCatchAll = rulesService.isCatchAllRule(customRule)
          if (isCatchAll && (await rulesService.findMatchingRule(tab.url || "", tab.title))) {
            continue
          }

          const matchingRule = isCatchAll
            ? await rulesService.findCatchAllRule(tab.url || "", tab.title)
            : await rulesService.findMatchingRule(tab.url || "", tab.title)
          const matchGroupName = matchingRule
            ? matchingRule.effectiveGroupName || matchingRule.name
            : null
          if (matchingRule && matchGroupName === expectedGroupName) {
            count++
          }
        } else {
          // Handle empty/undefined URLs and system URLs as System tabs
          if (expectedTitle === "System") {
            const tabDomain = extractDomain(tab.url || "", false)
            if (!tab.url || tab.url === "" || tabDomain === "system") {
              count++
              continue
            }
          }

          const includeSubDomain = tabGroupState.groupByMode === "subdomain"
          const domain = extractDomain(tab.url || "", includeSubDomain)
          const displayName = getDomainDisplayName(domain || "")
          if (displayName === expectedTitle) {
            count++
          }
        }
      }

      return count
    } catch (error) {
      console.error(`[TabGroupService] Error counting tabs:`, error)
      return 0
    }
  }

  /**
   * Moves a tab to the target group
   */
  async moveTabToTargetGroup(
    tabId: number,
    tab: Browser.tabs.Tab,
    expectedTitle: string,
    customRule: MatchedRule | CustomRule | null = null,
    defaultColor: TabGroupColor | null = null,
    allowCatchAllFallback = true
  ): Promise<boolean> {
    // Check for tabGroups API availability
    if (!browser.tabGroups) {
      console.warn("[TabGroupService] tabGroups API not available")
      return false
    }

    const existingGroup = await this.findGroupByTitle(expectedTitle, tab.windowId!)

    if (existingGroup) {
      if (tab.groupId === existingGroup.id) {
        console.log(`[TabGroupService] Tab ${tabId} already in correct group`)
        if (this.consumeNewTabFlag(tabId) && tabGroupState.openTabNextToCurrent) {
          await this.repositionTabNextToOpener(tabId, tab, existingGroup.id)
        }
        // Return false — no group change occurred, so no re-sorting needed
        return false
      }

      console.log(`[TabGroupService] Moving tab ${tabId} to existing group ${existingGroup.id}`)
      await withTabEditRetry(() =>
        browser.tabs.group({
          tabIds: [tabId],
          groupId: existingGroup.id
        })
      )

      this.consumeNewTabFlag(tabId)
      if (tabGroupState.openTabNextToCurrent) {
        await this.repositionTabNextToOpener(tabId, tab, existingGroup.id)
      }

      // Update color if from custom rule
      if (customRule?.color && existingGroup.color !== customRule.color) {
        try {
          await withTabEditRetry(() =>
            browser.tabGroups.update(existingGroup.id, {
              color: customRule.color
            })
          )
        } catch (error) {
          console.warn(`[TabGroupService] Failed to update group color:`, error)
        }
      }

      return true
    }

    // Check minimum threshold before creating new group
    const tabCount = await this.countTabsForGroup(expectedTitle, tab.windowId!, customRule)
    const minimumTabs = this.getEffectiveMinimumTabs(customRule)

    console.log(
      `[TabGroupService] Tab count for "${expectedTitle}": ${tabCount}, minimum: ${minimumTabs}`
    )

    if (tabCount < minimumTabs) {
      console.log(`[TabGroupService] Not enough tabs to create group "${expectedTitle}"`)

      // A tab that can't form its own group is exactly what a catch-all rule is for
      if (allowCatchAllFallback) {
        const catchAll = await rulesService.findCatchAllRule(tab.url || "", tab.title)
        const catchAllTitle = catchAll ? catchAll.effectiveGroupName || catchAll.name : null

        if (catchAllTitle && catchAllTitle !== expectedTitle) {
          console.log(`[TabGroupService] Falling back to catch-all group "${catchAllTitle}"`)
          return await this.moveTabToTargetGroup(tabId, tab, catchAllTitle, catchAll, null, false)
        }
      }

      const wasNewTab = this.consumeNewTabFlag(tabId)

      // Only pull the tab out of a group we built. A group another extension
      // owns must survive its tabs navigating around (#96). However, if this tab was
      // a newly created tab placed in an anchor group temporarily, always ungroup it
      // if its new destination URL does not meet threshold to avoid leaving it in the wrong group.
      if (
        tab.groupId &&
        tab.groupId !== -1 &&
        (wasNewTab || (await this.isOwnGroupId(tab.groupId)))
      ) {
        await withTabEditRetry(() => browser.tabs.ungroup([tabId]))
      }

      return false
    }

    // Create new group
    console.log(`[TabGroupService] Creating new group "${expectedTitle}"`)

    const groupId = await withTabEditRetry(() => browser.tabs.group({ tabIds: [tabId] }))

    try {
      const updateOptions: Browser.tabGroups.UpdateProperties = {
        title: expectedTitle
      }

      if (customRule?.color) {
        updateOptions.color = customRule.color as Browser.tabGroups.Color
      } else {
        const savedColor = await getGroupColor(expectedTitle)
        if (savedColor) {
          updateOptions.color = savedColor as Browser.tabGroups.Color
        } else {
          const detected = detectEntityAndColor(tab.url || "", tab.title)
          updateOptions.color = (defaultColor ||
            detected?.color ||
            getRandomTabGroupColor()) as Browser.tabGroups.Color
        }
      }

      await withTabEditRetry(() => browser.tabGroups.update(groupId, updateOptions))

      if (updateOptions.color) {
        await updateGroupColor(expectedTitle, updateOptions.color)
      }

      console.log(`[TabGroupService] Created group ${groupId} with title "${expectedTitle}"`)
    } catch (error) {
      console.error(`[TabGroupService] Failed to update group ${groupId} title:`, error)
    }

    this.consumeNewTabFlag(tabId)

    // Group matching ungrouped tabs
    await this.groupMatchingUngroupedTabs(expectedTitle, tab.windowId!, customRule)

    return true
  }

  /**
   * Groups any ungrouped tabs that match the given group criteria
   */
  async groupMatchingUngroupedTabs(
    expectedTitle: string,
    windowId: number,
    customRule: MatchedRule | CustomRule | null
  ): Promise<void> {
    try {
      const existingGroup = await this.findGroupByTitle(expectedTitle, windowId)
      if (!existingGroup) return

      const allTabs = await browser.tabs.query({ windowId })
      const tabsToGroup: number[] = []

      for (const otherTab of allTabs) {
        if (otherTab.pinned || (otherTab.groupId && otherTab.groupId !== -1)) {
          continue
        }

        // Skip blacklisted tabs
        const blacklisted = await rulesService.findBlacklistMatch(
          otherTab.url || "",
          otherTab.title
        )
        if (blacklisted) continue

        let shouldGroup = false
        if (customRule) {
          const matchingRule = await rulesService.findMatchingRule(
            otherTab.url || "",
            otherTab.title
          )
          shouldGroup = !!matchingRule && matchingRule.name === customRule.name
        } else {
          const includeSubDomain = tabGroupState.groupByMode === "subdomain"
          const domain = extractDomain(otherTab.url || "", includeSubDomain)
          const displayName = getDomainDisplayName(domain || "")
          shouldGroup = displayName === expectedTitle
        }

        if (shouldGroup && otherTab.id) {
          tabsToGroup.push(otherTab.id)
        }
      }

      if (tabsToGroup.length > 0) {
        await withTabEditRetry(() =>
          browser.tabs.group({
            tabIds: tabsToGroup as [number, ...number[]],
            groupId: existingGroup.id
          })
        )
        console.log(
          `[TabGroupService] Added ${tabsToGroup.length} tabs to group "${expectedTitle}"`
        )
      }
    } catch (error) {
      console.error(`[TabGroupService] Error grouping matching tabs:`, error)
    }
  }

  /**
   * Finds an existing group by title
   */
  async findGroupByTitle(
    title: string,
    windowId: number
  ): Promise<Browser.tabGroups.TabGroup | null> {
    try {
      if (!browser.tabGroups) return null

      const groups = await browser.tabGroups.query({ windowId })
      const targetClean = stripIndexPrefix(title || "").trim().toLowerCase()
      if (!targetClean) return null

      return (
        groups.find(group => {
          const groupClean = stripIndexPrefix(group.title || "").trim().toLowerCase()
          return groupClean === targetClean
        }) || null
      )
    } catch (error) {
      console.error(`[TabGroupService] Error finding group:`, error)
      return null
    }
  }

  /**
   * Groups all tabs in the current window
   */
  async groupAllTabs(): Promise<boolean> {
    if (!tabGroupState.autoGroupingEnabled) {
      return false
    }
    return this._batchGroupTabs(false)
  }

  /**
   * Manually groups all tabs (ignores auto-group setting but respects groupNewTabs)
   */
  async groupAllTabsManually(): Promise<boolean> {
    return this._batchGroupTabs(true)
  }

  /**
   * High-performance batch grouping: groups all eligible tabs in the window
   * in coordinated bulk API calls instead of 20+ sequential round-trips.
   */
  private async _batchGroupTabs(forceGrouping: boolean): Promise<boolean> {
    if (!browser.tabGroups) return false

    this.bulkOperationInProgress = true
    try {
      console.log(`[TabGroupService] Starting fast batch grouping (force=${forceGrouping})`)
      const tabs = await browser.tabs.query({ currentWindow: true })
      if (!tabs || tabs.length === 0) return false

      const windowId = tabs[0].windowId ?? (await browser.windows.getCurrent()).id
      if (windowId === undefined) return false

      // Target title -> { tabs: Tab[], customRule: CustomRule | null, color?: TabGroupColor }
      const groupBuckets = new Map<
        string,
        { tabs: Browser.tabs.Tab[]; customRule: MatchedRule | CustomRule | null; defaultColor?: TabGroupColor }
      >()

      for (const tab of tabs) {
        if (!tab.id) continue
        if (tab.pinned) continue
        if (tab.url?.startsWith("chrome-extension://") || tab.url?.startsWith("moz-extension://")) {
          continue
        }

        // Check if tab is in a protected group
        if (!this.isRecentlyCreated(tab.id) && (await this.isInProtectedGroup(tab))) {
          continue
        }

        // Check blacklist rules
        const blacklisted = await rulesService.findBlacklistMatch(tab.url || "", tab.title)
        if (blacklisted) continue

        // System URL / empty URL handling
        const isSystem = !tab.url || tab.url === "" || extractDomain(tab.url, false) === "system"
        if (isSystem) {
          if (tabGroupState.systemGroupEnabled && (forceGrouping || tabGroupState.groupNewTabs)) {
            const bucket = groupBuckets.get("System") ?? { tabs: [], customRule: null, defaultColor: "grey" }
            bucket.tabs.push(tab)
            groupBuckets.set("System", bucket)
          }
          continue
        }

        // Matching custom rules or domain
        const customRule = await rulesService.findMatchingRule(tab.url || "", tab.title)
        let expectedTitle: string | null = null

        if (tabGroupState.groupByMode === "rules-only") {
          const effectiveRule = customRule ?? (await rulesService.findCatchAllRule(tab.url || "", tab.title))
          if (effectiveRule) {
            expectedTitle = effectiveRule.effectiveGroupName || effectiveRule.name
          }
        } else {
          if (customRule) {
            expectedTitle = customRule.effectiveGroupName || customRule.name
          } else {
            const includeSubDomain = tabGroupState.groupByMode === "subdomain"
            const domain = extractDomain(tab.url || "", includeSubDomain)
            expectedTitle = getDomainDisplayName(domain || "")
          }
        }

        if (expectedTitle) {
          const bucket = groupBuckets.get(expectedTitle) ?? { tabs: [], customRule }
          bucket.tabs.push(tab)
          groupBuckets.set(expectedTitle, bucket)
        }
      }

      // Query existing groups once
      const existingGroups = await browser.tabGroups.query({ windowId })

      // Process each bucket atomically
      for (const [title, bucket] of groupBuckets) {
        const minimumTabs = this.getEffectiveMinimumTabs(bucket.customRule)
        if (bucket.tabs.length < minimumTabs) {
          console.log(`[TabGroupService] Bucket "${title}" has ${bucket.tabs.length} tabs, minimum is ${minimumTabs}, skipping`)
          continue
        }

        const cleanTarget = stripIndexPrefix(title).trim().toLowerCase()
        const existingGroup = existingGroups.find(
          g => stripIndexPrefix(g.title || "").trim().toLowerCase() === cleanTarget
        )

        const allTabIdsInBucket = bucket.tabs.map(t => t.id!).filter(Boolean)

        if (existingGroup) {
          // Add only tabs that are not already in this group
          const tabsToMove = bucket.tabs
            .filter(t => t.groupId !== existingGroup.id)
            .map(t => t.id!)
            .filter(Boolean)

          if (tabsToMove.length > 0) {
            console.log(`[TabGroupService] Batch moving ${tabsToMove.length} tabs to existing group "${title}"`)
            await withTabEditRetry(() =>
              browser.tabs.group({
                tabIds: tabsToMove as [number, ...number[]],
                groupId: existingGroup.id
              })
            )
          }
        } else {
          // Create new group for all matching tabs in ONE single call
          console.log(`[TabGroupService] Batch creating group "${title}" with ${allTabIdsInBucket.length} tabs`)
          const newGroupId = await withTabEditRetry(() =>
            browser.tabs.group({
              tabIds: allTabIdsInBucket as [number, ...number[]]
            })
          )

          const updateOptions: Browser.tabGroups.UpdateProperties = { title }
          if (bucket.customRule?.color) {
            updateOptions.color = bucket.customRule.color as Browser.tabGroups.Color
          } else if (bucket.defaultColor) {
            updateOptions.color = bucket.defaultColor as Browser.tabGroups.Color
          } else {
            const savedColor = await getGroupColor(title)
            if (savedColor) {
              updateOptions.color = savedColor as Browser.tabGroups.Color
            } else {
              const detected = detectEntityAndColor(bucket.tabs[0].url || "", bucket.tabs[0].title)
              updateOptions.color = (detected?.color || getRandomTabGroupColor()) as Browser.tabGroups.Color
            }
          }

          await withTabEditRetry(() => browser.tabGroups.update(newGroupId, updateOptions))
          if (updateOptions.color) {
            await updateGroupColor(title, updateOptions.color)
          }
        }

        for (const tabId of allTabIdsInBucket) {
          this.consumeNewTabFlag(tabId)
        }
      }

      console.log(`[TabGroupService] Fast batch grouping completed successfully`)
      await tabSortService.applySorting()
      if (tabGroupState.autoCollapseEnabled) {
        await this.collapseAllGroups()
      }
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error during fast batch grouping:`, error)
      return false
    } finally {
      this.bulkOperationInProgress = false
    }
  }

  /**
   * Ungroups all tabs in the current window
   */
  async ungroupAllTabs(forceAll = false): Promise<boolean> {
    try {
      console.log(`[TabGroupService] Ungrouping all tabs`)
      const tabs = await browser.tabs.query({ currentWindow: true })
      const allGrouped = tabs.filter(tab => tab.groupId && tab.groupId !== -1)

      const protectedGroupIds = forceAll
        ? new Set<number>()
        : await this.getProtectedGroupIds()
      const groupedTabs = allGrouped.filter(tab => !protectedGroupIds.has(tab.groupId as number))

      if (groupedTabs.length > 0) {
        const tabIds = groupedTabs.map(tab => tab.id!).filter(id => id !== undefined)
        if (tabIds.length > 0) {
          await withTabEditRetry(() => browser.tabs.ungroup(tabIds as [number, ...number[]]))
        }
        console.log(`[TabGroupService] Ungrouped ${groupedTabs.length} tabs`)
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error ungrouping tabs:`, error)
      return false
    }
  }

  /**
   * Removes an empty group
   */
  async removeEmptyGroup(groupId: number): Promise<boolean> {
    await this.checkGroupThreshold(groupId)
    return true
  }

  /**
   * Check if group should be ungrouped based on threshold
   */
  async checkGroupThreshold(groupId: number): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})
      const group = groups.find(g => g.id === groupId)
      if (!group) return false

      let customRule: CustomRule | null = null
      const customRules = tabGroupState.getCustomRulesObject()
      const cleanGroupTitle = stripIndexPrefix(group.title || "").trim()
      for (const rule of Object.values(customRules)) {
        if (rule.enabled && rule.name === cleanGroupTitle) {
          customRule = rule
          break
        }
      }

      const minimumTabs = this.getEffectiveMinimumTabs(customRule)
      if (minimumTabs <= 1) return false

      if (this.isProtectedTitle(group.title)) {
        console.log(`[TabGroupService] Group "${group.title}" is protected, leaving it alone`)
        return false
      }

      const tabs = await browser.tabs.query({ groupId })

      // The sweep runs over every group in the window, including ones other
      // extensions or the user created — disbanding those is not ours to do.
      if (!(await this.isOwnGroup(group, tabs))) {
        console.log(`[TabGroupService] Group "${group.title}" was not created by us, skipping`)
        return false
      }

      const tabCount = tabs.filter(tab => !tab.pinned).length

      if (tabCount < minimumTabs) {
        console.log(`[TabGroupService] Group "${group.title}" below threshold, ungrouping`)
        const tabIds = tabs.map(tab => tab.id!).filter(id => id !== undefined)
        if (tabIds.length > 0) {
          await withTabEditRetry(() => browser.tabs.ungroup(tabIds as [number, ...number[]]))
        }
        return true
      }

      return false
    } catch (error) {
      console.error(`[TabGroupService] Error checking threshold:`, error)
      return false
    }
  }

  /**
   * Check all groups against threshold and disband those below minimum
   */
  async checkAllGroupsThreshold(): Promise<void> {
    try {
      if (!browser.tabGroups) return

      const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT })
      console.log(`[TabGroupService] Checking ${groups.length} groups against threshold`)

      for (const group of groups) {
        await this.checkGroupThreshold(group.id)
      }
    } catch (error) {
      console.error(`[TabGroupService] Error checking all groups threshold:`, error)
    }
  }

  /**
   * Ungroups all tabs from every System group (used when the System group or
   * groupNewTabs is disabled). Covers all windows — turning the System group off
   * should not leave one behind in a window that happens not to be focused.
   */
  async ungroupSystemTabs(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})
      const systemGroups = groups.filter(group => stripIndexPrefix(group.title || "") === "System")

      if (systemGroups.length === 0) {
        console.log(`[TabGroupService] No System group found`)
        return true
      }

      for (const systemGroup of systemGroups) {
        const tabs = await browser.tabs.query({ groupId: systemGroup.id })
        const tabIds = tabs.map(tab => tab.id!).filter(id => id !== undefined)
        if (tabIds.length > 0) {
          await withTabEditRetry(() => browser.tabs.ungroup(tabIds as [number, ...number[]]))
          console.log(`[TabGroupService] Ungrouped ${tabIds.length} tabs from System group`)
        }
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error ungrouping System tabs:`, error)
      return false
    }
  }

  /**
   * Moves a tab to the correct group
   */
  async moveTabToGroup(tabId: number): Promise<boolean> {
    return await this.handleTabUpdate(tabId)
  }

  /**
   * Generates new random colors for all groups
   */
  async generateNewColors(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      console.log(`[TabGroupService] Generating new colors`)

      const groups = await browser.tabGroups.query({})
      const customRules = await rulesService.getCustomRules()
      const customRuleNames = new Set<string>()

      for (const rule of Object.values(customRules)) {
        if (rule.color && rule.name) {
          customRuleNames.add(rule.name)
        }
      }

      const colorMappingValue = await groupColorMapping.getValue()
      const newColorMapping = { ...colorMappingValue }

      for (const group of groups) {
        if (customRuleNames.has(group.title || "")) {
          continue
        }

        const randomColor = getRandomTabGroupColor()

        try {
          await browser.tabGroups.update(group.id, {
            color: randomColor as Browser.tabGroups.Color
          })
          newColorMapping[group.title || ""] = randomColor
        } catch (error) {
          console.warn(`[TabGroupService] Failed to update color:`, error)
        }
      }

      await groupColorMapping.setValue(newColorMapping)
      console.log(`[TabGroupService] Finished generating colors`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error generating colors:`, error)
      return false
    }
  }

  /**
   * Toggles collapse state of all groups
   */
  async toggleAllGroupsCollapse(): Promise<CollapseState> {
    try {
      if (!browser.tabGroups) return { isCollapsed: false }

      const groups = await browser.tabGroups.query({})
      if (groups.length === 0) return { isCollapsed: false }

      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTabGroupId = activeTab?.groupId !== -1 ? activeTab?.groupId : null

      const hasExpanded = groups.some(group => !group.collapsed)
      const newState = hasExpanded

      for (const group of groups) {
        if (newState && group.id === activeTabGroupId) continue

        try {
          await browser.tabGroups.update(group.id, { collapsed: newState })
        } catch (error) {
          console.warn(`[TabGroupService] Failed to toggle group:`, error)
        }
      }

      return { isCollapsed: newState }
    } catch (error) {
      console.error(`[TabGroupService] Error toggling collapse:`, error)
      return { isCollapsed: false }
    }
  }

  /**
   * Gets current collapse state
   */
  async getGroupsCollapseState(): Promise<CollapseState> {
    try {
      if (!browser.tabGroups) return { isCollapsed: false }

      const groups = await browser.tabGroups.query({})
      if (groups.length === 0) return { isCollapsed: false }

      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTabGroupId = activeTab?.groupId !== -1 ? activeTab?.groupId : null

      const nonActiveGroups = groups.filter(group => group.id !== activeTabGroupId)
      if (nonActiveGroups.length === 0) return { isCollapsed: false }

      const allCollapsed = nonActiveGroups.every(group => group.collapsed)
      return { isCollapsed: allCollapsed }
    } catch (error) {
      console.error(`[TabGroupService] Error getting collapse state:`, error)
      return { isCollapsed: false }
    }
  }

  /**
   * Records a group's current colour under its title.
   *
   * The colour mapping is what a group is rebuilt from, so a colour the user
   * picked by hand has to land there too — otherwise the next rebuild or
   * startup restore silently reverts it to whatever we last chose (#102).
   */
  async rememberGroupColor(group: Browser.tabGroups.TabGroup): Promise<boolean> {
    try {
      const title = stripIndexPrefix(group.title || "")
      if (!title) return false

      // The mapping doubles as our ownership ledger — writing a foreign group
      // into it would make us start managing someone else's group (#96).
      const tabsInGroup = await browser.tabs.query({ groupId: group.id })
      if (!(await this.isOwnGroup(group, tabsInGroup))) return false

      if ((await getGroupColor(title)) === group.color) return false

      await updateGroupColor(title, group.color as TabGroupColor)
      console.log(`[TabGroupService] Remembered color "${group.color}" for "${title}"`)
      return true
    } catch (error) {
      console.warn(`[TabGroupService] Failed to remember group color:`, error)
      return false
    }
  }

  /**
   * Restores saved colors
   */
  async restoreSavedColors(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})
      const colorMappingValue = await groupColorMapping.getValue()
      let restoredCount = 0

      for (const group of groups) {
        const savedColor = colorMappingValue[stripIndexPrefix(group.title || "")]
        if (savedColor && savedColor !== group.color) {
          try {
            await browser.tabGroups.update(group.id, {
              color: savedColor as Browser.tabGroups.Color
            })
            restoredCount++
          } catch (error) {
            console.warn(`[TabGroupService] Failed to restore color:`, error)
          }
        }
      }

      console.log(`[TabGroupService] Restored colors for ${restoredCount} groups`)
      return true
    } catch (error) {
      console.error(`[TabGroupService] Error restoring colors:`, error)
      return false
    }
  }

  /**
   * Collapses all groups
   */
  async collapseAllGroups(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTabGroupId = activeTab?.groupId !== -1 ? activeTab?.groupId : null

      for (const group of groups) {
        if (group.id === activeTabGroupId) continue

        try {
          await browser.tabGroups.update(group.id, { collapsed: true })
        } catch (error) {
          console.warn(`[TabGroupService] Failed to collapse group:`, error)
        }
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error collapsing groups:`, error)
      return false
    }
  }

  /**
   * Expands all groups
   */
  async expandAllGroups(): Promise<boolean> {
    try {
      if (!browser.tabGroups) return false

      const groups = await browser.tabGroups.query({})

      for (const group of groups) {
        try {
          await browser.tabGroups.update(group.id, { collapsed: false })
        } catch (error) {
          console.warn(`[TabGroupService] Failed to expand group:`, error)
        }
      }

      return true
    } catch (error) {
      console.error(`[TabGroupService] Error expanding groups:`, error)
      return false
    }
  }

  /**
   * Repositions a tab directly after its opener tab within the same group.
   * Only acts when the tab has an openerTabId and the opener is in the same group.
   * Fails silently since positioning is a best-effort enhancement.
   */
  private async repositionTabNextToOpener(
    tabId: number,
    tab: Browser.tabs.Tab,
    groupId: number
  ): Promise<void> {
    if (!tab.openerTabId) return

    try {
      const openerTab = await browser.tabs.get(tab.openerTabId)
      if (openerTab.groupId !== groupId) return
      if (typeof openerTab.index !== "number") return

      await withTabEditRetry(() => browser.tabs.move(tabId, { index: openerTab.index + 1 }))
    } catch {
      // Best-effort — opener may have been closed
    }
  }

  /**
   * Helper to update a tab group with retry logic using exponential backoff.
   * Chrome throws "Tabs cannot be edited right now" during tab transitions.
   */
  private async updateTabGroupWithRetry(
    groupId: number,
    updateProperties: { collapsed?: boolean; title?: string; color?: TabGroupColor }
  ): Promise<boolean> {
    try {
      await withTabEditRetry(() => browser.tabGroups.update(groupId, updateProperties))
      return true
    } catch {
      return false
    }
  }

  /**
   * Collapse all groups except the one containing the active tab.
   * Used by auto-collapse feature.
   *
   * Note: We query for the current active tab fresh instead of using the
   * tab ID from the event, because browser.tabs.get() can return stale
   * groupId data immediately after tab activation.
   */
  async collapseOtherGroups(activeTabId: number): Promise<void> {
    try {
      if (!browser.tabGroups) return

      // Get the window from the original tab ID
      const targetTab = await browser.tabs.get(activeTabId).catch(() => null)
      if (!targetTab) return
      const windowId = targetTab.windowId

      // Query for the CURRENT active tab in this window to get fresh state
      // This is more reliable than using browser.tabs.get(tabId) which can
      // return stale groupId data immediately after tab activation
      const activeTabs = await browser.tabs.query({ active: true, windowId })
      const currentActiveTab = activeTabs[0]

      if (!currentActiveTab) {
        console.warn("[TabGroupService] No active tab found in window")
        return
      }

      const activeGroupId = currentActiveTab.groupId

      // Tab not in a group - collapse all groups
      if (!activeGroupId || activeGroupId === -1) {
        await this.collapseAllGroups()
        return
      }

      const groups = await browser.tabGroups.query({ windowId })

      for (const group of groups) {
        if (group.id !== activeGroupId && !group.collapsed) {
          await this.updateTabGroupWithRetry(group.id, { collapsed: true })
        }
      }

      // Expand the active group if collapsed
      const activeGroup = groups.find(g => g.id === activeGroupId)
      if (activeGroup?.collapsed) {
        await this.updateTabGroupWithRetry(activeGroup.id, { collapsed: false })
      }
    } catch (error) {
      console.error(`[TabGroupService] Error in collapseOtherGroups:`, error)
    }
  }

  /**
   * Enforces that the leader tab in the "Read Later" / "فيما بعد" group
   * stays strictly pinned at the very beginning of the group (index 0 relative to group).
   */
  async enforceLaterGroupLeaderTab(groupId: number): Promise<boolean> {
    try {
      if (!tabGroupState.lockLaterGroupFirstTab) return false
      if (!browser.tabGroups) return false

      const group = await browser.tabGroups.get(groupId).catch(() => null)
      if (!group) return false

      const targetGroupName = tabGroupState.laterGroupName || "فيما بعد"
      const cleanTitle = stripIndexPrefix(group.title || "")
      if (cleanTitle !== targetGroupName) return false

      const tabs = await browser.tabs.query({ groupId })
      if (!tabs || tabs.length <= 1) return false

      // Sort tabs by their current index
      const sortedTabs = [...tabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      const targetGroupStartIndex = sortedTabs[0].index

      let leaderTabId = tabGroupState.laterGroupLeaderTabId
      // If no leader is designated yet, establish the first tab as the immutable leader
      if (!leaderTabId || !tabs.some(t => t.id === leaderTabId)) {
        leaderTabId = sortedTabs[0].id ?? null
        if (leaderTabId !== null) {
          tabGroupState.laterGroupLeaderTabId = leaderTabId
          const { laterGroupLeaderTabId: storageItem } = await import("../utils/storage")
          await storageItem.setValue(leaderTabId)
        }
      }

      if (!leaderTabId) return false

      const currentFirstTab = sortedTabs[0]
      if (currentFirstTab.id !== leaderTabId && targetGroupStartIndex !== undefined) {
        console.log(
          `[TabGroupService] Restoring later group leader tab ${leaderTabId} to index ${targetGroupStartIndex}`
        )
        await withTabEditRetry(() =>
          browser.tabs.move(leaderTabId!, { index: targetGroupStartIndex })
        )
        return true
      }

      return false
    } catch (err) {
      console.error("[TabGroupService] Error enforcing later group leader tab:", err)
      return false
    }
  }

  // Legacy aliases
  async groupTabsWithRules(): Promise<boolean> {
    return await this.groupAllTabs()
  }

  async preserveExistingGroupColors(): Promise<boolean> {
    return true
  }
}

export const tabGroupService = new TabGroupServiceSimplified()
