/**
 * Service for managing browser tab groups
 */

import {tabGroupState} from '../state/TabGroupState.js';
import {extractDomain} from '../utils/DomainUtils.js';
import {storageManager} from '../config/StorageManager.js';

class TabGroupService {
  /**
   * Gets the domain of a group by looking at its first tab
   * @param {number} groupId
   * @returns {Promise<string|null>} The domain of the group or null if no tabs found
   */
  async getGroupDomain(groupId) {
    try {
      const tabs = await browser.tabs.query({groupId});
      if (tabs.length === 0) return null;

      const firstTab = tabs[0];
      return extractDomain(firstTab.url, tabGroupState.groupBySubDomainEnabled);
    } catch (error) {
      console.error(
        `[getGroupDomain] Error getting domain for group ${groupId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Creates a new tab group for a domain
   * @param {string} domain
   * @param {number[]} tabIds
   */
  async createGroup(domain, tabIds) {
    if (tabIds.length === 0) return;

    try {
      console.log(
        `[createGroup] Creating new group for domain "${domain}" with tabs:`,
        tabIds,
      );
      const groupId = await browser.tabs.group({tabIds});
      console.log(
        `[createGroup] Created group with ID ${groupId} for domain "${domain}"`,
      );

      if (browser.tabGroups) {
        await this.setGroupTitleAndColor(groupId, domain);
        await this.handleGroupColorAssignment(groupId, domain);
      } else {
        console.log(
          '[createGroup] tabGroups API not available in this browser version',
        );
      }
    } catch (error) {
      console.error('[createGroup] Error creating group:', error);
    }
  }

  /**
   * Sets the title and color for a tab group
   * @param {number} groupId
   * @param {string} domain
   */
  async setGroupTitleAndColor(groupId, domain) {
    if (!groupId) return;

    try {
      console.log(
        `[setGroupTitleAndColor] Setting title "${domain}" for group ${groupId}`,
      );
      const groupInfo = await browser.tabGroups.get(groupId);
      const updateProperties = {
        title: domain ?? groupInfo.title,
      };

      if (domain && tabGroupState.getColor(domain)) {
        updateProperties.color = tabGroupState.getColor(domain);
        console.log(
          `[setGroupTitleAndColor] Also setting color "${updateProperties.color}" for group ${groupId}`,
        );
      }

      await browser.tabGroups.update(groupId, updateProperties);
    } catch (error) {
      console.error(
        '[setGroupTitleAndColor] Error setting group title/color:',
        error,
      );
    }
  }

  /**
   * Handles color assignment for a new group
   * @param {number} groupId
   * @param {string} domain
   */
  async handleGroupColorAssignment(groupId, domain) {
    try {
      const groupInfo = await browser.tabGroups.get(groupId);
      if (!tabGroupState.getColor(domain)) {
        tabGroupState.setColor(domain, groupInfo.color);
        await storageManager.saveState();
      }

      if (
        tabGroupState.getColor(domain) !== groupInfo.color ||
        groupInfo.title !== domain
      ) {
        await this.setGroupTitleAndColor(groupId, domain);
      }
    } catch (error) {
      console.error('Error handling group color assignment:', error);
    }
  }

  /**
   * Groups all tabs in the current window by domain
   */
  async groupTabsByDomain() {
    try {
      console.log('[groupTabsByDomain] Starting to group all tabs by domain');
      const tabs = await browser.tabs.query({currentWindow: true});
      console.log('[groupTabsByDomain] Found tabs:', tabs);
      const domainTabsMap = new Map();

      // Group tabs by domain
      for (const tab of tabs) {
        if (!tab.url) continue;
        const domain = extractDomain(
          tab.url,
          tabGroupState.groupBySubDomainEnabled,
        );
        if (!domain) continue;

        if (!domainTabsMap.has(domain)) {
          domainTabsMap.set(domain, []);
        }
        domainTabsMap.get(domain).push(tab.id);
      }

      console.log(
        '[groupTabsByDomain] Grouped tabs by domain:',
        Object.fromEntries(domainTabsMap),
      );

      // Get existing groups
      const existingGroups = await browser.tabGroups.query({
        windowId: tabs[0].windowId,
      });
      console.log('[groupTabsByDomain] Existing groups:', existingGroups);

      // Process each domain
      for (const [domain, tabIds] of domainTabsMap.entries()) {
        // Find a matching group by checking the domain of its first tab
        let matchingGroup = null;
        for (const group of existingGroups) {
          const groupDomain = await this.getGroupDomain(group.id);
          if (groupDomain === domain) {
            matchingGroup = group;
            break;
          }
        }

        if (matchingGroup) {
          console.log(
            `[groupTabsByDomain] Adding tabs to existing group for "${domain}":`,
            tabIds,
          );
          await browser.tabs.group({
            tabIds,
            groupId: matchingGroup.id,
          });
        } else {
          console.log(
            `[groupTabsByDomain] Creating new group for "${domain}":`,
            tabIds,
          );
          await this.createGroup(domain, tabIds);
        }
      }

      console.log('[groupTabsByDomain] Tab grouping complete');
    } catch (error) {
      console.error('[groupTabsByDomain] Error grouping tabs:', error);
    }
  }

  /**
   * Ungroups all tabs in the current window
   */
  async ungroupAllTabs() {
    try {
      const tabs = await browser.tabs.query({currentWindow: true});
      for (const tab of tabs) {
        try {
          await browser.tabs.ungroup(tab.id);
        } catch (error) {
          console.error(`Error ungrouping tab ${tab.id}:`, error);
        }
      }
      console.log('All tabs ungrouped');
    } catch (error) {
      console.error('Error ungrouping tabs:', error);
    }
  }

  /**
   * Moves a tab to its appropriate group based on domain
   * @param {number} tabId
   */
  async moveTabToGroup(tabId) {
    if (!tabGroupState.autoGroupingEnabled) return;

    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab.url) return;

      const domain = extractDomain(
        tab.url,
        tabGroupState.groupBySubDomainEnabled,
      );
      if (!domain) return;

      console.log(
        `[moveTabToGroup] Processing tab ${tabId} with URL "${tab.url}" and domain "${domain}"`,
      );

      // Look for an existing group with matching domain
      const groups = await browser.tabGroups.query({windowId: tab.windowId});
      console.log(`[moveTabToGroup] Existing groups in window:`, groups);

      let matchingGroup = null;
      for (const group of groups) {
        const groupDomain = await this.getGroupDomain(group.id);
        if (groupDomain === domain) {
          matchingGroup = group;
          break;
        }
      }

      if (matchingGroup) {
        console.log(
          `[moveTabToGroup] Found existing group for "${domain}":`,
          matchingGroup,
        );
        await browser.tabs.group({
          tabIds: [tabId],
          groupId: matchingGroup.id,
        });
      } else {
        console.log(
          `[moveTabToGroup] Creating new group for "${domain}" with tab ${tabId}`,
        );
        await this.createGroup(domain, [tabId]);
      }
    } catch (error) {
      console.error('[moveTabToGroup] Error moving tab to group:', error);
    }
  }

  /**
   * Removes a group if it's empty
   * @param {number} groupId
   */
  async removeEmptyGroup(groupId) {
    try {
      const tabs = await browser.tabs.query({groupId});
      if (tabs.length === 0) {
        console.log(`[removeEmptyGroup] Removing empty group ${groupId}`);
      }
    } catch (error) {
      console.error(
        `[removeEmptyGroup] Error checking empty group ${groupId}:`,
        error,
      );
    }
  }
}

export const tabGroupService = new TabGroupService();
