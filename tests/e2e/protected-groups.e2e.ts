/**
 * E2E Tests: Groups Excluded From Auto-Grouping
 *
 * Protected groups survive auto-grouping, forced grouping and "Ungroup All",
 * and go back to being managed once removed from the list.
 *
 * The install-time seeding is covered in tests/FirstRunService.test.ts —
 * chrome.runtime.reload() unloads an --load-extension extension, so a real
 * reinstall can't be driven from here.
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
  ungroupAllTabs
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

const MANUAL_GROUP = "My Reading List"

async function getProtected(page: Page): Promise<string[]> {
  const result = (await sendMessage(page, "getProtectedGroups")) as { titles: string[] }
  return result.titles
}

async function setProtected(page: Page, titles: string[]): Promise<void> {
  // Goes through the background so its in-memory state matches storage —
  // writing to storage.local directly would leave the service worker stale.
  for (const title of await getProtected(page)) {
    await sendMessage(page, "removeProtectedGroup", { title })
  }
  for (const title of titles) {
    await sendMessage(page, "addProtectedGroup", { title })
  }
}

/** Groups the given tabs under a title, the way a user would by hand */
async function createManualGroup(page: Page, title: string, tabIds: number[]): Promise<number> {
  return await page.evaluate(
    async ({ ids, groupTitle }) => {
      const groupId = await chrome.tabs.group({ tabIds: ids })
      await chrome.tabGroups.update(groupId, { title: groupTitle, color: "purple" })
      return groupId
    },
    { ids: tabIds, groupTitle: title }
  )
}

async function getTabIds(page: Page, urlPart: string): Promise<number[]> {
  return await page.evaluate(async part => {
    const tabs = await chrome.tabs.query({})
    return tabs.filter(tab => tab.url?.includes(part)).map(tab => tab.id as number)
  }, urlPart)
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
  await setProtected(popupPage, [])
  await ungroupAllTabs(popupPage)
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await setProtected(popupPage, [])
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Protected groups", () => {
  test("auto-grouping leaves a protected group alone", async () => {
    const tab = await createTab(context, TEST_URLS.domain1)
    const ids = await getTabIds(popupPage, "example.com")
    await createManualGroup(popupPage, MANUAL_GROUP, ids)
    await setProtected(popupPage, [MANUAL_GROUP])

    await enableAutoGroup(popupPage)
    await tab.reload()
    await popupPage.waitForTimeout(1500)

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === MANUAL_GROUP)).toBe(true)
    expect(groups.some(group => group.title === "Example")).toBe(false)
  })

  test("an explicit Group Tabs click leaves it alone too", async () => {
    await createTab(context, TEST_URLS.domain1)
    const ids = await getTabIds(popupPage, "example.com")
    await createManualGroup(popupPage, MANUAL_GROUP, ids)
    await setProtected(popupPage, [MANUAL_GROUP])

    await groupAllTabs(popupPage)
    await popupPage.waitForTimeout(1500)

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === MANUAL_GROUP)).toBe(true)
  })

  test("Ungroup All leaves it standing", async () => {
    await createTab(context, TEST_URLS.domain1)
    const ids = await getTabIds(popupPage, "example.com")
    await createManualGroup(popupPage, MANUAL_GROUP, ids)
    await setProtected(popupPage, [MANUAL_GROUP])

    await popupPage.evaluate(
      async () =>
        await new Promise(resolve => chrome.runtime.sendMessage({ action: "ungroup" }, resolve))
    )
    await popupPage.waitForTimeout(1000)

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === MANUAL_GROUP)).toBe(true)
  })

  test("removing the protection hands the group back to auto-grouping", async () => {
    await createTab(context, TEST_URLS.domain1)
    const ids = await getTabIds(popupPage, "example.com")
    await createManualGroup(popupPage, MANUAL_GROUP, ids)
    await setProtected(popupPage, [MANUAL_GROUP])
    await enableAutoGroup(popupPage)
    await popupPage.waitForTimeout(500)

    await sendMessage(popupPage, "removeProtectedGroup", { title: MANUAL_GROUP })
    await popupPage.waitForTimeout(1500)

    expect(await getProtected(popupPage)).toEqual([])
    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === "Example")).toBe(true)
  })

  test("other tabs still get grouped normally around it", async () => {
    await createTab(context, TEST_URLS.domain1)
    const ids = await getTabIds(popupPage, "example.com")
    await createManualGroup(popupPage, MANUAL_GROUP, ids)
    await setProtected(popupPage, [MANUAL_GROUP])

    await enableAutoGroup(popupPage)
    await createTab(context, TEST_URLS.domain2)
    await popupPage.waitForTimeout(1500)

    const groups = await getTabGroups(popupPage)
    expect(groups.some(group => group.title === MANUAL_GROUP)).toBe(true)
    expect(groups.some(group => group.title === "Httpbin")).toBe(true)
  })

  test("the popup lists protected groups and can remove one", async () => {
    await setProtected(popupPage, [MANUAL_GROUP])
    const page = await openPopup(context, extensionId)
    await page.waitForTimeout(500)

    const chip = page.locator(".protected-group-chip")
    await expect(chip).toHaveCount(1)
    await expect(chip).toContainText(MANUAL_GROUP)

    await chip.locator("button").click()
    await page.waitForTimeout(1000)

    await expect(page.locator(".protected-group-chip")).toHaveCount(0)
    expect(await getProtected(popupPage)).toEqual([])

    await page.close()
  })

  test("the list stays hidden when nothing is protected", async () => {
    const page = await openPopup(context, extensionId)
    await page.waitForTimeout(500)

    await expect(page.locator("#protectedGroupsList")).toBeHidden()
    await expect(page.locator("#protectedGroupsContainer")).toBeHidden()

    await page.close()
  })
})
