/**
 * Main background script for the extension
 */

import {tabGroupState} from './state/TabGroupState.js';
import {tabGroupService} from './services/TabGroupService.js';
import {storageManager} from './config/StorageManager.js';

// Initialize state when the extension loads
storageManager.loadState();

// Message handler for popup communication
browser.runtime.onMessage.addListener(async msg => {
  switch (msg.action) {
    case 'group':
      await tabGroupService.groupTabsByDomain();
      return {success: true};

    case 'ungroup':
      await tabGroupService.ungroupAllTabs();
      return {success: true};

    case 'generateNewColors':
      await tabGroupService.generateNewColors();
      return {success: true};

    case 'getAutoGroupState':
      return {enabled: tabGroupState.autoGroupingEnabled};

    case 'getOnlyApplyToNewTabs':
      return {enabled: tabGroupState.onlyApplyToNewTabsEnabled};

    case 'getPreserveManualColors':
      return {enabled: tabGroupState.preserveManualColors};

    case 'toggleAutoGroup':
      tabGroupState.autoGroupingEnabled = msg.enabled;
      await storageManager.saveState();

      if (
        tabGroupState.autoGroupingEnabled &&
        !tabGroupState.onlyApplyToNewTabsEnabled
      ) {
        await tabGroupService.groupTabsByDomain();
      }
      return {enabled: tabGroupState.autoGroupingEnabled};

    case 'toggleOnlyNewTabs':
      tabGroupState.onlyApplyToNewTabsEnabled = msg.enabled;
      await storageManager.saveState();
      return {enabled: tabGroupState.onlyApplyToNewTabsEnabled};

    case 'togglePreserveManualColors':
      tabGroupState.preserveManualColors = msg.enabled;
      await storageManager.saveState();
      return {enabled: tabGroupState.preserveManualColors};

    case 'getGroupBySubDomain':
      return {enabled: tabGroupState.groupBySubDomainEnabled};

    case 'toggleGroupBySubDomain':
      tabGroupState.groupBySubDomainEnabled = msg.enabled;
      await storageManager.saveState();

      if (
        tabGroupState.autoGroupingEnabled &&
        !tabGroupState.onlyApplyToNewTabsEnabled
      ) {
        await tabGroupService.ungroupAllTabs();
        await tabGroupService.groupTabsByDomain();
      }
      return {enabled: tabGroupState.groupBySubDomainEnabled};
  }
});

// Tab event listeners
browser.tabs.onUpdated.addListener(
  (tabId, changeInfo) => {
    if (changeInfo.url) {
      tabGroupService.moveTabToGroup(tabId);
    }
  },
  {properties: ['url']},
);

browser.tabs.onCreated.addListener(tab => {
  if (tab.url) {
    tabGroupService.moveTabToGroup(tab.id);
  }
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (removeInfo.groupId) {
    tabGroupService.removeEmptyGroup(removeInfo.groupId);
  }
});

browser.tabs.onMoved.addListener(tabId => {
  tabGroupService.moveTabToGroup(tabId);
});

// Listen for tab group updates (including color changes)
browser.tabGroups.onUpdated.addListener(async group => {
  try {
    const domain = await tabGroupService.getGroupDomain(group.id);
    if (!domain) return;

    // If the color has changed and it's different from our stored color
    if (group.color && group.color !== tabGroupState.getColor(domain)) {
      console.log(
        `[tabGroups.onUpdated] User changed color for domain "${domain}" to "${group.color}"`,
      );
      tabGroupState.setColor(domain, group.color, true);
      await storageManager.saveState();
    }
  } catch (error) {
    console.error('[tabGroups.onUpdated] Error handling group update:', error);
  }
});
