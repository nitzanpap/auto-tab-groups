/**
 * Manages the state of tab groups and their configurations
 */

class TabGroupState {
  constructor() {
    this.domainGroups = new Map();
    this.domainColors = new Map();
    this.autoGroupingEnabled = true;
    this.onlyApplyToNewTabsEnabled = false;
    this.groupBySubDomainEnabled = false;
  }

  /**
   * Gets the group ID for a domain
   * @param {string} domain
   * @returns {number|undefined}
   */
  getGroupId(domain) {
    return this.domainGroups.get(domain);
  }

  /**
   * Sets the group ID for a domain
   * @param {string} domain
   * @param {number} groupId
   */
  setGroupId(domain, groupId) {
    this.domainGroups.set(domain, groupId);
  }

  /**
   * Removes a domain's group mapping
   * @param {string} domain
   */
  removeDomain(domain) {
    this.domainGroups.delete(domain);
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
   * Clears all group mappings
   */
  clearGroups() {
    this.domainGroups.clear();
  }

  /**
   * Gets all domain to group mappings
   * @returns {Array} Array of [domain, groupId] pairs
   */
  getDomainGroups() {
    return [...this.domainGroups.entries()];
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
