import "./style.css"
import type { CustomRule, UserLocale } from "../../types"
import type { AiGroupSuggestion } from "../../types/ai-messages"
import { extractDomain } from "../../utils/DomainUtils"
import {
  applyDirectionToDom,
  applyI18nToDom,
  initI18n,
  resolveEffectiveLocale,
  t
} from "../../utils/i18n"
import { cachedAiSuggestions } from "../../utils/storage"

// DOM Elements
const groupButton = document.getElementById("group") as HTMLButtonElement
const ungroupButton = document.getElementById("ungroup") as HTMLButtonElement
const generateNewColorsButton = document.getElementById("generateNewColors") as HTMLButtonElement
const collapseAllButton = document.getElementById("collapseAllButton") as HTMLButtonElement
const expandAllButton = document.getElementById("expandAllButton") as HTMLButtonElement
const autoGroupToggle = document.getElementById("autoGroupToggle") as HTMLInputElement
const groupNewTabsToggle = document.getElementById("groupNewTabsToggle") as HTMLInputElement
const groupByToggleOptions = document.querySelectorAll<HTMLButtonElement>(
  ".group-by-toggle-bar:not(.sort-direction-toggle-bar) .toggle-option"
)
const minimumTabsInput = document.getElementById("minimumTabsInput") as HTMLInputElement

// Auto-collapse Elements
const autoCollapseToggle = document.getElementById("autoCollapseToggle") as HTMLInputElement
const collapseDelayContainer = document.getElementById("collapseDelayContainer") as HTMLDivElement
const collapseDelayInput = document.getElementById("collapseDelayInput") as HTMLInputElement
const collapseHelp = document.getElementById("collapseHelp") as HTMLDivElement

// Tab Positioning Elements
const openTabNextToCurrentToggle = document.getElementById(
  "openTabNextToCurrentToggle"
) as HTMLInputElement

// Sorting Elements
const sortingToggle = document.querySelector(".sorting-toggle") as HTMLButtonElement
const sortingContent = document.querySelector(".sorting-content") as HTMLDivElement
const sortGroupsToggle = document.getElementById("sortGroupsToggle") as HTMLInputElement
const sortDirectionContainer = document.getElementById("sortDirectionContainer") as HTMLDivElement
const sortDirectionOptions = document.querySelectorAll<HTMLButtonElement>(".sort-direction-option")
const sortingIndexContainer = document.getElementById("sortingIndexContainer") as HTMLDivElement
const indexGroupTitlesToggle = document.getElementById("indexGroupTitlesToggle") as HTMLInputElement
const sortingHelp = document.getElementById("sortingHelp") as HTMLDivElement

// Custom Rules Elements
const rulesToggle = document.querySelector(".rules-toggle") as HTMLButtonElement
const rulesContent = document.querySelector(".rules-content") as HTMLDivElement
const rulesCount = document.getElementById("rulesCount") as HTMLSpanElement
const rulesList = document.getElementById("rulesList") as HTMLDivElement
const addRuleButton = document.getElementById("addRuleButton") as HTMLButtonElement
const exportRulesButton = document.getElementById("exportRulesButton") as HTMLButtonElement
const importRulesButton = document.getElementById("importRulesButton") as HTMLButtonElement

// Blacklist Elements
const blacklistToggle = document.querySelector(".blacklist-toggle") as HTMLButtonElement
const blacklistContent = document.querySelector(".blacklist-content") as HTMLDivElement
const blacklistCount = document.getElementById("blacklistCount") as HTMLSpanElement
const blacklistList = document.getElementById("blacklistList") as HTMLDivElement
const addBlacklistButton = document.getElementById("addBlacklistButton") as HTMLButtonElement

// Advanced Elements
const advancedToggle = document.querySelector(".advanced-toggle") as HTMLButtonElement
const advancedContent = document.querySelector(".advanced-content") as HTMLDivElement
const hideContextMenuToggle = document.getElementById("hideContextMenuToggle") as HTMLInputElement

// Language picker
const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement

// AI Elements
const aiToggle = document.querySelector(".ai-toggle") as HTMLButtonElement
const aiContent = document.querySelector(".ai-content") as HTMLDivElement
const aiBadge = document.getElementById("aiBadge") as HTMLSpanElement
const aiEnabledToggle = document.getElementById("aiEnabledToggle") as HTMLInputElement
const aiSettings = document.getElementById("aiSettings") as HTMLDivElement
const aiModelSelect = document.getElementById("aiModelSelect") as HTMLSelectElement
const aiStatusBadge = document.getElementById("aiStatusBadge") as HTMLSpanElement
const aiProgressBar = document.getElementById("aiProgressBar") as HTMLDivElement
const aiProgressFill = document.getElementById("aiProgressFill") as HTMLDivElement
const aiLoadButton = document.getElementById("aiLoadButton") as HTMLButtonElement
const aiWebGpuWarning = document.getElementById("aiWebGpuWarning") as HTMLDivElement

// AI Suggest Elements
const aiSuggestButton = document.getElementById("aiSuggestButton") as HTMLButtonElement
const aiSuggestStatus = document.getElementById("aiSuggestStatus") as HTMLDivElement
const aiSuggestionsContainer = document.getElementById("aiSuggestionsContainer") as HTMLDivElement

// State
let aiSectionExpanded = false
let aiStatusPollingInterval: ReturnType<typeof setInterval> | null = null
let sortingSectionExpanded = false
let customRulesExpanded = false
let blacklistExpanded = false
let advancedExpanded = false
let currentRules: Record<string, CustomRule> = {}

