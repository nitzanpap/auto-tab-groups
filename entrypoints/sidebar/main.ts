// Sidebar shares the same logic and styles as popup
import '../popup/style.css';
import type { CustomRule } from '../../types';

// DOM Elements
const groupButton = document.getElementById('group') as HTMLButtonElement;
const ungroupButton = document.getElementById('ungroup') as HTMLButtonElement;
const generateNewColorsButton = document.getElementById('generateNewColors') as HTMLButtonElement;
const collapseAllButton = document.getElementById('collapseAllButton') as HTMLButtonElement;
const expandAllButton = document.getElementById('expandAllButton') as HTMLButtonElement;
const autoGroupToggle = document.getElementById('autoGroupToggle') as HTMLInputElement;
const groupNewTabsToggle = document.getElementById('groupNewTabsToggle') as HTMLInputElement;
const groupByToggleOptions = document.querySelectorAll<HTMLButtonElement>('.toggle-option');
const minimumTabsInput = document.getElementById('minimumTabsInput') as HTMLInputElement;

// Custom Rules Elements
const rulesToggle = document.querySelector('.rules-toggle') as HTMLButtonElement;
const rulesContent = document.querySelector('.rules-content') as HTMLDivElement;
const rulesCount = document.getElementById('rulesCount') as HTMLSpanElement;
const rulesList = document.getElementById('rulesList') as HTMLDivElement;
const addRuleButton = document.getElementById('addRuleButton') as HTMLButtonElement;
const exportRulesButton = document.getElementById('exportRulesButton') as HTMLButtonElement;
const importRulesButton = document.getElementById('importRulesButton') as HTMLButtonElement;
const importFileInput = document.getElementById('importFileInput') as HTMLInputElement;

// State
let customRulesExpanded = false;
let currentRules: Record<string, CustomRule> = {};

// Color mapping for display
const RULE_COLORS: Record<string, string> = {
  blue: '#4285f4',
  red: '#ea4335',
  yellow: '#fbbc04',
  green: '#34a853',
  pink: '#ff6d9d',
  purple: '#9c27b0',
  cyan: '#00acc1',
  orange: '#ff9800',
  grey: '#9aa0a6',
};

// Helper function for sending messages
function sendMessage<T = Record<string, unknown>>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve) => {
    browser.runtime.sendMessage(message, resolve);
  });
}

// Update version display
function updateVersionDisplay(): void {
  const versionNumberElement = document.getElementById('versionNumber');
  if (versionNumberElement) {
    const manifest = browser.runtime.getManifest();
    versionNumberElement.textContent = manifest.version;
  }
}

// Update browser display
function updateBrowserDisplay(): void {
  const browserNameElement = document.getElementById('browserName');
  const browserEmojiElement = document.getElementById('browserEmoji');

  if (!browserNameElement || !browserEmojiElement) return;

  // Check if Firefox
  const isFirefox = navigator.userAgent.includes('Firefox');
  if (isFirefox) {
    browserNameElement.textContent = 'Firefox';
    browserEmojiElement.textContent = '';
  } else {
    browserNameElement.textContent = 'Chrome';
    browserEmojiElement.textContent = '';
  }
}

// Update group by toggle UI
function updateGroupByToggle(mode: string): void {
  groupByToggleOptions.forEach((option) => {
    option.classList.remove('active');
    if (option.dataset.value === mode) {
      option.classList.add('active');
    }
  });
}

// Format domains display
function formatDomainsDisplay(domains: string[], maxLength = 40): string {
  if (!Array.isArray(domains) || domains.length === 0) {
    return 'No domains';
  }

  if (domains.length === 1) {
    return domains[0];
  }

  const domainsText = domains.join(', ');

  if (domainsText.length <= maxLength) {
    return domainsText;
  }

  let truncated = '';
  let count = 0;

  for (const domain of domains) {
    if (truncated.length + domain.length + 2 <= maxLength - 10) {
      if (truncated) truncated += ', ';
      truncated += domain;
      count++;
    } else {
      break;
    }
  }

  const remaining = domains.length - count;
  return `${truncated}${remaining > 0 ? ` and ${remaining} more` : ''}`;
}

// Load and display custom rules
async function loadCustomRules(): Promise<void> {
  try {
    const response = await sendMessage<{ customRules?: Record<string, CustomRule> }>({
      action: 'getCustomRules',
    });
    if (response && response.customRules) {
      currentRules = response.customRules;
      updateRulesDisplay();
    }
  } catch (error) {
    console.error('Error loading custom rules:', error);
    showRulesError('Failed to load custom rules');
  }
}

