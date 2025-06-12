/**
 * Manages the state of tab groups and their configurations
 */

import {DEFAULT_STATE} from '../config/StorageManager.js';

class TabGroupState {
  constructor() {
    this.domainColors = new Map();
    this.autoGroupingEnabled = DEFAULT_STATE.autoGroupingEnabled;
    this.onlyApplyToNewTabsEnabled = DEFAULT_STATE.onlyApplyToNewTabsEnabled;
    this.groupBySubDomainEnabled = DEFAULT_STATE.groupBySubDomainEnabled;
    this.preserveManualColors = DEFAULT_STATE.preserveManualColors;
    this.manuallySetColors = new Set();
  }

  /**
   * Gets the color for a domain
   * @param {string} domain
   * @returns {string|undefined}
   */
  getColor(domain) {
    return this.domainColors.get(domain);
  }

  /**
   * Sets the color for a domain
   * @param {string} domain
   * @param {string} color
   * @param {boolean} isManualSet - Whether this color was set manually by the user
   */
  setColor(domain, color, isManualSet = false) {
    this.domainColors.set(domain, color);
    if (isManualSet) {
      this.manuallySetColors.add(domain);
    }
  }

  /**
   * Gets all domain to color mappings
   * @returns {Array} Array of [domain, color] pairs
   */
  getDomainColors() {
    return [...this.domainColors.entries()];
  }

  /**
   * Updates state from storage data
   * @param {Object} data
   */
  updateFromStorage(data) {
    this.autoGroupingEnabled = data.autoGroupingEnabled;
    this.onlyApplyToNewTabsEnabled = data.onlyApplyToNewTabsEnabled;
    this.groupBySubDomainEnabled = data.groupBySubDomainEnabled;
    this.preserveManualColors = data.preserveManualColors;

    this.domainColors.clear();
    this.manuallySetColors.clear();
    if (data.domainColors) {
      Object.entries(data.domainColors).forEach(([domain, color]) => {
        this.domainColors.set(domain, color);
      });
    }
    if (data.manuallySetColors) {
      data.manuallySetColors.forEach(domain => {
        this.manuallySetColors.add(domain);
      });
    }
  }

  /**
   * Gets data for storage
   * @returns {Object}
   */
  getStorageData() {
    return {
      autoGroupingEnabled: this.autoGroupingEnabled,
      onlyApplyToNewTabsEnabled: this.onlyApplyToNewTabsEnabled,
      groupBySubDomainEnabled: this.groupBySubDomainEnabled,
      preserveManualColors: this.preserveManualColors,
      domainColors: Object.fromEntries(this.domainColors),
      manuallySetColors: Array.from(this.manuallySetColors),
    };
  }
}

export const tabGroupState = new TabGroupState();
