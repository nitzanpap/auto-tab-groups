/**
 * Browser API compatibility layer for Chrome and Firefox
 * Provides a unified interface for both browsers
 */

// Create a unified browser API that works for both Chrome and Firefox
const browserAPI = (() => {
  // Chrome uses chrome.* APIs, Firefox uses browser.*
  const api = typeof browser !== "undefined" ? browser : chrome

  // For Chrome, we need to promisify some APIs that are callback-based
  if (typeof browser === "undefined" && typeof chrome !== "undefined") {
    // Check if we're in Chrome MV3 where many APIs are already promise-based
    const isChromeMV3 = chrome.runtime.getManifest().manifest_version === 3

    // Chrome-specific promisification for APIs that need it
    const promisify =
      (fn) =>
      (...args) => {
        return new Promise((resolve, reject) => {
          fn(...args, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(result)
            }
          })
        })
      }

    // In Chrome MV3, tabGroups API is already promise-based, no need to promisify
    const tabGroupsAPI = api.tabGroups
      ? isChromeMV3
        ? api.tabGroups // Use directly in MV3
        : {
            // Promisify for MV2
            ...api.tabGroups,
            query: promisify(api.tabGroups.query.bind(api.tabGroups)),
            get: promisify(api.tabGroups.get.bind(api.tabGroups)),
            update: promisify(api.tabGroups.update.bind(api.tabGroups)),
          }
      : undefined

    // Override specific APIs that need promisification in Chrome
    return {
      ...api,
      tabs: {
        ...api.tabs,
        query: isChromeMV3 ? api.tabs.query : promisify(api.tabs.query.bind(api.tabs)),
        get: isChromeMV3 ? api.tabs.get : promisify(api.tabs.get.bind(api.tabs)),
        group: isChromeMV3 ? api.tabs.group : promisify(api.tabs.group.bind(api.tabs)),
        ungroup: isChromeMV3 ? api.tabs.ungroup : promisify(api.tabs.ungroup.bind(api.tabs)),
      },
      tabGroups: tabGroupsAPI,
      windows: {
        ...api.windows,
        getCurrent: isChromeMV3
          ? api.windows.getCurrent
          : promisify(api.windows.getCurrent.bind(api.windows)),
      },
      storage: {
        ...api.storage,
        local: {
          ...api.storage.local,
          get: isChromeMV3
            ? api.storage.local.get
            : promisify(api.storage.local.get.bind(api.storage.local)),
          set: isChromeMV3
            ? api.storage.local.set
            : promisify(api.storage.local.set.bind(api.storage.local)),
        },
      },
      runtime: {
        ...api.runtime,
        sendMessage: api.runtime.sendMessage, // Already promise-based in MV3
        onMessage: api.runtime.onMessage,
      },
    }
  }

  // Firefox already has promise-based APIs
  return api
})()

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = browserAPI
} else if (typeof globalThis !== "undefined") {
  globalThis.browserAPI = browserAPI
}
