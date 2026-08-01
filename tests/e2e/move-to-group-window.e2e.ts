/**
 * E2E Tests: Move Tab To Its Group's Window
 *
 * From #68: when you keep windows roughly by topic, a tab that lands in the
 * wrong one is easier to deal with by sending it home than by hunting for it.
 * Uses two real browser windows.
 */

import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import {
  closeTestTabs,
  createTab,
  disableAutoGroup,
  enableAutoGroup,
  getExtensionId,
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

/** Opens a second window holding a group with the given title */
async function makeGroupInNewWindow(title: string, url: string): Promise<number> {
  return await popupPage.evaluate(
    async ({ groupTitle, tabUrl }) => {
      const win = await chrome.windows.create({ url: tabUrl, focused: false })
      const tabId = win.tabs?.[0]?.id as number
      // Without createProperties, tabs.group makes the group in the *caller's*
      // window and drags the tab back out of the new one
      const groupId = await chrome.tabs.group({
        tabIds: [tabId],
        createProperties: { windowId: win.id }
      })
      await chrome.tabGroups.update(groupId, { title: groupTitle, color: "purple" })
      return win.id as number
    },
    { groupTitle: title, tabUrl: url }
  )
}

async function tabState(tabId: number) {
  return await popupPage.evaluate(async id => {
    const tab = await chrome.tabs.get(id)
    const group = tab.groupId && tab.groupId !== -1 ? await chrome.tabGroups.get(tab.groupId) : null
    return { windowId: tab.windowId, groupTitle: group?.title ?? null }
  }, tabId)
}

async function tabIdFor(urlPart: string): Promise<number> {
  return await popupPage.evaluate(async part => {
    const tabs = await chrome.tabs.query({})
    return tabs.find(tab => tab.url?.includes(part))?.id as number
  }, urlPart)
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
  await setMinimumTabs(popupPage, 1)
  await setGroupByMode(popupPage, "domain")
})

test.afterEach(async () => {
  if (popupPage && !popupPage.isClosed()) {
    await closeExtraWindows()
    await disableAutoGroup(popupPage)
    await ungroupAllTabs(popupPage)
    await popupPage.close()
  }
  await closeTestTabs(context)
})

test.describe("Move tab to its group's window", () => {
  test("sends the tab to the window holding its group", async () => {
    const otherWindowId = await makeGroupInNewWindow("Example", TEST_URLS.domain1)

    await createTab(context, TEST_URLS.domain1Page2)
    const tabId = await tabIdFor("example.com/page2")
    const before = await tabState(tabId)
    expect(before.windowId).not.toBe(otherWindowId)

    await sendMessage(popupPage, "moveTabToGroupWindow", { tabId })

    await expect(async () => {
      const after = await tabState(tabId)
      expect(after.windowId).toBe(otherWindowId)
      expect(after.groupTitle).toBe("Example")
    }).toPass()
  })

  test("does nothing when no other window has that group", async () => {
    await createTab(context, TEST_URLS.domain1)
    const tabId = await tabIdFor("example.com")
    const before = await tabState(tabId)

    const result = (await sendMessage(popupPage, "moveTabToGroupWindow", { tabId })) as {
      moved: boolean
    }

    expect(result.moved).toBe(false)
    expect((await tabState(tabId)).windowId).toBe(before.windowId)
  })

  test("works for a tab already grouped in its own window", async () => {
    const otherWindowId = await makeGroupInNewWindow("Example", TEST_URLS.domain1)

    await createTab(context, TEST_URLS.domain1Page2)
    await enableAutoGroup(popupPage)
    await waitForGroup(popupPage, "Example")
    await disableAutoGroup(popupPage)

    const tabId = await tabIdFor("example.com/page2")
    await sendMessage(popupPage, "moveTabToGroupWindow", { tabId })

    await expect(async () => {
      expect((await tabState(tabId)).windowId).toBe(otherWindowId)
    }).toPass()
  })
})