// Color mapping for display
const RULE_COLORS: Record<string, string> = {
  blue: "#4285f4",
  red: "#ea4335",
  yellow: "#fbbc04",
  green: "#34a853",
  pink: "#ff6d9d",
  purple: "#9c27b0",
  cyan: "#00acc1",
  orange: "#ff9800",
  grey: "#9aa0a6"
}

// Helper function for sending messages
function sendMessage<T = Record<string, unknown>>(message: Record<string, unknown>): Promise<T> {
  return new Promise(resolve => {
    browser.runtime.sendMessage(message, resolve)
  })
}

// Update version display
function updateVersionDisplay(): void {
  const versionNumberElement = document.getElementById("versionNumber")
  if (versionNumberElement) {
    const manifest = browser.runtime.getManifest()
    versionNumberElement.textContent = manifest.version
  }
}

// Update browser display
function updateBrowserDisplay(): void {
  const browserNameElement = document.getElementById("browserName")
  const browserEmojiElement = document.getElementById("browserEmoji")

  if (!browserNameElement || !browserEmojiElement) return

  // Check if Firefox
  const isFirefox = navigator.userAgent.includes("Firefox")
  if (isFirefox) {
    browserNameElement.textContent = t("footerBrowserFirefox", "Firefox")
    browserEmojiElement.textContent = ""
  } else {
    browserNameElement.textContent = t("footerBrowserChrome", "Chrome")
    browserEmojiElement.textContent = ""
  }
}

// Update collapse delay visibility
function updateCollapseDelayVisibility(enabled: boolean): void {
  if (enabled) {
    collapseDelayContainer.classList.add("visible")
    collapseHelp.classList.add("visible")
  } else {
    collapseDelayContainer.classList.remove("visible")
    collapseHelp.classList.remove("visible")
  }
}

// Update group by toggle UI
function updateGroupByToggle(mode: string): void {
  groupByToggleOptions.forEach(option => {
    option.classList.remove("active")
    if (option.dataset.value === mode) {
      option.classList.add("active")
    }
  })
}

// Format domains display
function formatDomainsDisplay(domains: string[], maxLength = 40): string {
  if (!Array.isArray(domains) || domains.length === 0) {
    return t("rulesNoDomains", "No domains")
  }

  if (domains.length === 1) {
    return domains[0]
  }

  const domainsText = domains.join(", ")

  if (domainsText.length <= maxLength) {
    return domainsText
  }

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
  return `${truncated}${remaining > 0 ? t("rulesDomainsSeparator", ` and ${remaining} more`, String(remaining)) : ""}`
}

// Load and display custom rules
async function loadCustomRules(): Promise<void> {
  try {
    const response = await sendMessage<{
      customRules?: Record<string, CustomRule>
    }>({
      action: "getCustomRules"
    })
    if (response?.customRules) {
      currentRules = response.customRules
      updateRulesDisplay()
    }
  } catch (error) {
    console.error("Error loading custom rules:", error)
    showRulesError(t("rulesFailedToLoad", "Failed to load custom rules"))
  }
}

// Update the rules display (excludes blacklist rules)
function updateRulesDisplay(): void {
  const allRules = Object.values(currentRules)
  const groupingRules = allRules.filter(rule => !rule.isBlacklist)
  const enabledGroupingRules = groupingRules.filter(rule => rule.enabled)

  rulesCount.textContent = `(${enabledGroupingRules.length})`

  if (exportRulesButton) {
    exportRulesButton.disabled = allRules.length === 0
    exportRulesButton.title =
      allRules.length === 0
        ? t("rulesNoExport", "No rules to export")
        : t("rulesExportTitle", "Export all rules to JSON file")
  }

  while (rulesList.firstChild) rulesList.removeChild(rulesList.firstChild)

  if (groupingRules.length === 0) {
    const emptyDiv = document.createElement("div")
    emptyDiv.className = "empty-rules"
    emptyDiv.textContent = t(
      "rulesEmptyState",
      "No custom rules yet. Create your first rule to group tabs by your preferences!"
    )
    rulesList.appendChild(emptyDiv)
  } else {
    groupingRules.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.name.localeCompare(b.name)
    })

    groupingRules.forEach(rule => {
      const ruleElement = createRuleElement(rule)
      rulesList.appendChild(ruleElement)
    })
  }

  // Also update blacklist display since they share the same data source
  updateBlacklistDisplay()
}

// Update the blacklist display
function updateBlacklistDisplay(): void {
  const blacklistRules = Object.values(currentRules).filter(rule => rule.isBlacklist === true)
  const enabledBlacklist = blacklistRules.filter(rule => rule.enabled)

  blacklistCount.textContent = `(${enabledBlacklist.length})`

  while (blacklistList.firstChild) blacklistList.removeChild(blacklistList.firstChild)

  if (blacklistRules.length === 0) {
    const emptyDiv = document.createElement("div")
    emptyDiv.className = "empty-rules"
    emptyDiv.textContent = t("blacklistEmpty", "No blacklisted domains yet.")
    blacklistList.appendChild(emptyDiv)
    return
  }

  blacklistRules.sort((a, b) => a.name.localeCompare(b.name))

  blacklistRules.forEach(rule => {
    const ruleElement = createBlacklistElement(rule)
    blacklistList.appendChild(ruleElement)
  })
}

