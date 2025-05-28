/**
 * Service for managing browser tab groups
 */

import {tabGroupState} from '../state/TabGroupState.js';
import {extractDomain} from '../utils/DomainUtils.js';
import {storageManager} from '../config/StorageManager.js';

class TabGroupService {
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
      tabGroupState.setGroupId(domain, groupId);

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

      // Create tab groups for each domain
      for (const [domain, tabIds] of domainTabsMap.entries()) {
        console.log(
          `[groupTabsByDomain] Creating/updating group for domain "${domain}" with tabs:`,
          tabIds,
        );
        await this.createGroup(domain, tabIds);
      }

      console.log('[groupTabsByDomain] Tab grouping complete:', {
        domainGroups: tabGroupState.getDomainGroups(),
        domainColors: tabGroupState.getDomainColors(),
      });
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

      tabGroupState.clearGroups();
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

      // First check our stored mapping
      const existingGroupId = tabGroupState.getGroupId(domain);
      console.log(
        `[moveTabToGroup] Stored group ID for domain "${domain}":`,
        existingGroupId,
      );
      let targetGroupId = null;

      // If we have a stored group ID, verify it still exists
      if (existingGroupId) {
        const group = await browser.tabGroups.get(existingGroupId);
        if (group) {
          console.log(`[moveTabToGroup] Found existing group:`, group);
          targetGroupId = existingGroupId;
        } else {
          console.log(
            `[moveTabToGroup] Stored group ${existingGroupId} no longer exists, removing from state`,
          );
          tabGroupState.removeDomain(domain);
          await storageManager.saveState();
        }
      }

      // If we don't have a valid stored group, look for an existing group with matching title
      if (!targetGroupId) {
        const groups = await browser.tabGroups.query({windowId: tab.windowId});
        console.log(
          `[moveTabToGroup] Searching among existing groups:`,
          groups,
        );
        const matchingGroup = groups.find(group => group.title === domain);
        if (matchingGroup) {
          targetGroupId = matchingGroup.id;
          console.log(
            `[moveTabToGroup] Found matching group by title:`,
            matchingGroup,
          );
          // Update our state with the found group
          tabGroupState.setGroupId(domain, targetGroupId);
          await storageManager.saveState();
        }
      }

      if (targetGroupId) {
        console.log(
          `[moveTabToGroup] Moving tab ${tabId} to existing group ${targetGroupId}`,
        );
        await browser.tabs.group({
          tabIds: [tabId],
          groupId: targetGroupId,
        });
      } else {
        console.log(
          `[moveTabToGroup] No existing group found, creating new group for tab ${tabId}`,
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
        const domainGroups = tabGroupState.getDomainGroups();
        for (const [domain, id] of domainGroups) {
          if (id === groupId) {
            tabGroupState.removeDomain(domain);
            break;
          }
        }
      }
    } catch (error) {
      console.error(`Error checking empty group ${groupId}:`, error);
    }
  }
}

export const tabGroupService = new TabGroupService();
