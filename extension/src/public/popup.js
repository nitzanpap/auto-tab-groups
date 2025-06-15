// Chrome-compatible popup script
const groupButton = document.getElementById("group")
const ungroupButton = document.getElementById("ungroup")
const generateNewColorsButton = document.getElementById("generateNewColors")
const collapseAllButton = document.getElementById("collapseAllButton")
const expandAllButton = document.getElementById("expandAllButton")
const autoGroupToggle = document.getElementById("autoGroupToggle")
const groupBySubDomainToggle = document.getElementById("groupBySubDomain")

// Browser API compatibility - use chrome for Chrome, browser for Firefox
const browserAPI = typeof browser !== "undefined" ? browser : chrome

console.log(
  "[Popup/Sidebar] Initialized with browserAPI:",
  browserAPI ? "Available" : "Not available"
)
console.log(
  "[Popup/Sidebar] Current context:",
  document.querySelector(".sidebar-container") ? "Sidebar" : "Popup"
)

const updateVersionDisplay = () => {
  // Get the version number from the manifest and display it.
  const versionNumberElement = document.getElementById("versionNumber")
  const manifest = browserAPI.runtime.getManifest()
  console.log(manifest)
  versionNumberElement.textContent = manifest.version
}

const updateBrowserDisplay = () => {
  // Update browser name and emoji based on detected browser
  const browserNameElement = document.getElementById("browserName")
  const browserEmojiElement = document.getElementById("browserEmoji")

  // Check if elements exist (they might not be present in all contexts)
  if (!browserNameElement || !browserEmojiElement) {
    return
  }

  if (typeof browser !== "undefined") {
    // Firefox
    browserNameElement.textContent = "Firefox"
    browserEmojiElement.textContent = "🦊"
  } else {
    // Chrome
    browserNameElement.textContent = "Chrome"
    browserEmojiElement.textContent = "🟡"
  }
}

updateVersionDisplay()
updateBrowserDisplay()

// Helper function for sending messages (Chrome compatibility)
function sendMessage(message) {
  return new Promise((resolve) => {
    browserAPI.runtime.sendMessage(message, resolve)
  })
}

// Event listeners
groupButton.addEventListener("click", () => {
  sendMessage({ action: "group" })
})

ungroupButton.addEventListener("click", () => {
  sendMessage({ action: "ungroup" })
})

generateNewColorsButton.addEventListener("click", () => {
  sendMessage({ action: "generateNewColors" })
})

collapseAllButton.addEventListener("click", () => {
  sendMessage({ action: "collapseAll" })
})

expandAllButton.addEventListener("click", () => {
  sendMessage({ action: "expandAll" })
})

// Initialize the toggle states when popup opens.
sendMessage({ action: "getAutoGroupState" }).then((response) => {
  autoGroupToggle.checked = response.enabled
})

sendMessage({ action: "getGroupBySubDomain" }).then((response) => {
  if (response && response.enabled !== undefined) {
    groupBySubDomainToggle.checked = response.enabled
  }
})

// Listen for toggle changes.
autoGroupToggle.addEventListener("change", (event) => {
  sendMessage({
    action: "toggleAutoGroup",
    enabled: event.target.checked,
  })
})

groupBySubDomainToggle.addEventListener("change", () => {
  console.log("[Popup/Sidebar] groupBySubDomainToggle changed")
  const enabled = groupBySubDomainToggle.checked
  console.log("[Popup/Sidebar] Sending toggleGroupBySubDomain message with enabled:", enabled)
  sendMessage({
    action: "toggleGroupBySubDomain",
    enabled: enabled,
  })
})

// Custom Rules Elements
const rulesToggle = document.querySelector(".rules-toggle")
const rulesContent = document.querySelector(".rules-content")
const rulesCount = document.getElementById("rulesCount")
const rulesList = document.getElementById("rulesList")
const addRuleButton = document.getElementById("addRuleButton")

// Custom Rules State
let customRulesExpanded = false
let currentRules = {}

// Helper function to format domains display
function formatDomainsDisplay(domains, maxLength = 40) {
  if (!Array.isArray(domains) || domains.length === 0) {
    return "No domains"
  }

  if (domains.length === 1) {
    return domains[0]
  }

  const domainsText = domains.join(", ")

  if (domainsText.length <= maxLength) {
    return domainsText
  }

  // Truncate and add "and X more"
  let truncated = ""
  let count = 0

  for (const domain of domains) {
    if (truncated.length + domain.length + 2 <= maxLength - 10) {
      if (truncated) truncated += ", "
      truncated += domain
      count++
    } else {
      break
    }
  }

  const remaining = domains.length - count
  return `${truncated}${remaining > 0 ? ` and ${remaining} more` : ""}`
}

// Color mapping for display
const RULE_COLORS = {
  blue: "#4285f4",
  red: "#ea4335",
  yellow: "#fbbc04",
  green: "#34a853",
  pink: "#ff6d9d",
  purple: "#9c27b0",
  cyan: "#00acc1",
  orange: "#ff9800",
}

// Load and display custom rules
async function loadCustomRules() {
  try {
    const response = await sendMessage({ action: "getCustomRules" })
    if (response && response.customRules) {
      currentRules = response.customRules
      updateRulesDisplay()
    }
  } catch (error) {
    console.error("Error loading custom rules:", error)
    showRulesError("Failed to load custom rules")
  }
}

