const groupButton = document.getElementById('group');
const ungroupButton = document.getElementById('ungroup');
const autoGroupToggle = document.getElementById('autoGroupToggle');
const onlyApplyToNewTabsToggle = document.getElementById('onlyApplyToNewTabs');
const groupBySubDomainToggle = document.getElementById('groupBySubDomain');
const advancedToggle = document.querySelector('.advanced-toggle');
const advancedContent = document.querySelector('.advanced-content');

// Event listeners
groupButton.addEventListener('click', () => {
  browser.runtime.sendMessage({action: 'group'});
});

ungroupButton.addEventListener('click', () => {
  browser.runtime.sendMessage({action: 'ungroup'});
});

// Initialize the toggle states when popup opens.
browser.runtime.sendMessage({action: 'getAutoGroupState'}, response => {
  if (response && response.enabled !== undefined) {
    autoGroupToggle.checked = response.enabled;
  }
});

browser.runtime.sendMessage({action: 'getOnlyApplyToNewTabs'}, response => {
  if (response && response.enabled !== undefined) {
    onlyApplyToNewTabsToggle.checked = response.enabled;
  }
});

browser.runtime.sendMessage({action: 'getGroupBySubDomain'}, response => {
  if (response && response.enabled !== undefined) {
    groupBySubDomainToggle.checked = response.enabled;
  }
});

// Advanced section toggle.
advancedToggle.addEventListener('click', () => {
  advancedToggle.classList.toggle('open');
  advancedContent.classList.toggle('open');
});

// Listen for toggle changes.
autoGroupToggle.addEventListener('change', () => {
  const enabled = autoGroupToggle.checked;
  browser.runtime.sendMessage({
    action: 'toggleAutoGroup',
    enabled: enabled,
  });
});

onlyApplyToNewTabsToggle.addEventListener('change', () => {
  const enabled = onlyApplyToNewTabsToggle.checked;
  browser.runtime.sendMessage({
    action: 'toggleOnlyNewTabs',
    enabled: enabled,
  });
});

groupBySubDomainToggle.addEventListener('change', () => {
  const enabled = groupBySubDomainToggle.checked;
  browser.runtime.sendMessage({
    action: 'toggleGroupBySubDomain',
    enabled: enabled,
  });
});
