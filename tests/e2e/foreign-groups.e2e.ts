/**
 * E2E Tests: Groups Created By Other Extensions
 *
 * Another extension's group cannot be put on the protected list when it is
 * named per session, so the minimum-tabs threshold has to recognise it as
 * something Auto Tab Groups did not build and leave it standing (#96).
 *
 * A group made here with chrome.tabs.group is indistinguishable from one
 * another extension makes — the API is the same one they call.
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  createTab,
  disableAutoGroup,
  enableAutoGroup,
  getExtensionId,
  getTabGroups,
  launchExtensionContext,
  openPopup,
  setGroupByMode,
  setMinimumTabs,
  TEST_URLS,
  ungroupAllTabs,
  waitForGroup,
  waitForGroups
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

/** The title another extension gave its group this session */
const SESSION_TITLE = "Tab grouping threshold extension"

/** Groups tabs the way another extension does — same API, its own title */
async function createForeignGroup(page: Page, title: string, urlPart: string): Promise<number> {
  return await page.evaluate(
    async ({ groupTitle, part }) => {
      const tabs = await chrome.tabs.query({})
      const tabIds = tabs.filter(tab => tab.url?.includes(part)).map(tab => tab.id as number)
      const groupId = await chrome.tabs.group({ tabIds })
      await chrome.tabGroups.update(groupId, { title: groupTitle, color: "orange" })
      return groupId
    },
    { groupTitle: title, part: urlPart }
  )
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
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await setMinimumTabs(popupPage, 1)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Groups created by other extensions", () => {
  test("the minimum-tabs sweep leaves a session-named group standing", async () => {
    // Their group: one tab, a title no protected list could hold
    const foreignTab = await createTab(context, TEST_URLS.domain3)
    const foreignGroupId = await createForeignGroup(
      popupPage,
      SESSION_TITLE,
      "jsonplaceholder.typicode.com"
    )

    // Ours: two tabs, which the threshold below will put under the minimum
    await createTab(context, TEST_URLS.domain1)
    const ourSecondTab = await createTab(context, TEST_URLS.domain1Page2)

    await setMinimumTabs(popupPage, 2)
    await enableAutoGroup(popupPage)
    await waitForGroup(popupPage, "Example")

    // Closing a tab runs the sweep over every group in the window
    await ourSecondTab.close()

    // Our group going away is the proof the sweep ran
    await waitForGroups(popupPage, groups => !groups.some(group => group.title === "Example"))

    const groups = await getTabGroups(popupPage)
    const foreign = groups.find(group => group.id === foreignGroupId)
    expect(foreign?.title).toBe(SESSION_TITLE)

    await foreignTab.close()
  })

  test("a tab navigating inside their group is not pulled out of it", async () => {
    const foreignTab = await createTab(context, TEST_URLS.domain3)
    const foreignGroupId = await createForeignGroup(
      popupPage,
      SESSION_TITLE,
      "jsonplaceholder.typicode.com"
    )

    await setMinimumTabs(popupPage, 5)
    await enableAutoGroup(popupPage)

    // A domain with far fewer than 5 tabs — the case that used to ungroup it
    await foreignTab.goto(TEST_URLS.domain2)

    await expect(async () => {
      const tabs = await popupPage.evaluate(async () => {
        const all = await chrome.tabs.query({})
        return all.map(tab => ({ url: tab.url ?? "", groupId: tab.groupId }))
      })
      const moved = tabs.find(tab => tab.url.includes("httpbin.org"))
      expect(moved?.groupId).toBe(foreignGroupId)
    }).toPass()

    await foreignTab.close()
  })
})