// Update the rules display
function updateRulesDisplay() {
  const rulesArray = Object.values(currentRules)
  const enabledRules = rulesArray.filter((rule) => rule.enabled)

  // Update count
  rulesCount.textContent = `(${enabledRules.length})`

  // Clear existing rules
  rulesList.innerHTML = ""

  if (rulesArray.length === 0) {
    // Create empty state message safely
    const emptyDiv = document.createElement("div")
    emptyDiv.className = "empty-rules"
    emptyDiv.textContent =
      "No custom rules yet. Create your first rule to group tabs by your preferences!"
    rulesList.appendChild(emptyDiv)
    return
  }

  // Sort rules by priority and name
  rulesArray.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return a.name.localeCompare(b.name)
  })

  // Create rule items
  rulesArray.forEach((rule) => {
    const ruleElement = createRuleElement(rule)
    rulesList.appendChild(ruleElement)
  })
}

// Create a rule element
function createRuleElement(rule) {
  const ruleItem = document.createElement("div")
  ruleItem.className = `rule-item ${!rule.enabled ? "disabled" : ""}`

  const colorHex = RULE_COLORS[rule.color] || RULE_COLORS.blue
  const domainsDisplay = formatDomainsDisplay(rule.domains)

  // Create color indicator
  const colorIndicator = document.createElement("div")
  colorIndicator.className = "rule-color-indicator"
  colorIndicator.style.backgroundColor = colorHex

  // Create rule info container
  const ruleInfo = document.createElement("div")
  ruleInfo.className = "rule-info"

  // Create rule name
  const ruleName = document.createElement("div")
  ruleName.className = "rule-name"
  ruleName.textContent = rule.name

  // Create rule domains
  const ruleDomains = document.createElement("div")
  ruleDomains.className = "rule-domains"
  ruleDomains.textContent = domainsDisplay

  ruleInfo.appendChild(ruleName)
  ruleInfo.appendChild(ruleDomains)

  // Create rule actions
  const ruleActions = document.createElement("div")
  ruleActions.className = "rule-actions"

  // Create edit button
  const editBtn = document.createElement("button")
  editBtn.className = "rule-action-btn edit"
  editBtn.title = "Edit rule"
  editBtn.setAttribute("data-rule-id", rule.id)
  editBtn.textContent = "✏️"

  // Create delete button
  const deleteBtn = document.createElement("button")
  deleteBtn.className = "rule-action-btn delete"
  deleteBtn.title = "Delete rule"
  deleteBtn.setAttribute("data-rule-id", rule.id)
  deleteBtn.textContent = "🗑️"

  ruleActions.appendChild(editBtn)
  ruleActions.appendChild(deleteBtn)

  // Assemble the rule item
  ruleItem.appendChild(colorIndicator)
  ruleItem.appendChild(ruleInfo)
  ruleItem.appendChild(ruleActions)

  editBtn.addEventListener("click", () => editRule(rule.id))
  deleteBtn.addEventListener("click", () => deleteRule(rule.id, rule.name))

  return ruleItem
}

// Show rules error
function showRulesError(message) {
  // Clear the container
  rulesList.innerHTML = ""

  // Create error element safely
  const errorDiv = document.createElement("div")
  errorDiv.className = "rules-error"
  errorDiv.textContent = message

  rulesList.appendChild(errorDiv)
}

// Toggle rules section
function toggleRulesSection() {
  customRulesExpanded = !customRulesExpanded
  rulesToggle.classList.toggle("expanded", customRulesExpanded)
  rulesContent.classList.toggle("expanded", customRulesExpanded)

  if (customRulesExpanded && Object.keys(currentRules).length === 0) {
    loadCustomRules()
  }
}

// Open add rule modal
async function addRule() {
  try {
    const url = browserAPI.runtime.getURL("public/rules-modal.html")
    await browserAPI.tabs.create({
      url: url,
      active: true,
    })
  } catch (error) {
    console.error("Error opening add rule modal:", error)
  }
}

// Open edit rule modal
async function editRule(ruleId) {
  try {
    const url = browserAPI.runtime.getURL(`public/rules-modal.html?edit=true&ruleId=${ruleId}`)
    await browserAPI.tabs.create({
      url: url,
      active: true,
    })
  } catch (error) {
    console.error("Error opening edit rule modal:", error)
  }
}

// Delete rule
async function deleteRule(ruleId, ruleName) {
  if (!confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
    return
  }

  try {
    const response = await sendMessage({
      action: "deleteCustomRule",
      ruleId: ruleId,
    })

    if (response && response.success) {
      // Remove from current rules and update display
      delete currentRules[ruleId]
      updateRulesDisplay()
    } else {
      alert(response?.error || "Failed to delete rule")
    }
  } catch (error) {
    console.error("Error deleting rule:", error)
    alert("Failed to delete rule")
  }
}

// Custom Rules Event Listeners
console.log("[Popup/Sidebar] Setting up Custom Rules event listeners")
console.log("[Popup/Sidebar] rulesToggle element:", rulesToggle)
console.log("[Popup/Sidebar] addRuleButton element:", addRuleButton)

if (rulesToggle) {
  rulesToggle.addEventListener("click", toggleRulesSection)
  console.log("[Popup/Sidebar] Added rulesToggle click listener")
}

if (addRuleButton) {
  addRuleButton.addEventListener("click", addRule)
  console.log("[Popup/Sidebar] Added addRuleButton click listener")
}

// Load custom rules on popup open
loadCustomRules()
