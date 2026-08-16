/**
 * E2E Tests: Consolidate Groups Across Windows
 *
 * From #68: a group split over several windows gets merged into the window
 * already holding most of it. Because the merge cannot be undone, the UI shows
 * the plan first — both halves are exercised here, across real windows.
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  disableAutoGroup,
  getExtensionId,
  launchExtensionContext,
  openPopup,
  sendMessage,
  ungroupAllTabs
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

/**
 * Creates a window holding a titled group.
 *
 * createProperties is required: without it tabs.group builds the group in the
 * *caller's* window and drags the tabs back out of the new one.
 */
async function makeGroupInNewWindow(title: string, urls: string[]): Promise<number> {
  return await popupPage.evaluate(
    async ({ groupTitle, tabUrls }) => {
      const win = await chrome.windows.create({ url: tabUrls, focused: false })
      const tabIds = (win.tabs ?? []).map(tab => tab.id as number)
      const groupId = await chrome.tabs.group({
        tabIds,
        createProperties: { windowId: win.id }
      })
      await chrome.tabGroups.update(groupId, { title: groupTitle, color: "purple" })
      return win.id as number
    },
    { groupTitle: title, tabUrls: urls }
  )
}

async function groupLayout(): Promise<string[]> {
  return await popupPage.evaluate(async () => {
    const groups = await chrome.tabGroups.query({})
    const tabs = await chrome.tabs.query({})
    return groups
      .map(g => `${g.title}@${g.windowId}:${tabs.filter(t => t.groupId === g.id).length}`)
      .sort()
  })
}

async function closeExtraWindows(): Promise<void> {
  await popupPage.evaluate(async () => {
    const current = await chrome.windows.getCurrent()
    for (const win of await chrome.windows.getAll()) {
      if (win.id && win.id !== current.id) await chrome.windows.remove(win.id)
    }
  })
}

test.beforeAll(async () => {
  context = await launchExtensionContext()
  extensionId = await getExtensionId(context)
})

test.afterAll(async () => {
  await context.close()
})

test.beforeEach(async () => {
  await closeTestTabs(context)
  popupPage = await openPopup(context, extensionId)
  await disableAutoGroup(popupPage)
  await ungroupAllTabs(popupPage)
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await closeExtraWindows()
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Consolidate groups", () => {
  test("plans nothing when every group lives in one window", async () => {
    await makeGroupInNewWindow("Docs", ["https://docs.test/1", "https://docs.test/2"])

    const result = (await sendMessage(popupPage, "planGroupConsolidation")) as {
      moves: unknown[]
    }

    expect(result.moves).toEqual([])
  })

  test("merges a group split across three windows into the largest", async () => {
    const home = await makeGroupInNewWindow("Wikipedia", [
      "https://wiki.test/1",
      "https://wiki.test/2",
      "https://wiki.test/3"
    ])
    await makeGroupInNewWindow("Wikipedia", ["https://wiki.test/4"])
    await makeGroupInNewWindow("Wikipedia", ["https://wiki.test/5"])

    const plan = (await sendMessage(popupPage, "planGroupConsolidation")) as {
      moves: { title: string; toWindowId: number }[]
    }
    expect(plan.moves).toHaveLength(2)
    expect(plan.moves.every(move => move.toWindowId === home)).toBe(true)

    const result = (await sendMessage(popupPage, "consolidateGroups")) as {
      movedTabs: number
      movedGroups: number
    }

    expect(result).toEqual({ movedTabs: 2, movedGroups: 2 })
    await expect(async () => {
      expect(await groupLayout()).toContain(`Wikipedia@${home}:5`)
    }).toPass()
  })

  test("leaves unrelated groups untouched", async () => {
    const home = await makeGroupInNewWindow("Wikipedia", [
      "https://wiki.test/1",
      "https://wiki.test/2"
    ])
    await makeGroupInNewWindow("Wikipedia", ["https://wiki.test/3"])
    const docs = await makeGroupInNewWindow("Docs", ["https://docs.test/1"])

    await sendMessage(popupPage, "consolidateGroups")

    await expect(async () => {
      const layout = await groupLayout()
      expect(layout).toContain(`Wikipedia@${home}:3`)
      expect(layout).toContain(`Docs@${docs}:1`)
    }).toPass()
  })

  test("planning alone moves nothing", async () => {
    await makeGroupInNewWindow("Wikipedia", ["https://wiki.test/1", "https://wiki.test/2"])
    await makeGroupInNewWindow("Wikipedia", ["https://wiki.test/3"])

    const before = await groupLayout()
    await sendMessage(popupPage, "planGroupConsolidation")

    expect(await groupLayout()).toEqual(before)
  })

  test("shows the row only when something is split, and merges from the popup", async () => {
    const home = await makeGroupInNewWindow("Wikipedia", [
      "https://wiki.test/1",
      "https://wiki.test/2"
    ])
    await makeGroupInNewWindow("Wikipedia", ["https://wiki.test/3"])

    const page = await openPopup(context, extensionId)
    await page.locator(".advanced-toggle").click()

    const row = page.locator("#consolidateRow")
    await expect(row).toBeVisible()

    // First click reveals the plan rather than doing anything
    await page.locator("#consolidateButton").click()
    await expect(page.locator(".consolidate-preview-row")).toHaveCount(1)
    expect(await groupLayout()).toContain(`Wikipedia@${home}:2`)

    // Second click confirms
    await page.locator("#consolidateButton").click()
    await expect(async () => {
      expect(await groupLayout()).toContain(`Wikipedia@${home}:3`)
    }).toPass()

    // Nothing left to merge, so the row goes away
    await expect(row).toBeHidden()

    await page.close()
  })

  test("hides the row when there is nothing to merge", async () => {
    await makeGroupInNewWindow("Docs", ["https://docs.test/1"])

    const page = await openPopup(context, extensionId)
    await page.locator(".advanced-toggle").click()

    await expect(page.locator("#consolidateRow")).toBeHidden()

    await page.close()
  })
})
