/**
 * Tab Discard Service
 * Automatically discards (freezes/hibernates) inactive background tabs after 1 minute
 * of inactivity to free up RAM and prevent memory leaks.
 */

import type { Browser } from "wxt/browser"
import { tabGroupService } from "./TabGroupService"

export class TabDiscardService {
  private checkIntervalId: ReturnType<typeof setInterval> | null = null
  private lastActiveMap = new Map<number, number>()
  private readonly INACTIVITY_THRESHOLD_MS = 60 * 1000 // 1 minute
  private readonly CHECK_INTERVAL_MS = 20 * 1000 // Check every 20 seconds
  private enabled = true

  /**
   * Initializes the tab discard monitor with a startup delay to avoid
   * putting pressure on Chrome while restoring tabs.
   */
  initialize(initialDelayMs = 30000): void {
    if (this.checkIntervalId) return

    setTimeout(() => {
      if (this.checkIntervalId) return
      this.checkIntervalId = setInterval(() => {
        this.checkAndDiscardInactiveTabs().catch(err => {
          console.error("[TabDiscardService] Error checking inactive tabs:", err)
        })
      }, this.CHECK_INTERVAL_MS)
      console.log("[TabDiscardService] Auto-discard interval started (1 minute threshold)")
    }, initialDelayMs)

    console.log(`[TabDiscardService] Auto-discard initialized (first check in ${initialDelayMs / 1000}s)`)
  }

  /**
   * Stops the background monitor
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId)
      this.checkIntervalId = null
    }
  }

  /**
   * Records when a tab becomes active or is accessed
   */
  recordTabActivity(tabId: number): void {
    this.lastActiveMap.set(tabId, Date.now())
  }

  /**
   * Removes tab from tracking on removal
   */
  removeTab(tabId: number): void {
    this.lastActiveMap.delete(tabId)
  }

  /**
   * Checks all open tabs and discards eligible inactive background tabs
   */
  async checkAndDiscardInactiveTabs(): Promise<number> {
    if (!this.enabled) return 0
    if (tabGroupService.isStartupGracePeriodActive()) {
      return 0
    }

    try {
      const tabs = await browser.tabs.query({})
      const now = Date.now()
      let discardedCount = 0

      for (const tab of tabs) {
        if (!tab.id) continue

        // Do not discard active tabs
        if (tab.active) {
          this.lastActiveMap.set(tab.id, now)
          continue
        }

        // Do not discard already discarded tabs
        if (tab.discarded) continue

        // Do not discard pinned tabs
        if (tab.pinned) continue

        // Do not discard tabs playing audio (e.g. music, video, podcasts, streams)
        if (tab.audible) {
          this.lastActiveMap.set(tab.id, now)
          continue
        }

        // Respect browser autoDiscardable flag if set to false
        if (tab.autoDiscardable === false) {
          continue
        }

        // Do not discard extension internal pages
        if (tab.url?.startsWith("chrome-extension://") || tab.url?.startsWith("moz-extension://")) {
          continue
        }

        // Determine last accessed time
        const tabLastAccessed = tab.lastAccessed ?? this.lastActiveMap.get(tab.id) ?? now
        if (now - tabLastAccessed >= this.INACTIVITY_THRESHOLD_MS) {
          try {
            if (browser.tabs.discard) {
              await browser.tabs.discard(tab.id)
              discardedCount++
              console.log(`[TabDiscardService] Discarded inactive tab ${tab.id} ("${tab.title || tab.url}")`)
            }
          } catch (discardError) {
            // Some tabs cannot be discarded (e.g. devtools, special internal pages)
            console.debug(`[TabDiscardService] Could not discard tab ${tab.id}:`, discardError)
          }
        }
      }

      return discardedCount
    } catch (error) {
      console.error("[TabDiscardService] Error during tab discard scan:", error)
      return 0
    }
  }
}

export const tabDiscardService = new TabDiscardService()