// Create a blacklist rule element
function createBlacklistElement(rule: CustomRule): HTMLDivElement {
  const ruleItem = document.createElement("div")
  ruleItem.className = `rule-item${!rule.enabled ? " disabled" : ""} blacklist`

  const domainsDisplay = formatDomainsDisplay(rule.domains)

  const colorIndicator = document.createElement("div")
  colorIndicator.className = "rule-color-indicator blacklist-indicator"

  const ruleInfo = document.createElement("div")
  ruleInfo.className = "rule-info"

  const ruleDomains = document.createElement("div")
  ruleDomains.className = "rule-domains blacklist-domains"
  ruleDomains.textContent = domainsDisplay

  ruleInfo.appendChild(ruleDomains)

  const ruleActions = document.createElement("div")
  ruleActions.className = "rule-actions"

  const editBtn = document.createElement("button")
  editBtn.className = "rule-action-btn edit"
  editBtn.title = t("blacklistEditTitle", "Edit blacklist rule")
  editBtn.setAttribute("data-rule-id", rule.id)
  editBtn.textContent = t("rulesEdit", "Edit")

  const deleteBtn = document.createElement("button")
  deleteBtn.className = "rule-action-btn delete"
  deleteBtn.title = t("blacklistDeleteTitle", "Delete blacklist rule")
  deleteBtn.setAttribute("data-rule-id", rule.id)
  deleteBtn.textContent = t("rulesDelete", "Delete")

  ruleActions.appendChild(editBtn)
  ruleActions.appendChild(deleteBtn)

  ruleItem.appendChild(colorIndicator)
  ruleItem.appendChild(ruleInfo)
  ruleItem.appendChild(ruleActions)

  editBtn.addEventListener("click", () => editBlacklistRule(rule.id))
  deleteBtn.addEventListener("click", () => deleteRule(rule.id, rule.name))

  return ruleItem
}

// Create a rule element
function createRuleElement(rule: CustomRule): HTMLDivElement {
  const ruleItem = document.createElement("div")
  ruleItem.className = `rule-item${!rule.enabled ? " disabled" : ""}`

  const colorHex = RULE_COLORS[rule.color] || RULE_COLORS.blue
  const domainsDisplay = formatDomainsDisplay(rule.domains)

  const colorIndicator = document.createElement("div")
  colorIndicator.className = "rule-color-indicator"
  colorIndicator.style.backgroundColor = colorHex

  const ruleInfo = document.createElement("div")
  ruleInfo.className = "rule-info"

  const ruleName = document.createElement("div")
  ruleName.className = "rule-name"
  ruleName.textContent = rule.name

  const ruleDomains = document.createElement("div")
  ruleDomains.className = "rule-domains"
  ruleDomains.textContent = domainsDisplay

  ruleInfo.appendChild(ruleName)
  ruleInfo.appendChild(ruleDomains)

  const ruleActions = document.createElement("div")
  ruleActions.className = "rule-actions"

  const addTabBtn = document.createElement("button")
  addTabBtn.className = "rule-action-btn add-tab"
  addTabBtn.title = t("rulesAddTabTitle", "Add Tab to Existing Rule")
  addTabBtn.setAttribute("data-rule-id", rule.id)
  addTabBtn.textContent = "+"

  const editBtn = document.createElement("button")
  editBtn.className = "rule-action-btn edit"
  editBtn.title = t("rulesEditTitle", "Edit rule")
  editBtn.setAttribute("data-rule-id", rule.id)
  editBtn.textContent = t("rulesEdit", "Edit")

  const deleteBtn = document.createElement("button")
  deleteBtn.className = "rule-action-btn delete"
  deleteBtn.title = t("rulesDeleteTitle", "Delete rule")
  deleteBtn.setAttribute("data-rule-id", rule.id)
  deleteBtn.textContent = t("rulesDelete", "Delete")

  ruleActions.appendChild(addTabBtn)
  ruleActions.appendChild(editBtn)
  ruleActions.appendChild(deleteBtn)

  ruleItem.appendChild(colorIndicator)
  ruleItem.appendChild(ruleInfo)
  ruleItem.appendChild(ruleActions)

  addTabBtn.addEventListener("click", () => addCurrentTabToRule(rule.id, addTabBtn))
  editBtn.addEventListener("click", () => editRule(rule.id))
  deleteBtn.addEventListener("click", () => deleteRule(rule.id, rule.name))

  return ruleItem
}

// Show rules error
function showRulesError(message: string): void {
  rulesList.innerHTML = ""
  const errorDiv = document.createElement("div")
  errorDiv.className = "rules-error"
  errorDiv.textContent = message
  rulesList.appendChild(errorDiv)
}

// Show rules message
function showRulesMessage(message: string, type = "info"): void {
  const messageDiv = document.createElement("div")
  messageDiv.className = `rules-message ${type}`
  messageDiv.textContent = message
  rulesList.insertBefore(messageDiv, rulesList.firstChild)
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv)
    }
  }, 3000)
}

// Toggle rules section
function toggleRulesSection(): void {
  customRulesExpanded = !customRulesExpanded
  rulesToggle.classList.toggle("expanded", customRulesExpanded)
  rulesContent.classList.toggle("expanded", customRulesExpanded)

  if (customRulesExpanded) {
    if (Object.keys(currentRules).length === 0) {
      loadCustomRules()
    }
    // Collapse AI section (accordion)
    if (aiSectionExpanded) {
      aiSectionExpanded = false
      aiToggle.classList.remove("expanded")
      aiContent.classList.remove("expanded")
      stopAiStatusPolling()
    }
  }
}

