/**
 * Manages browser storage operations
 */

import { tabGroupState } from "../state/TabGroupState.js"
import "../utils/BrowserAPI.js" // Import browser compatibility layer

// Access the unified browser API
const browserAPI = globalThis.browserAPI || (typeof browser !== "undefined" ? browser : chrome)

export const DEFAULT_STATE = {
  autoGroupingEnabled: true,
  onlyApplyToNewTabsEnabled: false,
  groupBySubDomainEnabled: false,
  preserveManualColors: false,
  domainColors: {},
  manuallySetColors: [],
}

class StorageManager {
  /**
   * Saves the current state to browser storage
   */
  async saveState() {
    try {
      await browserAPI.storage.local.set(tabGroupState.getStorageData())
      console.log("State saved successfully")
    } catch (error) {
      console.error("Error saving state:", error)
    }
  }

  /**
   * Loads state from browser storage
   */
  async loadState() {
    try {
      // Get keys from DEFAULT_STATE to retrieve stored values
      const keys = Object.keys(DEFAULT_STATE)
      const data = await browserAPI.storage.local.get(keys)

      // Merge with defaults for missing keys
      const mergedData = { ...DEFAULT_STATE, ...data }

      tabGroupState.updateFromStorage(mergedData)
      console.log("State loaded successfully:", mergedData)
      return mergedData
    } catch (error) {
      console.error("Error loading state:", error)
      return null
    }
  }
}

export const storageManager = new StorageManager()
