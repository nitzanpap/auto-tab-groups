/**
 * E2E Tests: Wait Until Viewed Before Grouping
 *
 * The scenario from issues #68 / #88: you middle-click a search result, the
 * extension files the tab into a group elsewhere in the strip, and it seems to
 * have vanished before you ever looked at it. With the setting on, the tab
 * stays put until you switch to it.
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  createTab,
  disableAutoGroup,
  enableAutoGroup,
  getExtensionId,
  getTabGroups,
  groupAllTabs,
  launchExtensionContext,
  openPopup,
  sendMessage,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
  ungroupAllTabs,
  waitForGroup
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

async function setDefer(page: Page, enabled: boolean): Promise<void> {
  await sendMessage(page, "toggleDeferGroupingUntilSeen", { enabled })
}

/**
 * Opens a background tab from another tab, the way a middle-click does.
 *
 * Driven from the popup because only an extension page can call chrome.tabs —
 * the opener itself is an ordinary web page.
 */
async function openBackgroundTabFrom(openerUrlPart: string, url: string): Promise<number> {
  return await popupPage.evaluate(
    async ({ part, targetUrl }) => {
      const tabs = await chrome.tabs.query({})
      const opener = tabs.find(tab => tab.url?.includes(part))
      const created = await chrome.tabs.create({
        url: targetUrl,
        active: false,
        openerTabId: opener?.id
      })
      return created.id as number
    },
    { part: openerUrlPart, targetUrl: url }
  )
}

async function groupTitleOf(page: Page, tabId: number): Promise<string | null> {
  return await page.evaluate(async id => {
    const tab = await chrome.tabs.get(id)
    if (!tab.groupId || tab.groupId === -1) return null
    const group = await chrome.tabGroups.get(tab.groupId)
    return group.title ?? null
  }, tabId)
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
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
  await setDefer(popupPage, false)
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await setDefer(popupPage, false)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Wait until viewed before grouping", () => {
  test("is off by default", async () => {
    const result = (await sendMessage(popupPage, "getDeferGroupingUntilSeen")) as {
      enabled: boolean
    }
    expect(result.enabled).toBe(false)
  })

  test("groups a background tab immediately while off", async () => {
    await createTab(context, TEST_URLS.domain2)
    await enableAutoGroup(popupPage)

    await openBackgroundTabFrom("httpbin.org", TEST_URLS.domain1)

    await waitForGroup(popupPage, "Example")
  })

  test("leaves a background tab alone while on", async () => {
    await createTab(context, TEST_URLS.domain2)
    await setDefer(popupPage, true)
    await enableAutoGroup(popupPage)

    const tabId = await openBackgroundTabFrom("httpbin.org", TEST_URLS.domain1)
    await popupPage.waitForTimeout(1500)

    expect(await groupTitleOf(popupPage, tabId)).toBeNull()
    const titles = (await getTabGroups(popupPage)).map(group => group.title)
    expect(titles).not.toContain("Example")
  })

  test("groups it as soon as you switch to it", async () => {
    await createTab(context, TEST_URLS.domain2)
    await setDefer(popupPage, true)
    await enableAutoGroup(popupPage)

    const tabId = await openBackgroundTabFrom("httpbin.org", TEST_URLS.domain1)
    await popupPage.waitForTimeout(1000)
    expect(await groupTitleOf(popupPage, tabId)).toBeNull()

    await popupPage.evaluate(async id => await chrome.tabs.update(id, { active: true }), tabId)

    await waitForGroup(popupPage, "Example")
    await expect(async () => {
      expect(await groupTitleOf(popupPage, tabId)).toBe("Example")
    }).toPass()
  })

  test("still groups a waiting tab when Group Tabs is clicked", async () => {
    await createTab(context, TEST_URLS.domain2)
    await setDefer(popupPage, true)
    await enableAutoGroup(popupPage)

    const tabId = await openBackgroundTabFrom("httpbin.org", TEST_URLS.domain1)
    await popupPage.waitForTimeout(1000)
    expect(await groupTitleOf(popupPage, tabId)).toBeNull()

    await groupAllTabs(popupPage)

    await expect(async () => {
      expect(await groupTitleOf(popupPage, tabId)).toBe("Example")
    }).toPass()
  })

  test("groups a foreground tab straight away even while on", async () => {
    await setDefer(popupPage, true)
    await enableAutoGroup(popupPage)

    await createTab(context, TEST_URLS.domain1)

    await waitForGroup(popupPage, "Example")
  })
})