// Add current tab's domain to an existing rule
async function addCurrentTabToRule(ruleId: string, button: HTMLButtonElement): Promise<void> {
  const originalText = button.textContent
  const originalTitle = button.title
  button.disabled = true

  const resetButton = (): void => {
    button.textContent = originalText
    button.title = originalTitle
    button.disabled = false
  }

  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.url) {
      button.textContent = "!"
      button.title = t("rulesAddTabNoTab", "No active tab found")
      setTimeout(resetButton, 1500)
      return
    }

    const domain = extractDomain(activeTab.url)
    if (!domain || domain === "system") {
      button.textContent = "!"
      button.title = t("rulesAddTabCantExtract", "Cannot extract domain from this tab")
      setTimeout(resetButton, 1500)
      return
    }

    const response = await sendMessage<{
      success?: boolean
      alreadyExists?: boolean
      error?: string
    }>({
      action: "addDomainToRule",
      ruleId,
      domain
    })

    if (response?.success) {
      if (response.alreadyExists) {
        button.textContent = "="
        button.title = t("rulesAddTabAlreadyExists", "Domain already in this rule")
      } else {
        button.textContent = "\u2713"
        button.title = t("rulesAddTabAdded", "Added!")
        await loadCustomRules()
      }
    } else {
      button.textContent = "!"
      button.title = response?.error || t("rulesAddTabFailed", "Failed to add domain")
    }
  } catch {
    button.textContent = "!"
    button.title = t("rulesAddTabFailed", "Failed to add domain")
  }

  setTimeout(resetButton, 1500)
}

// Open add rule modal
async function addRule(): Promise<void> {
  try {
    const url = browser.runtime.getURL("/rules-modal.html")
    await browser.tabs.create({ url, active: true })
  } catch (error) {
    console.error("Error opening add rule modal:", error)
  }
}

// Open edit rule modal
async function editRule(ruleId: string): Promise<void> {
  try {
    const url = browser.runtime.getURL(`/rules-modal.html?edit=true&ruleId=${ruleId}`)
    await browser.tabs.create({ url, active: true })
  } catch (error) {
    console.error("Error opening edit rule modal:", error)
  }
}

// Open add blacklist rule modal
async function addBlacklistRule(): Promise<void> {
  try {
    const url = browser.runtime.getURL("/rules-modal.html?blacklist=true")
    await browser.tabs.create({ url, active: true })
  } catch (error) {
    console.error("Error opening blacklist modal:", error)
  }
}

// Open edit blacklist rule modal
async function editBlacklistRule(ruleId: string): Promise<void> {
  try {
    const url = browser.runtime.getURL(
      `/rules-modal.html?edit=true&ruleId=${ruleId}&blacklist=true`
    )
    await browser.tabs.create({ url, active: true })
  } catch (error) {
    console.error("Error opening edit blacklist modal:", error)
  }
}

// Toggle blacklist section
function toggleBlacklistSection(): void {
  blacklistExpanded = !blacklistExpanded
  blacklistToggle.classList.toggle("expanded", blacklistExpanded)
  blacklistContent.classList.toggle("expanded", blacklistExpanded)

  if (blacklistExpanded) {
    if (Object.keys(currentRules).length === 0) {
      loadCustomRules()
    }
  }
}

// Delete rule
async function deleteRule(ruleId: string, ruleName: string): Promise<void> {
  const prompt = t(
    "rulesDeleteConfirm",
    `Are you sure you want to delete the rule "${ruleName}"?`,
    ruleName
  )
  if (!confirm(prompt)) {
    return
  }

  try {
    const response = await sendMessage<{ success?: boolean; error?: string }>({
      action: "deleteCustomRule",
      ruleId
    })

    if (response?.success) {
      delete currentRules[ruleId]
      updateRulesDisplay()
    } else {
      alert(response?.error || t("rulesFailedToDelete", "Failed to delete rule"))
    }
  } catch (error) {
    console.error("Error deleting rule:", error)
    alert(t("rulesFailedToDelete", "Failed to delete rule"))
  }
}

