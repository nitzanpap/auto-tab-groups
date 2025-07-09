// Chrome-compatible popup script
const groupButton = document.getElementById("group")
const ungroupButton = document.getElementById("ungroup")
const generateNewColorsButton = document.getElementById("generateNewColors")
const collapseAllButton = document.getElementById("collapseAllButton")
const expandAllButton = document.getElementById("expandAllButton")
const autoGroupToggle = document.getElementById("autoGroupToggle")
const groupNewTabsToggle = document.getElementById("groupNewTabsToggle")
const groupByToggleOptions = document.querySelectorAll(".toggle-option")

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
  return new Promise(resolve => {
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
sendMessage({ action: "getAutoGroupState" }).then(response => {
  autoGroupToggle.checked = response.enabled
})

sendMessage({ action: "getGroupNewTabsState" }).then(response => {
  groupNewTabsToggle.checked = response.enabled
})

sendMessage({ action: "getGroupByMode" }).then(response => {
  if (response && response.mode) {
    updateGroupByToggle(response.mode)
  }
})

// Listen for toggle changes.
autoGroupToggle.addEventListener("change", event => {
  sendMessage({
    action: "toggleAutoGroup",
    enabled: event.target.checked
  })
})

groupNewTabsToggle.addEventListener("change", event => {
  sendMessage({
    action: "toggleGroupNewTabs",
    enabled: event.target.checked
  })
})

// Group by toggle event listeners
groupByToggleOptions.forEach(option => {
  option.addEventListener("click", () => {
    const mode = option.dataset.value
    console.log("[Popup/Sidebar] Group by mode changed to:", mode)
    updateGroupByToggle(mode)
    sendMessage({
      action: "setGroupByMode",
      mode: mode
    })
  })
})

// Update group by toggle UI
function updateGroupByToggle(mode) {
  groupByToggleOptions.forEach(option => {
    option.classList.remove("active")
    if (option.dataset.value === mode) {
      option.classList.add("active")
    }
  })
}

// Custom Rules Elements
const rulesToggle = document.querySelector(".rules-toggle")
const rulesContent = document.querySelector(".rules-content")
const rulesCount = document.getElementById("rulesCount")
const rulesList = document.getElementById("rulesList")
const addRuleButton = document.getElementById("addRuleButton")
const exportRulesButton = document.getElementById("exportRulesButton")
const importRulesButton = document.getElementById("importRulesButton")
const importFileInput = document.getElementById("importFileInput")

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
  orange: "#ff9800"
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
  const enabledRules = rulesArray.filter(rule => rule.enabled)

  // Update count
  rulesCount.textContent = `(${enabledRules.length})`

  // Update export button state
  if (exportRulesButton) {
    exportRulesButton.disabled = rulesArray.length === 0
    exportRulesButton.title =
      rulesArray.length === 0 ? "No rules to export" : "Export all rules to JSON file"
  }

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
  rulesArray.forEach(rule => {
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
      active: true
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
      active: true
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
      ruleId: ruleId
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

// Export rules
async function exportRules() {
  try {
    const response = await sendMessage({ action: "exportRules" })

    if (response && response.success) {
      // Create and trigger download
      const blob = new Blob([response.data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `auto-tab-groups-rules-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Show success message
      showRulesMessage("Rules exported successfully!", "success")
    } else {
      alert(response?.error || "Failed to export rules")
    }
  } catch (error) {
    console.error("Error exporting rules:", error)
    alert("Failed to export rules")
  }
}

// Import rules
async function importRules() {
  // Always use the dedicated import page for better UX and consistency
  // This provides drag-and-drop functionality and avoids popup/sidebar closing issues
  try {
    const url = browserAPI.runtime.getURL("public/import-rules.html")
    await browserAPI.tabs.create({
      url: url,
      active: true
    })
  } catch (error) {
    console.error("Error opening import page:", error)

    // Fallback to direct file input
    const isPopupContext = !document.querySelector(".sidebar-container")

    if (isPopupContext) {
      // Show instruction message for popup context
      alert(
        "Import Rules Instructions:\n\n" +
          "Due to popup limitations, please:\n" +
          "1. Keep this popup open\n" +
          "2. Select your JSON file when the dialog opens\n" +
          "3. The import will process automatically\n\n" +
          "Note: For better experience, consider using the sidebar!"
      )
    }

    // Try direct file input as last resort
    setTimeout(() => {
      importFileInput.click()
    }, 100)
  }
}

// Handle file import
async function handleFileImport(event) {
  const file = event.target.files[0]
  if (!file) return

  // Reset the input so the same file can be selected again
  event.target.value = ""

  try {
    const text = await file.text()

    // Ask user if they want to replace existing rules or merge
    const replaceExisting = confirm(
      "Do you want to replace all existing rules?\n\n" +
        "• Click OK to REPLACE all existing rules with imported ones\n" +
        "• Click Cancel to MERGE imported rules with existing ones"
    )

    const response = await sendMessage({
      action: "importRules",
      jsonData: text,
      replaceExisting: replaceExisting
    })

    if (response && response.success) {
      // Reload rules and update display
      await loadCustomRules()

      const message =
        `Import successful!\n` +
        `• Imported: ${response.imported} rules\n` +
        `• Skipped: ${response.skipped} rules\n` +
        (response.validationErrors.length > 0
          ? `• Errors: ${response.validationErrors.slice(0, 3).join("; ")}${
              response.validationErrors.length > 3 ? "..." : ""
            }`
          : "")

      showRulesMessage("Rules imported successfully!", "success")
      alert(message)
    } else {
      alert(response?.error || "Failed to import rules")
    }
  } catch (error) {
    console.error("Error importing rules:", error)
    alert("Failed to import rules: " + error.message)
  }
}

// Show rules message (success/error)
function showRulesMessage(message, type = "info") {
  // Create message element
  const messageDiv = document.createElement("div")
  messageDiv.className = `rules-message ${type}`
  messageDiv.textContent = message

  // Insert at top of rules list
  rulesList.insertBefore(messageDiv, rulesList.firstChild)

  // Remove after 3 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv)
    }
  }, 3000)
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

if (exportRulesButton) {
  exportRulesButton.addEventListener("click", exportRules)
  console.log("[Popup/Sidebar] Added exportRulesButton click listener")
}

if (importRulesButton) {
  importRulesButton.addEventListener("click", importRules)
  console.log("[Popup/Sidebar] Added importRulesButton click listener")
}

if (importFileInput) {
  importFileInput.addEventListener("change", handleFileImport)
  console.log("[Popup/Sidebar] Added importFileInput change listener")
}

// Load custom rules on popup open
loadCustomRules()
