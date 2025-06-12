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
    // Chrome-specific promisification for MV3
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

    // Override specific APIs that need promisification in Chrome
    return {
      ...api,
      tabs: {
        ...api.tabs,
        query: promisify(api.tabs.query.bind(api.tabs)),
        get: promisify(api.tabs.get.bind(api.tabs)),
        group: promisify(api.tabs.group.bind(api.tabs)),
        ungroup: promisify(api.tabs.ungroup.bind(api.tabs)),
      },
      tabGroups: api.tabGroups
        ? {
            ...api.tabGroups,
            query: promisify(api.tabGroups.query.bind(api.tabGroups)),
            get: promisify(api.tabGroups.get.bind(api.tabGroups)),
            update: promisify(api.tabGroups.update.bind(api.tabGroups)),
          }
        : undefined,
      windows: {
        ...api.windows,
        getCurrent: promisify(api.windows.getCurrent.bind(api.windows)),
      },
      storage: {
        ...api.storage,
        local: {
          ...api.storage.local,
          get: promisify(api.storage.local.get.bind(api.storage.local)),
          set: promisify(api.storage.local.set.bind(api.storage.local)),
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
