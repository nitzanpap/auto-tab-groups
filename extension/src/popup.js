const groupButton = document.getElementById('group');
const ungroupButton = document.getElementById('ungroup');
const groupWithAIButton = document.getElementById('groupWithAI');
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

// Function to update collapse button text based on state
async function updateCollapseButtonText() {
  const response = await browser.runtime.sendMessage({
    action: 'getGroupsCollapseState',
  });
  const isCollapsed = response.isCollapsed;
  collapseOrExpandAllText.textContent = isCollapsed
    ? '➕ Click to expand all'
    : '➖ Click to collapse all';
}

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

groupWithAIButton.addEventListener('click', async () => {
  try {
    // Show loading state
    groupWithAIButton.textContent = '🔄 Processing...';
    groupWithAIButton.disabled = true;
    
    // Call the background script to group tabs using AI
    const response = await browser.runtime.sendMessage({action: 'groupWithAI'});
    
    // Handle the response
    if (response.success) {
      groupWithAIButton.textContent = '✅ Success!';
      setTimeout(() => {
        groupWithAIButton.textContent = '🤖 Group with AI';
        groupWithAIButton.disabled = false;
      }, 2000);
    } else {
      groupWithAIButton.textContent = response.error || '❌ Failed';
      setTimeout(() => {
        groupWithAIButton.textContent = '🤖 Group with AI';
        groupWithAIButton.disabled = false;
      }, 2000);
    }
  } catch (error) {
    console.error('Error calling AI grouping:', error);
    groupWithAIButton.textContent = '❌ Error';
    setTimeout(() => {
      groupWithAIButton.textContent = '🤖 Group with AI';
      groupWithAIButton.disabled = false;
    }, 2000);
  }
});

toggleCollapse.addEventListener('click', async () => {
  const response = await browser.runtime.sendMessage({
    action: 'getGroupsCollapseState',
  });
  const shouldCollapse = !response.isCollapsed;
  await browser.runtime.sendMessage({
    action: 'toggleCollapse',
    collapse: shouldCollapse,
  });
  updateCollapseButtonText();
});

// Initialize button states
updateCollapseButtonText();

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
