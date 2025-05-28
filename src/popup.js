const groupButton = document.getElementById('group');
const ungroupButton = document.getElementById('ungroup');
const generateNewColorsButton = document.getElementById('generateNewColors');
const autoGroupToggle = document.getElementById('autoGroupToggle');
const onlyApplyToNewTabsToggle = document.getElementById('onlyApplyToNewTabs');
const groupBySubDomainToggle = document.getElementById('groupBySubDomain');
const advancedToggle = document.querySelector('.advanced-toggle');
const advancedContent = document.querySelector('.advanced-content');
const preserveManualColorsToggle = document.getElementById(
  'preserveManualColors',
);

// Event listeners
groupButton.addEventListener('click', () => {
  browser.runtime.sendMessage({action: 'group'});
});

ungroupButton.addEventListener('click', () => {
  browser.runtime.sendMessage({action: 'ungroup'});
});

generateNewColorsButton.addEventListener('click', () => {
  browser.runtime.sendMessage({action: 'generateNewColors'});
});

// Initialize the toggle states when popup opens.
browser.runtime.sendMessage({action: 'getAutoGroupState'}).then(response => {
  autoGroupToggle.checked = response.enabled;
});

browser.runtime
  .sendMessage({action: 'getOnlyApplyToNewTabs'})
  .then(response => {
    onlyApplyToNewTabsToggle.checked = response.enabled;
  });

browser.runtime.sendMessage({action: 'getGroupBySubDomain'}, response => {
  if (response && response.enabled !== undefined) {
    groupBySubDomainToggle.checked = response.enabled;
  }
});

browser.runtime
  .sendMessage({action: 'getPreserveManualColors'})
  .then(response => {
    preserveManualColorsToggle.checked = response.enabled;
  });

// Advanced section toggle.
advancedToggle.addEventListener('click', () => {
  advancedToggle.classList.toggle('open');
  advancedContent.classList.toggle('open');
});

// Listen for toggle changes.
autoGroupToggle.addEventListener('change', event => {
  browser.runtime.sendMessage({
    action: 'toggleAutoGroup',
    enabled: event.target.checked,
  });
});

onlyApplyToNewTabsToggle.addEventListener('change', event => {
  browser.runtime.sendMessage({
    action: 'toggleOnlyNewTabs',
    enabled: event.target.checked,
  });
});

groupBySubDomainToggle.addEventListener('change', () => {
  const enabled = groupBySubDomainToggle.checked;
  browser.runtime.sendMessage({
    action: 'toggleGroupBySubDomain',
    enabled: enabled,
  });
});

preserveManualColorsToggle.addEventListener('change', event => {
  browser.runtime.sendMessage({
    action: 'togglePreserveManualColors',
    enabled: event.target.checked,
  });
});