// Export rules
async function exportRules(): Promise<void> {
  try {
    const response = await sendMessage<{
      success?: boolean
      data?: string
      error?: string
    }>({
      action: "exportRules"
    })

    if (response?.success && response.data) {
      const blob = new Blob([response.data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `auto-tab-groups-rules-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showRulesMessage(t("rulesExportSuccess", "Rules exported successfully!"), "success")
    } else {
      alert(response?.error || t("rulesFailedToExport", "Failed to export rules"))
    }
  } catch (error) {
    console.error("Error exporting rules:", error)
    alert(t("rulesFailedToExport", "Failed to export rules"))
  }
}

// Import rules - open dedicated import page in new tab
// This avoids Firefox's popup-close-on-focus-loss issue with file dialogs
async function importRules(): Promise<void> {
  try {
    const url = browser.runtime.getURL("/import-rules.html")
    await browser.tabs.create({ url, active: true })
  } catch (error) {
    console.error("Error opening import page:", error)
  }
}
// Initialize — resolve locale from background, load override catalog if any,
// then translate the DOM and set text direction. Dynamic lists (rules, blacklist,
// cached AI suggestions) are loaded AFTER i18n is ready so their dynamically
// rendered strings (Edit/Delete buttons, empty states) pick up the right locale.
const i18nReady: Promise<void> = (async () => {
  const resp = await sendMessage<{ locale?: UserLocale }>({ action: "getUserLocale" })
  const locale: UserLocale = resp?.locale ?? "auto"
  languageSelect.value = locale
  await initI18n(locale)
  applyI18nToDom()
  applyDirectionToDom(resolveEffectiveLocale(locale))
})()
updateVersionDisplay()
updateBrowserDisplay()

// Language picker change handler — also re-renders dynamic lists so their
// JS-rendered strings (Edit/Delete buttons, truncation suffix, empty states)
// switch along with the static DOM.
languageSelect.addEventListener("change", async () => {
  const locale = languageSelect.value as UserLocale
  await sendMessage({ action: "setUserLocale", locale })
  await initI18n(locale)
  applyI18nToDom()
  applyDirectionToDom(resolveEffectiveLocale(locale))
  updateRulesDisplay()
  updateBlacklistDisplay()
})

// Button event listeners
groupButton.addEventListener("click", () => sendMessage({ action: "group" }))
ungroupButton.addEventListener("click", () => sendMessage({ action: "ungroup" }))
generateNewColorsButton.addEventListener("click", () =>
  sendMessage({ action: "generateNewColors" })
)
collapseAllButton.addEventListener("click", () => sendMessage({ action: "collapseAll" }))
expandAllButton.addEventListener("click", () => sendMessage({ action: "expandAll" }))

// Initialize toggle states
sendMessage<{ enabled?: boolean }>({ action: "getAutoGroupState" }).then(response => {
  if (response?.enabled !== undefined) {
    autoGroupToggle.checked = response.enabled
  }
})

sendMessage<{ enabled?: boolean }>({ action: "getGroupNewTabsState" }).then(response => {
  if (response?.enabled !== undefined) {
    groupNewTabsToggle.checked = response.enabled
  }
})

sendMessage<{ mode?: string }>({ action: "getGroupByMode" }).then(response => {
  if (response?.mode) {
    updateGroupByToggle(response.mode)
  }
})

sendMessage<{ minimumTabs?: number }>({
  action: "getMinimumTabsForGroup"
}).then(response => {
  minimumTabsInput.value = String(response?.minimumTabs || 1)
})

// Initialize auto-collapse state
sendMessage<{ enabled?: boolean; delayMs?: number }>({
  action: "getAutoCollapseState"
}).then(response => {
  const enabled = response?.enabled ?? false
  const delayMs = response?.delayMs ?? 0
  autoCollapseToggle.checked = enabled
  collapseDelayInput.value = String(delayMs)
  updateCollapseDelayVisibility(enabled)
})

// Initialize open tab next to current state
sendMessage<{ enabled?: boolean }>({ action: "getOpenTabNextToCurrent" }).then(response => {
  openTabNextToCurrentToggle.checked = response?.enabled ?? false
})

// Initialize sort groups and index state
sendMessage<{ enabled?: boolean }>({ action: "getSortGroupsAlphabetically" }).then(response => {
  const enabled = response?.enabled ?? false
  sortGroupsToggle.checked = enabled
  updateSortingSubOptions(enabled)
})

sendMessage<{ direction?: "asc" | "desc" }>({ action: "getSortGroupsDirection" }).then(response => {
  updateSortDirectionButtons(response?.direction ?? "asc")
})

sendMessage<{ enabled?: boolean }>({ action: "getIndexGroupTitles" }).then(response => {
  indexGroupTitlesToggle.checked = response?.enabled ?? false
})

// Toggle event listeners
autoGroupToggle.addEventListener("change", event => {
  sendMessage({
    action: "toggleAutoGroup",
    enabled: (event.target as HTMLInputElement).checked
  })
})

groupNewTabsToggle.addEventListener("change", event => {
  sendMessage({
    action: "toggleGroupNewTabs",
    enabled: (event.target as HTMLInputElement).checked
  })
})

// Group by toggle event listeners
groupByToggleOptions.forEach(option => {
  option.addEventListener("click", () => {
    const mode = option.dataset.value
    if (mode) {
      updateGroupByToggle(mode)
      sendMessage({ action: "setGroupByMode", mode })
    }
  })
})

// Minimum tabs input event listener
minimumTabsInput.addEventListener("change", event => {
  const value = parseInt((event.target as HTMLInputElement).value, 10) || 1
  const clampedValue = Math.max(1, Math.min(10, value))
  ;(event.target as HTMLInputElement).value = String(clampedValue)
  sendMessage({ action: "setMinimumTabsForGroup", minimumTabs: clampedValue })
})

// Auto-collapse event listeners
autoCollapseToggle.addEventListener("change", async () => {
  const enabled = autoCollapseToggle.checked
  updateCollapseDelayVisibility(enabled)
  await sendMessage({
    action: "updateAutoCollapse",
    autoCollapseEnabled: enabled,
    autoCollapseDelayMs: parseInt(collapseDelayInput.value, 10) || 0
  })
})

collapseDelayInput.addEventListener("change", async () => {
  let delayMs = parseInt(collapseDelayInput.value, 10)

  // Clamp to valid range
  if (Number.isNaN(delayMs) || delayMs < 0) delayMs = 0
  if (delayMs > 5000) delayMs = 5000

  collapseDelayInput.value = String(delayMs)
  await sendMessage({
    action: "updateAutoCollapse",
    autoCollapseEnabled: autoCollapseToggle.checked,
    autoCollapseDelayMs: delayMs
  })
})

// Open tab next to current event listener
openTabNextToCurrentToggle.addEventListener("change", event => {
  sendMessage({
    action: "toggleOpenTabNextToCurrent",
    enabled: (event.target as HTMLInputElement).checked
  })
})

// Sorting section toggle
function toggleSortingSection(): void {
  sortingSectionExpanded = !sortingSectionExpanded
  sortingToggle.classList.toggle("expanded", sortingSectionExpanded)
  sortingContent.classList.toggle("expanded", sortingSectionExpanded)
}

function updateSortingSubOptions(sortEnabled: boolean): void {
  if (sortEnabled) {
    sortDirectionContainer.classList.add("visible")
    sortingIndexContainer.classList.add("visible")
    sortingHelp.classList.add("visible")
  } else {
    sortDirectionContainer.classList.remove("visible")
    sortingIndexContainer.classList.remove("visible")
    sortingHelp.classList.remove("visible")
    indexGroupTitlesToggle.checked = false
  }
}

function updateSortDirectionButtons(direction: string): void {
  sortDirectionOptions.forEach(option => {
    option.classList.toggle("active", option.dataset.value === direction)
  })
}

sortingToggle?.addEventListener("click", toggleSortingSection)

// Sort groups event listener
sortGroupsToggle.addEventListener("change", event => {
  const enabled = (event.target as HTMLInputElement).checked
  updateSortingSubOptions(enabled)
  sendMessage({
    action: "toggleSortGroupsAlphabetically",
    enabled
  })
})

// Sort direction event listeners
sortDirectionOptions.forEach(option => {
  option.addEventListener("click", () => {
    const direction = option.dataset.value
    if (direction === "asc" || direction === "desc") {
      updateSortDirectionButtons(direction)
      sendMessage({ action: "setSortGroupsDirection", direction })
    }
  })
})

// Index group titles event listener
indexGroupTitlesToggle.addEventListener("change", event => {
  sendMessage({
    action: "toggleIndexGroupTitles",
    enabled: (event.target as HTMLInputElement).checked
  })
})

// --- AI Features ---

function toggleAiSection(): void {
  aiSectionExpanded = !aiSectionExpanded
  aiToggle.classList.toggle("expanded", aiSectionExpanded)
  aiContent.classList.toggle("expanded", aiSectionExpanded)

  if (aiSectionExpanded) {
    initializeAiSection()
    // Collapse rules section (accordion)
    if (customRulesExpanded) {
      customRulesExpanded = false
      rulesToggle.classList.remove("expanded")
      rulesContent.classList.remove("expanded")
    }
  } else {
    stopAiStatusPolling()
  }
}

async function initializeAiSection(): Promise<void> {
  try {
    // AI features are Chrome-only for now (WebLLM's tokenizer exceeds Firefox store limits)
    if (navigator.userAgent.includes("Firefox")) {
      const notice = document.createElement("div")
      notice.className = "ai-firefox-notice"
      notice.textContent = t(
        "aiFirefoxNotice",
        "AI features are currently available on Chrome only. Firefox support is coming soon."
      )
      aiContent.replaceChildren(notice)
      return
    }

    const response = await sendMessage<{
      settings?: { aiEnabled: boolean; aiModelId: string }
      modelStatus?: { status: string; progress: number; error: string | null }
      availableModels?: Array<{ id: string; displayName: string }>
    }>({ action: "getAiState" })

    if (response?.availableModels && aiModelSelect.options.length === 0) {
      for (const model of response.availableModels) {
        const option = document.createElement("option")
        option.value = model.id
        option.textContent = model.displayName
        aiModelSelect.appendChild(option)
      }
    }

    if (response?.settings) {
      aiEnabledToggle.checked = response.settings.aiEnabled
      aiModelSelect.value = response.settings.aiModelId
      updateAiSettingsVisibility(response.settings.aiEnabled)
      updateAiBadge(response.settings.aiEnabled)
    }

    if (response?.modelStatus) {
      updateAiModelStatus(response.modelStatus)
    }

    // Check WebGPU support
    const webGpuResponse = await sendMessage<{
      webGpu?: { available: boolean; reason: string | null }
    }>({ action: "checkWebGpuSupport" })

    if (webGpuResponse?.webGpu && !webGpuResponse.webGpu.available) {
      aiWebGpuWarning.classList.add("visible")
      aiWebGpuWarning.textContent =
        webGpuResponse.webGpu.reason || t("aiWebGpuUnavailable", "WebGPU is not available")
      aiLoadButton.disabled = true
    }
  } catch (error) {
    console.error("Error initializing AI section:", error)
  }
}

function updateAiSettingsVisibility(enabled: boolean): void {
  if (enabled) {
    aiSettings.classList.add("visible")
  } else {
    aiSettings.classList.remove("visible")
    stopAiStatusPolling()
  }
}

function updateAiBadge(enabled: boolean): void {
  aiBadge.textContent = enabled ? t("aiBadgeOn", "On") : t("aiBadgeOff", "Off")
  aiBadge.classList.toggle("enabled", enabled)
}

function updateAiModelStatus(modelStatus: {
  status: string
  progress: number
  error: string | null
}): void {
  const { status, progress, error } = modelStatus

  // Update status badge
  aiStatusBadge.textContent =
    status === "idle"
      ? t("aiStatusIdle", "Idle")
      : status === "loading"
        ? t("aiStatusLoading", `Loading ${progress}%`, String(progress))
        : status === "ready"
          ? t("aiStatusReady", "Ready")
          : t("aiStatusError", "Error")

  aiStatusBadge.className = "ai-status-badge"
  if (status !== "idle") {
    aiStatusBadge.classList.add(status)
  }

  // Update progress bar
  if (status === "loading") {
    aiProgressBar.classList.add("visible")
    aiProgressFill.style.width = `${progress}%`
  } else {
    aiProgressBar.classList.remove("visible")
  }

  // Update load button
  if (status === "ready") {
    aiLoadButton.textContent = t("aiUnloadModel", "Unload Model")
    aiLoadButton.classList.add("unload")
    aiLoadButton.disabled = false
    aiModelSelect.disabled = true
    aiSuggestButton.disabled = false
    stopAiStatusPolling()
  } else if (status === "loading") {
    aiLoadButton.textContent = t("aiLoadingButton", "Loading...")
    aiLoadButton.disabled = true
    aiModelSelect.disabled = true
    aiSuggestButton.disabled = true
    startAiStatusPolling()
  } else if (status === "error") {
    aiLoadButton.textContent = t("aiRetryLoad", "Retry Load")
    aiLoadButton.classList.remove("unload")
    aiLoadButton.disabled = false
    aiModelSelect.disabled = false
    aiSuggestButton.disabled = true
    stopAiStatusPolling()
    if (error) {
      console.error("AI model error:", error)
    }
  } else {
    aiLoadButton.textContent = t("aiLoadModel", "Load Model")
    aiLoadButton.classList.remove("unload")
    aiLoadButton.disabled = false
    aiModelSelect.disabled = false
    aiSuggestButton.disabled = true
  }
}

function startAiStatusPolling(): void {
  if (aiStatusPollingInterval) return
  aiStatusPollingInterval = setInterval(async () => {
    try {
      const response = await sendMessage<{
        modelStatus?: { status: string; progress: number; error: string | null }
      }>({ action: "getAiModelStatus" })
      if (response?.modelStatus) {
        updateAiModelStatus(response.modelStatus)
      }
    } catch {
      stopAiStatusPolling()
    }
  }, 500)
}

function stopAiStatusPolling(): void {
  if (aiStatusPollingInterval) {
    clearInterval(aiStatusPollingInterval)
    aiStatusPollingInterval = null
  }
}

// --- AI Suggestion Handlers ---

async function handleSuggestGroups(): Promise<void> {
  aiSuggestButton.disabled = true
  aiSuggestStatus.textContent = t("aiAnalyzing", "Analyzing your tabs...")
  aiSuggestStatus.className = "ai-suggest-status loading"
  aiSuggestionsContainer.innerHTML = ""

  try {
    const response = await sendMessage<{
      success?: boolean
      suggestions?: AiGroupSuggestion[]
      error?: string
      warnings?: string[]
    }>({ action: "suggestGroups" })

    if (response?.success && response.suggestions) {
      aiSuggestStatus.textContent = ""
      aiSuggestStatus.className = "ai-suggest-status"
      renderSuggestions(response.suggestions, [])
    } else {
      aiSuggestStatus.textContent =
        response?.error || t("aiFailedToGetSuggestions", "Failed to get suggestions")
      aiSuggestStatus.className = "ai-suggest-status error"
    }
  } catch (error) {
    console.error("Error suggesting groups:", error)
    aiSuggestStatus.textContent = t("aiFailedToGetSuggestions", "Failed to get suggestions")
    aiSuggestStatus.className = "ai-suggest-status error"
  } finally {
    aiSuggestButton.disabled = false
  }
}

function renderSuggestions(
  suggestions: readonly AiGroupSuggestion[],
  appliedIndices: readonly number[] = []
): void {
  aiSuggestionsContainer.innerHTML = ""

  if (suggestions.length === 0) {
    aiSuggestStatus.textContent = t("aiNoSuggestions", "No suggestions found")
    aiSuggestStatus.className = "ai-suggest-status"
    return
  }

  const dismissBtn = document.createElement("button")
  dismissBtn.className = "suggestion-dismiss-btn"
  dismissBtn.textContent = t("aiDismiss", "Dismiss")
  dismissBtn.addEventListener("click", async () => {
    await cachedAiSuggestions.setValue(null)
    aiSuggestionsContainer.innerHTML = ""
  })
  aiSuggestionsContainer.appendChild(dismissBtn)

  for (const [index, suggestion] of suggestions.entries()) {
    const isApplied = appliedIndices.includes(index)
    const card = document.createElement("div")
    card.className = `suggestion-card${isApplied ? " applied" : ""}`
    const colorHex = RULE_COLORS[suggestion.color] || RULE_COLORS.blue
    card.style.borderLeftColor = colorHex

    const header = document.createElement("div")
    header.className = "suggestion-header"

    const colorDot = document.createElement("span")
    colorDot.className = "suggestion-color-dot"
    colorDot.style.backgroundColor = colorHex

    const name = document.createElement("span")
    name.className = "suggestion-name"
    name.textContent = suggestion.groupName

    const tabCount = document.createElement("span")
    tabCount.className = "suggestion-tab-count"
    const plural = suggestion.tabs.length !== 1 ? "s" : ""
    tabCount.textContent = t("aiTabsCount", `${suggestion.tabs.length} tab${plural}`, [
      String(suggestion.tabs.length),
      plural
    ])

    header.appendChild(colorDot)
    header.appendChild(name)
    header.appendChild(tabCount)

    const tabsList = document.createElement("div")
    tabsList.className = "suggestion-tabs"

    for (const tab of suggestion.tabs) {
      const tabEl = document.createElement("div")
      tabEl.className = "suggestion-tab"
      tabEl.textContent = tab.title || tab.url
      tabEl.title = tab.url
      tabsList.appendChild(tabEl)
    }

    const actions = document.createElement("div")
    actions.className = "suggestion-actions"

    const applyBtn = document.createElement("button")
    applyBtn.className = `suggestion-apply-btn${isApplied ? " applied" : ""}`
    applyBtn.textContent = isApplied ? t("aiApplied", "Applied!") : t("aiApply", "Apply")
    applyBtn.disabled = isApplied
    if (!isApplied) {
      applyBtn.addEventListener("click", () => handleApplySuggestion(suggestion, applyBtn))
    }

    const ruleBtn = document.createElement("button")
    ruleBtn.className = "suggestion-rule-btn"
    ruleBtn.textContent = t("aiCreateRule", "Create Rule")
    ruleBtn.addEventListener("click", () => createRuleFromSuggestion(suggestion))

    actions.appendChild(applyBtn)
    actions.appendChild(ruleBtn)

    card.appendChild(header)
    card.appendChild(tabsList)
    card.appendChild(actions)
    aiSuggestionsContainer.appendChild(card)
  }
}

async function handleApplySuggestion(
  suggestion: AiGroupSuggestion,
  button: HTMLButtonElement
): Promise<void> {
  button.disabled = true
  button.textContent = t("aiApplying", "Applying...")

  try {
    const response = await sendMessage<{
      success?: boolean
      groupId?: number
      error?: string
      staleTabIds?: number[]
    }>({
      action: "applySuggestion",
      suggestion
    })

    if (response?.success) {
      button.textContent = t("aiApplied", "Applied!")
      button.classList.add("applied")
      if (response.staleTabIds && response.staleTabIds.length > 0) {
        const count = response.staleTabIds.length
        const plural = count !== 1 ? "s" : ""
        button.textContent = t("aiAppliedWithStale", `Applied (${count} tab${plural} closed)`, [
          String(count),
          plural
        ])
      }
    } else {
      button.textContent = t("aiFailed", "Failed")
      button.disabled = false
      console.error("Failed to apply suggestion:", response?.error)
    }
  } catch (error) {
    console.error("Error applying suggestion:", error)
    button.textContent = t("aiFailed", "Failed")
    button.disabled = false
  }
}

async function createRuleFromSuggestion(suggestion: AiGroupSuggestion): Promise<void> {
  try {
    const domains = [
      ...new Set(
        suggestion.tabs
          .map(tab => {
            try {
              return new URL(tab.url).hostname
            } catch {
              return null
            }
          })
          .filter((d): d is string => d !== null)
      )
    ]

    const params = new URLSearchParams({
      fromGroup: "true",
      name: suggestion.groupName,
      color: suggestion.color,
      domains: domains.join(",")
    })
    const url = browser.runtime.getURL(`/rules-modal.html?${params.toString()}`)
    const cached = await cachedAiSuggestions.getValue()
    if (cached) {
      const remaining = cached.suggestions.filter(
        s => s.groupName.toLowerCase() !== suggestion.groupName.toLowerCase()
      )
      if (remaining.length === 0) {
        await cachedAiSuggestions.setValue(null)
      } else {
        await cachedAiSuggestions.setValue({
          ...cached,
          suggestions: remaining,
          appliedIndices: []
        })
      }
    }
    await browser.tabs.create({ url, active: true })
  } catch (error) {
    console.error("Error creating rule from suggestion:", error)
  }
}

// AI Event Listeners
aiToggle?.addEventListener("click", toggleAiSection)

aiEnabledToggle?.addEventListener("change", async () => {
  const enabled = aiEnabledToggle.checked
  await sendMessage({ action: "setAiEnabled", enabled })
  updateAiSettingsVisibility(enabled)
  updateAiBadge(enabled)
})

aiModelSelect?.addEventListener("change", async () => {
  await sendMessage({ action: "setAiModelId", modelId: aiModelSelect.value })
})

aiSuggestButton?.addEventListener("click", handleSuggestGroups)

aiLoadButton?.addEventListener("click", async () => {
  const response = await sendMessage<{
    modelStatus?: { status: string; progress: number; error: string | null }
  }>({ action: "getAiModelStatus" })

  if (response?.modelStatus?.status === "ready") {
    await sendMessage({ action: "unloadAiModel" })
    updateAiModelStatus({ status: "idle", progress: 0, error: null })
  } else {
    await sendMessage({ action: "loadAiModel" })
    updateAiModelStatus({ status: "loading", progress: 0, error: null })
  }
})

// Custom Rules event listeners
rulesToggle?.addEventListener("click", toggleRulesSection)
addRuleButton?.addEventListener("click", addRule)
exportRulesButton?.addEventListener("click", exportRules)
importRulesButton?.addEventListener("click", importRules)

// Blacklist event listeners
blacklistToggle?.addEventListener("click", toggleBlacklistSection)
addBlacklistButton?.addEventListener("click", addBlacklistRule)

// Advanced section toggle
function toggleAdvancedSection(): void {
  advancedExpanded = !advancedExpanded
  advancedToggle.classList.toggle("expanded", advancedExpanded)
  advancedContent.classList.toggle("expanded", advancedExpanded)
}

advancedToggle?.addEventListener("click", toggleAdvancedSection)

// Initialize hide context menu state
sendMessage<{ enabled?: boolean }>({ action: "getHideContextMenu" }).then(response => {
  hideContextMenuToggle.checked = response?.enabled ?? false
})

// Hide context menu event listener
hideContextMenuToggle?.addEventListener("change", event => {
  sendMessage({
    action: "toggleHideContextMenu",
    enabled: (event.target as HTMLInputElement).checked
  })
})

// Initialize AI badge on popup open
sendMessage<{
  settings?: { aiEnabled: boolean }
}>({ action: "getAiState" }).then(response => {
  if (response?.settings) {
    updateAiBadge(response.settings.aiEnabled)
  }
})

// Load cached AI suggestions on popup open
async function loadCachedSuggestions(): Promise<void> {
  const cached = await cachedAiSuggestions.getValue()
  if (!cached || cached.suggestions.length === 0) return

  const THIRTY_MINUTES = 30 * 60 * 1000
  if (Date.now() - cached.timestamp > THIRTY_MINUTES) {
    await cachedAiSuggestions.setValue(null)
    return
  }

  renderSuggestions(cached.suggestions, cached.appliedIndices)
}
// Gate initial dynamic loads on i18n readiness so JS-rendered strings
// (Edit/Delete buttons, empty state, truncation suffix, etc.) render in the
// user's chosen locale on first paint. Subsequent calls (from event handlers)
// already run after i18nReady has resolved.
i18nReady.then(() => {
  loadCachedSuggestions()
  loadCustomRules()
})
