/**
 * Basic validation test for the refactored TabGroupService
 * Ensures all modules load correctly and basic functionality works
 */

import { test, expect } from "@playwright/test"

test("TabGroupService modules load correctly", async ({ page }) => {
  // Create a basic HTML page to test the extension modules
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TabGroupService Test</title>
    </head>
    <body>
      <script type="module">
        // Mock the browser API for testing
        globalThis.browserAPI = {
          tabs: {
            query: async () => [],
            get: async () => ({ id: 1, url: 'https://example.com', windowId: 1 }),
            group: async () => 1,
            ungroup: async () => {}
          },
          tabGroups: {
            query: async () => [],
            get: async () => ({ id: 1, title: 'Test', color: 'blue' }),
            update: async () => {}
          },
          windows: {
            getCurrent: async () => ({ id: 1, type: 'normal' }),
            getAll: async () => [{ id: 1, type: 'normal', focused: true }]
          }
        }

        // Test loading the refactored service
        import('./src/services/TabGroupService.js').then((module) => {
          window.tabGroupService = module.tabGroupService
          window.moduleLoaded = true
        }).catch((error) => {
          window.loadError = error.message
        })
      </script>
    </body>
    </html>
  `)

  // Wait for the module to load
  await page.waitForFunction(() => window.moduleLoaded || window.loadError, { timeout: 5000 })

  // Check that the module loaded successfully
  const loadError = await page.evaluate(() => window.loadError)
  expect(loadError).toBeUndefined()

  const moduleLoaded = await page.evaluate(() => window.moduleLoaded)
  expect(moduleLoaded).toBe(true)

  // Test that the service has the expected methods
  const hasExpectedMethods = await page.evaluate(() => {
    const service = window.tabGroupService
    const requiredMethods = [
      "createGroup",
      "moveTabToGroup",
      "groupTabsByDomain",
      "ungroupAllTabs",
      "generateNewColors",
      "toggleAllGroupsCollapse"
    ]

    return requiredMethods.every(method => typeof service[method] === "function")
  })

  expect(hasExpectedMethods).toBe(true)
})

test("Core services load independently", async ({ page }) => {
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Core Services Test</title>
    </head>
    <body>
      <script type="module">
        // Mock browser API
        globalThis.browserAPI = {
          tabs: { query: async () => [] },
          tabGroups: { query: async () => [] }
        }

        // Mock state and storage
        window.mockState = {
          autoGroupingEnabled: true,
          groupByMode: "domain",
          getColor: () => 'blue',
          setColor: () => {},
          getGroupDomain: () => 'example.com',
          setGroupDomain: () => {},
          getDomainColors: () => []
        }

        window.mockStorage = {
          saveState: async () => {}
        }

        const coreServices = [
          './src/services/core/OperationLock.js',
          './src/services/core/ColorManager.js',
          './src/services/core/GroupResolver.js',
          './src/services/core/GroupMatcher.js'
        ]

        Promise.all(coreServices.map(service => import(service)))
          .then(() => {
            window.coreServicesLoaded = true
          })
          .catch((error) => {
            window.coreLoadError = error.message
          })
      </script>
    </body>
    </html>
  `)

  // Wait for core services to load
  await page.waitForFunction(() => window.coreServicesLoaded || window.coreLoadError, {
    timeout: 5000
  })

  const loadError = await page.evaluate(() => window.coreLoadError)
  expect(loadError).toBeUndefined()

  const servicesLoaded = await page.evaluate(() => window.coreServicesLoaded)
  expect(servicesLoaded).toBe(true)
})

test("TabGroupService handles pinned tabs correctly", async ({ page }) => {
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pinned Tab Test</title>
    </head>
    <body>
      <script type="module">
        // Mock the browser API for testing pinned tabs
        let groupCalled = false
        
        globalThis.browserAPI = {
          tabs: {
            get: async (tabId) => {
              if (tabId === 1) {
                return { id: 1, url: 'https://github.com', windowId: 1, pinned: true }
              } else if (tabId === 2) {
                return { id: 2, url: 'https://github.com', windowId: 1, pinned: false }
              }
            },
            group: async (options) => {
              groupCalled = true
              window.lastGroupCall = options
              return 1
            }
          },
          tabGroups: {
            query: async () => [],
            update: async () => {}
          }
        }

        // Mock other required modules
        globalThis.tabGroupState = {
          autoGroupingEnabled: true,
          groupByMode: "domain",
          customRules: new Map()
        }

        // Load the service and test
        import('./src/services/TabGroupService.js').then(async (module) => {
          const service = module.tabGroupService
          
          // Test 1: Pinned tab should not be grouped
          const result1 = await service.handleTabUpdate(1)
          window.pinnedTabResult = result1
          window.groupCalledForPinned = groupCalled
          
          // Reset for next test
          groupCalled = false
          
          // Test 2: Unpinned tab should be grouped
          const result2 = await service.handleTabUpdate(2)
          window.unpinnedTabResult = result2
          window.groupCalledForUnpinned = groupCalled
          
          window.testCompleted = true
        }).catch((error) => {
          window.testError = error.message
        })
      </script>
    </body>
    </html>
  `)

  // Wait for test to complete
  await page.waitForFunction(() => window.testCompleted || window.testError, { timeout: 5000 })

  const testError = await page.evaluate(() => window.testError)
  expect(testError).toBeUndefined()

  // Verify pinned tab was not grouped
  const pinnedTabResult = await page.evaluate(() => window.pinnedTabResult)
  expect(pinnedTabResult).toBe(false)

  const groupCalledForPinned = await page.evaluate(() => window.groupCalledForPinned)
  expect(groupCalledForPinned).toBe(false)

  // Verify unpinned tab was grouped
  const unpinnedTabResult = await page.evaluate(() => window.unpinnedTabResult)
  expect(unpinnedTabResult).toBe(true)

  const groupCalledForUnpinned = await page.evaluate(() => window.groupCalledForUnpinned)
  expect(groupCalledForUnpinned).toBe(true)
})
