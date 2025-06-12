// Chrome-compatible popup script
const groupButton = document.getElementById('group');
const ungroupButton = document.getElementById('ungroup');
const generateNewColorsButton = document.getElementById('generateNewColors');
const collapseOrExpandAllText = document.getElementById(
  'collapseOrExpandAllText',
);
const toggleCollapse = document.getElementById('toggleCollapse');
const autoGroupToggle = document.getElementById('autoGroupToggle');
const onlyApplyToNewTabsToggle = document.getElementById('onlyApplyToNewTabs');
const groupBySubDomainToggle = document.getElementById('groupBySubDomain');
const advancedToggle = document.querySelector('.advanced-toggle');
const advancedContent = document.querySelector('.advanced-content');
const preserveManualColorsToggle = document.getElementById(
  'preserveManualColors',
);

// Browser API compatibility - use chrome for Chrome, browser for Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const updateVersionDisplay = () => {
  // Get the version number from the manifest and display it.
  const versionNumberElement = document.getElementById('versionNumber');
  const manifest = browserAPI.runtime.getManifest();
  console.log(manifest);
  versionNumberElement.textContent = manifest.version;
};

// Function to update collapse button text based on state
async function updateCollapseButtonText() {
  const response = await new Promise((resolve) => {
    browserAPI.runtime.sendMessage({
      action: 'getGroupsCollapseState',
    }, resolve);
  });
  const isCollapsed = response.isCollapsed;
  collapseOrExpandAllText.textContent = isCollapsed
    ? '➕ Expand all'
    : '➖ Collapse all groups';
}

updateVersionDisplay();

// Helper function for sending messages (Chrome compatibility)
function sendMessage(message) {
  return new Promise((resolve) => {
    browserAPI.runtime.sendMessage(message, resolve);
  });
}

// Event listeners
groupButton.addEventListener('click', () => {
  sendMessage({action: 'group'});
});

ungroupButton.addEventListener('click', () => {
  sendMessage({action: 'ungroup'});
});

generateNewColorsButton.addEventListener('click', () => {
  sendMessage({action: 'generateNewColors'});
});

toggleCollapse.addEventListener('click', async () => {
  const response = await sendMessage({
    action: 'getGroupsCollapseState',
  });
  const shouldCollapse = !response.isCollapsed;
  await sendMessage({
    action: 'toggleCollapse',
    collapse: shouldCollapse,
  });
  updateCollapseButtonText();
});

// Initialize button states
updateCollapseButtonText();

// Initialize the toggle states when popup opens.
sendMessage({action: 'getAutoGroupState'}).then(response => {
  autoGroupToggle.checked = response.enabled;
});

sendMessage({action: 'getOnlyApplyToNewTabs'}).then(response => {
  onlyApplyToNewTabsToggle.checked = response.enabled;
});

sendMessage({action: 'getGroupBySubDomain'}).then(response => {
  if (response && response.enabled !== undefined) {
    groupBySubDomainToggle.checked = response.enabled;
  }
});

sendMessage({action: 'getPreserveManualColors'}).then(response => {
  preserveManualColorsToggle.checked = response.enabled;
});

// Advanced section toggle.
advancedToggle.addEventListener('click', () => {
  advancedToggle.classList.toggle('open');
  advancedContent.classList.toggle('open');
});

// Listen for toggle changes.
autoGroupToggle.addEventListener('change', event => {
  sendMessage({
    action: 'toggleAutoGroup',
    enabled: event.target.checked,
  });
});

onlyApplyToNewTabsToggle.addEventListener('change', event => {
  sendMessage({
    action: 'toggleOnlyNewTabs',
    enabled: event.target.checked,
  });
});

groupBySubDomainToggle.addEventListener('change', () => {
  const enabled = groupBySubDomainToggle.checked;
  sendMessage({
    action: 'toggleGroupBySubDomain',
    enabled: enabled,
  });
});

preserveManualColorsToggle.addEventListener('change', event => {
  sendMessage({
    action: 'togglePreserveManualColors',
    enabled: event.target.checked,
  });
});
