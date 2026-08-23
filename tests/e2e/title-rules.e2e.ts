/**
 * E2E Tests: Rules That Match The Page Title
 *
 * A "title:" pattern is matched against the tab's title instead of its URL
 * (#98). Titles also arrive after the URL and change again on client-side
 * navigation, so the background has to re-file a tab when one changes.
 *
 * The served fixtures title every page "<hostname><pathname>", which is why
 * the patterns below look URL-ish — they are still read from the title.
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  addCustomRule,
  closeTestTabs,
  createTab,
  deleteCustomRule,
  disableAutoGroup,
  enableAutoGroup,
  getCustomRules,
  getExtensionId,
  getTabGroups,
  launchExtensionContext,
  openPopup,
  setGroupByMode,
  setMinimumTabs,
  ungroupAllTabs,
  waitForGroup,
  waitForGroups
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

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

  for (const ruleId of Object.keys(await getCustomRules(popupPage))) {
    await deleteCustomRule(popupPage, ruleId)
  }
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    for (const ruleId of Object.keys(await getCustomRules(popupPage))) {
      await deleteCustomRule(popupPage, ruleId)
    }
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Title rules", () => {
  test("groups tabs from different domains by what their titles say", async () => {
    const ruleId = await addCustomRule(popupPage, {
      name: "Reading",
      domains: ["title:*/reading"],
      color: "purple",
      enabled: true
    })
    expect(ruleId).toBeTruthy()

    await enableAutoGroup(popupPage)
    const first = await createTab(context, "https://example.com/reading")
    const second = await createTab(context, "https://httpbin.org/reading")

    await waitForGroups(popupPage, groups => {
      const reading = groups.find(group => group.title === "Reading")
      return !!reading
    })

    const groups = await getTabGroups(popupPage)
    // Two unrelated domains in one group is only possible via the title
    expect(groups.map(group => group.title)).toContain("Reading")
    expect(groups.filter(group => group.title === "Example" || group.title === "Httpbin")).toEqual(
      []
    )

    await first.close()
    await second.close()
  })

  test("re-files a tab when its title changes", async () => {
    await addCustomRule(popupPage, {
      name: "Reading",
      domains: ["title:read this later"],
      color: "purple",
      enabled: true
    })

    await enableAutoGroup(popupPage)
    const tab = await createTab(context, "https://example.com/page2")

    // Domain grouping files it first — its title says nothing about reading yet
    await waitForGroup(popupPage, "Example")

    await tab.evaluate(() => {
      document.title = "read this later"
    })

    await waitForGroup(popupPage, "Reading")

    await tab.close()
  })
})