// Update the rules display
function updateRulesDisplay(): void {
  const rulesArray = Object.values(currentRules);
  const enabledRules = rulesArray.filter((rule) => rule.enabled);

  rulesCount.textContent = `(${enabledRules.length})`;

  if (exportRulesButton) {
    exportRulesButton.disabled = rulesArray.length === 0;
    exportRulesButton.title =
      rulesArray.length === 0 ? 'No rules to export' : 'Export all rules to JSON file';
  }

  rulesList.innerHTML = '';

  if (rulesArray.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-rules';
    emptyDiv.textContent =
      'No custom rules yet. Create your first rule to group tabs by your preferences!';
    rulesList.appendChild(emptyDiv);
    return;
  }

  rulesArray.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.name.localeCompare(b.name);
  });

  rulesArray.forEach((rule) => {
    const ruleElement = createRuleElement(rule);
    rulesList.appendChild(ruleElement);
  });
}

// Create a rule element
function createRuleElement(rule: CustomRule): HTMLDivElement {
  const ruleItem = document.createElement('div');
  ruleItem.className = `rule-item ${!rule.enabled ? 'disabled' : ''}`;

  const colorHex = RULE_COLORS[rule.color] || RULE_COLORS.blue;
  const domainsDisplay = formatDomainsDisplay(rule.domains);

  const colorIndicator = document.createElement('div');
  colorIndicator.className = 'rule-color-indicator';
  colorIndicator.style.backgroundColor = colorHex;

  const ruleInfo = document.createElement('div');
  ruleInfo.className = 'rule-info';

  const ruleName = document.createElement('div');
  ruleName.className = 'rule-name';
  ruleName.textContent = rule.name;

  const ruleDomains = document.createElement('div');
  ruleDomains.className = 'rule-domains';
  ruleDomains.textContent = domainsDisplay;

  ruleInfo.appendChild(ruleName);
  ruleInfo.appendChild(ruleDomains);

  const ruleActions = document.createElement('div');
  ruleActions.className = 'rule-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'rule-action-btn edit';
  editBtn.title = 'Edit rule';
  editBtn.setAttribute('data-rule-id', rule.id);
  editBtn.textContent = 'Edit';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'rule-action-btn delete';
  deleteBtn.title = 'Delete rule';
  deleteBtn.setAttribute('data-rule-id', rule.id);
  deleteBtn.textContent = 'Delete';

  ruleActions.appendChild(editBtn);
  ruleActions.appendChild(deleteBtn);

  ruleItem.appendChild(colorIndicator);
  ruleItem.appendChild(ruleInfo);
  ruleItem.appendChild(ruleActions);

  editBtn.addEventListener('click', () => editRule(rule.id));
  deleteBtn.addEventListener('click', () => deleteRule(rule.id, rule.name));

  return ruleItem;
}

// Show rules error
function showRulesError(message: string): void {
  rulesList.innerHTML = '';
  const errorDiv = document.createElement('div');
  errorDiv.className = 'rules-error';
  errorDiv.textContent = message;
  rulesList.appendChild(errorDiv);
}

// Show rules message
function showRulesMessage(message: string, type = 'info'): void {
  const messageDiv = document.createElement('div');
  messageDiv.className = `rules-message ${type}`;
  messageDiv.textContent = message;
  rulesList.insertBefore(messageDiv, rulesList.firstChild);
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 3000);
}

// Toggle rules section
function toggleRulesSection(): void {
  customRulesExpanded = !customRulesExpanded;
  rulesToggle.classList.toggle('expanded', customRulesExpanded);
  rulesContent.classList.toggle('expanded', customRulesExpanded);

  if (customRulesExpanded && Object.keys(currentRules).length === 0) {
    loadCustomRules();
  }
}

// Open add rule modal
async function addRule(): Promise<void> {
  try {
    const url = browser.runtime.getURL('/rules-modal.html');
    await browser.tabs.create({ url, active: true });
  } catch (error) {
    console.error('Error opening add rule modal:', error);
  }
}

// Open edit rule modal
async function editRule(ruleId: string): Promise<void> {
  try {
    const url = browser.runtime.getURL(`/rules-modal.html?edit=true&ruleId=${ruleId}`);
    await browser.tabs.create({ url, active: true });
  } catch (error) {
    console.error('Error opening edit rule modal:', error);
  }
}

// Delete rule
async function deleteRule(ruleId: string, ruleName: string): Promise<void> {
  if (!confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
    return;
  }

  try {
    const response = await sendMessage<{ success?: boolean; error?: string }>({
      action: 'deleteCustomRule',
      ruleId,
    });

    if (response && response.success) {
      delete currentRules[ruleId];
      updateRulesDisplay();
    } else {
      alert(response?.error || 'Failed to delete rule');
    }
  } catch (error) {
    console.error('Error deleting rule:', error);
    alert('Failed to delete rule');
  }
}

