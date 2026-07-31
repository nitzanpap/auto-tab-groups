/**
 * E2E Tests: Grouping by Query String
 *
 * The scenario from issue #27: several tabs on one domain that should be split
 * into a group per ticket id, taken from a query parameter.
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
  waitForGroup
} from "./helpers/extension-helpers"

let context: BrowserContext
let extensionId: string
let popupPage: Page

const TICKET_URL = (id: string) => `https://domain.cz/?ticket=${id}`

async function deleteAllRules(page: Page): Promise<void> {
  for (const ruleId of Object.keys(await getCustomRules(page))) {
    await deleteCustomRule(page, ruleId)
  }
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
  await deleteAllRules(popupPage)
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await disableAutoGroup(popupPage)
    await ungroupAllTabs(popupPage)
    await deleteAllRules(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Grouping by query string", () => {
  test("splits one domain into a group per ticket via regex", async () => {
    await addCustomRule(popupPage, {
      name: "Tickets",
      domains: ["/.*domain\\.cz.*ticket=([a-z0-9-]+)/"],
      color: "blue"
    })
    await enableAutoGroup(popupPage)

    await createTab(context, TICKET_URL("VZ01"))
    await createTab(context, TICKET_URL("VZ02"))

    await waitForGroup(popupPage, "VZ01")
    await waitForGroup(popupPage, "VZ02")

    const titles = (await getTabGroups(popupPage)).map(group => group.title)
    expect(titles).toContain("VZ01")
    expect(titles).toContain("VZ02")
  })

  test("keeps tabs sharing a ticket together", async () => {
    await addCustomRule(popupPage, {
      name: "Tickets",
      domains: ["/.*domain\\.cz.*ticket=([a-z0-9-]+)/"],
      color: "blue"
    })
    await enableAutoGroup(popupPage)

    await createTab(context, TICKET_URL("VZ01"))
    await createTab(context, `https://domain.cz/detail?ticket=VZ01&view=full`)

    const group = await waitForGroup(popupPage, "VZ01")
    const tabs = await popupPage.evaluate(
      async groupId => (await chrome.tabs.query({ groupId })).length,
      group.id
    )

    expect(tabs).toBe(2)
  })

  test("extracts a query value with a segment pattern", async () => {
    await addCustomRule(popupPage, {
      name: "Tickets",
      domains: ["domain.cz/?ticket={ticket}"],
      color: "green"
    })
    await enableAutoGroup(popupPage)

    await createTab(context, TICKET_URL("VZ03"))

    await waitForGroup(popupPage, "VZ03")
  })

  test("matches one specific query value with a plain pattern", async () => {
    await addCustomRule(popupPage, {
      name: "Just VZ01",
      domains: ["domain.cz/?ticket=VZ01"],
      color: "red"
    })
    await enableAutoGroup(popupPage)

    await createTab(context, TICKET_URL("VZ01"))
    await createTab(context, TICKET_URL("VZ02"))

    await waitForGroup(popupPage, "Just VZ01")

    // VZ02 doesn't match the rule, so it falls through to domain grouping
    await waitForGroup(popupPage, "Domain")
  })
})
