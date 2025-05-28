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
}

export const storageManager = new StorageManager();
