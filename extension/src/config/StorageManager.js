/**
 * Manages browser storage operations
 */

import {tabGroupState} from '../state/TabGroupState.js';

class StorageManager {
  /**
   * Saves the current state to browser storage
   */
  async saveState() {
    try {
      await browser.storage.local.set(tabGroupState.getStorageData());
      console.log('State saved successfully');
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  /**
   * Loads state from browser storage
   */
  async loadState() {
    try {
      const data = await browser.storage.local.get({
        autoGroupingEnabled: true,
        onlyApplyToNewTabsEnabled: false,
        groupBySubDomainEnabled: true,
        domainColors: {},
      });

      tabGroupState.updateFromStorage(data);
      console.log('State loaded successfully:', data);
      return data;
    } catch (error) {
      console.error('Error loading state:', error);
      return null;
    }
  }

  /**
   * Gets a value from browser storage
   * @param {string} key - The key to get
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {Promise<any>} The value from storage or default
   */
  async get(key, defaultValue = null) {
    try {
      const result = await browser.storage.local.get(key);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error(`Error getting ${key} from storage:`, error);
      return defaultValue;
    }
  }

  /**
   * Sets a value in browser storage
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value) {
    try {
      await browser.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error(`Error setting ${key} in storage:`, error);
      return false;
    }
  }
}

export const storageManager = new StorageManager();
