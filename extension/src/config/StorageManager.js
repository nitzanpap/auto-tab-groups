/**
 * Manages browser storage operations
 */

import { tabGroupState } from "../state/TabGroupState.js"
import "../utils/BrowserAPI.js" // Import browser compatibility layer

// Access the unified browser API
const browserAPI = globalThis.browserAPI || (typeof browser !== "undefined" ? browser : chrome)

export const DEFAULT_STATE = {
  autoGroupingEnabled: true,
  groupBySubDomainEnabled: false,
  customRules: {},
  ruleMatchingMode: "exact",
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

  /**
   * Gets custom rules from storage
   * @returns {Promise<Object>} Custom rules object
   */
  async getCustomRules() {
    try {
      const data = await browserAPI.storage.local.get(["customRules"])
      return data.customRules || {}
    } catch (error) {
      console.error("Error loading custom rules:", error)
      return {}
    }
  }

  /**
   * Saves custom rules to storage
   * @param {Object} customRules - Custom rules object
   */
  async saveCustomRules(customRules) {
    try {
      await browserAPI.storage.local.set({ customRules })
      console.log("Custom rules saved successfully")
    } catch (error) {
      console.error("Error saving custom rules:", error)
    }
  }

  /**
   * Gets rule matching mode from storage
   * @returns {Promise<string>} Rule matching mode
   */
  async getRuleMatchingMode() {
    try {
      const data = await browserAPI.storage.local.get(["ruleMatchingMode"])
      return data.ruleMatchingMode || "exact"
    } catch (error) {
      console.error("Error loading rule matching mode:", error)
      return "exact"
    }
  }

  /**
   * Saves rule matching mode to storage
   * @param {string} mode - Rule matching mode ('exact', 'contains', 'regex')
   */
  async saveRuleMatchingMode(mode) {
    try {
      await browserAPI.storage.local.set({ ruleMatchingMode: mode })
      console.log("Rule matching mode saved successfully")
    } catch (error) {
      console.error("Error saving rule matching mode:", error)
    }
  }
}

export const storageManager = new StorageManager()