// Export rules
async function exportRules(): Promise<void> {
  try {
    const response = await sendMessage<{ success?: boolean; data?: string; error?: string }>({
      action: 'exportRules',
    });

    if (response && response.success && response.data) {
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auto-tab-groups-rules-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showRulesMessage('Rules exported successfully!', 'success');
    } else {
      alert(response?.error || 'Failed to export rules');
    }
  } catch (error) {
    console.error('Error exporting rules:', error);
    alert('Failed to export rules');
  }
}

// Import rules
async function importRules(): Promise<void> {
  importFileInput.click();
}

// Handle file import
async function handleFileImport(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  target.value = '';

  try {
    const text = await file.text();

    const replaceExisting = confirm(
      'Do you want to replace all existing rules?\n\n' +
        'Click OK to REPLACE all existing rules with imported ones\n' +
        'Click Cancel to MERGE imported rules with existing ones'
    );

    const response = await sendMessage<{
      success?: boolean;
      imported?: number;
      skipped?: number;
      validationErrors?: string[];
      error?: string;
    }>({
      action: 'importRules',
      jsonData: text,
      replaceExisting,
    });

    if (response && response.success) {
      await loadCustomRules();

      const message =
        `Import successful!\n` +
        `Imported: ${response.imported} rules\n` +
        `Skipped: ${response.skipped} rules`;

      showRulesMessage('Rules imported successfully!', 'success');
      alert(message);
    } else {
      alert(response?.error || 'Failed to import rules');
    }
  } catch (error) {
    console.error('Error importing rules:', error);
    alert('Failed to import rules: ' + (error as Error).message);
  }
}

// Initialize
updateVersionDisplay();
updateBrowserDisplay();

// Button event listeners
groupButton.addEventListener('click', () => sendMessage({ action: 'group' }));
ungroupButton.addEventListener('click', () => sendMessage({ action: 'ungroup' }));
generateNewColorsButton.addEventListener('click', () => sendMessage({ action: 'generateNewColors' }));
collapseAllButton.addEventListener('click', () => sendMessage({ action: 'collapseAll' }));
expandAllButton.addEventListener('click', () => sendMessage({ action: 'expandAll' }));

// Initialize toggle states
sendMessage<{ enabled?: boolean }>({ action: 'getAutoGroupState' }).then((response) => {
  if (response?.enabled !== undefined) {
    autoGroupToggle.checked = response.enabled;
  }
});

sendMessage<{ enabled?: boolean }>({ action: 'getGroupNewTabsState' }).then((response) => {
  if (response?.enabled !== undefined) {
    groupNewTabsToggle.checked = response.enabled;
  }
});

sendMessage<{ mode?: string }>({ action: 'getGroupByMode' }).then((response) => {
  if (response?.mode) {
    updateGroupByToggle(response.mode);
  }
});

sendMessage<{ minimumTabs?: number }>({ action: 'getMinimumTabsForGroup' }).then((response) => {
  minimumTabsInput.value = String(response?.minimumTabs || 1);
});

// Toggle event listeners
autoGroupToggle.addEventListener('change', (event) => {
  sendMessage({
    action: 'toggleAutoGroup',
    enabled: (event.target as HTMLInputElement).checked,
  });
});

groupNewTabsToggle.addEventListener('change', (event) => {
  sendMessage({
    action: 'toggleGroupNewTabs',
    enabled: (event.target as HTMLInputElement).checked,
  });
});

// Group by toggle event listeners
groupByToggleOptions.forEach((option) => {
  option.addEventListener('click', () => {
    const mode = option.dataset.value;
    if (mode) {
      updateGroupByToggle(mode);
      sendMessage({ action: 'setGroupByMode', mode });
    }
  });
});

// Minimum tabs input event listener
minimumTabsInput.addEventListener('change', (event) => {
  const value = parseInt((event.target as HTMLInputElement).value) || 1;
  const clampedValue = Math.max(1, Math.min(10, value));
  (event.target as HTMLInputElement).value = String(clampedValue);
  sendMessage({ action: 'setMinimumTabsForGroup', minimumTabs: clampedValue });
});

// Custom Rules event listeners
rulesToggle?.addEventListener('click', toggleRulesSection);
addRuleButton?.addEventListener('click', addRule);
exportRulesButton?.addEventListener('click', exportRules);
importRulesButton?.addEventListener('click', importRules);
importFileInput?.addEventListener('change', handleFileImport);

// Load custom rules on sidebar open
loadCustomRules();
