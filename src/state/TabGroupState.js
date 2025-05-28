/**
 * Manages the state of tab groups and their configurations
 */

class TabGroupState {
  constructor() {
    this.domainColors = new Map();
    this.autoGroupingEnabled = true;
    this.onlyApplyToNewTabsEnabled = false;
    this.groupBySubDomainEnabled = false;
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
   */
  setColor(domain, color) {
    this.domainColors.set(domain, color);
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
    this.autoGroupingEnabled = data.autoGroupingEnabled ?? true;
    this.onlyApplyToNewTabsEnabled = data.onlyApplyToNewTabsEnabled ?? false;
    this.groupBySubDomainEnabled = data.groupBySubDomainEnabled ?? true;

    this.domainColors.clear();
    if (data.domainColors) {
      Object.entries(data.domainColors).forEach(([domain, color]) => {
        this.domainColors.set(domain, color);
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
      domainColors: Object.fromEntries(this.domainColors),
    };
  }
}

export const tabGroupState = new TabGroupState();
