/**
 * Rules Modal JavaScript for managing custom tab grouping rules
 */

// Import utilities from DomainUtils and RulesUtils
import { extractDomain, validateStrictDomain } from "../utils/DomainUtils.js"
import {
  isIPv4Address,
  validateRulePattern,
  RULE_COLORS,
  parseDomainsText
} from "../utils/RulesUtils.js"

// Browser API compatibility
const browserAPI = typeof browser !== "undefined" ? browser : chrome

// Helper function to convert validateStrictDomain to boolean (for backward compatibility)
function isValidStrictDomain(domain) {
  const result = validateStrictDomain(domain)
  return result.isValid
}

class RulesModal {
  constructor() {
    this.isEdit = false
    this.ruleId = null
    this.currentRule = null
    this.selectedColor = "blue"
    this.currentTabs = []
    this.selectedDomains = new Set()

    this.initializeElements()
    this.initializeEventListeners()
    this.populateColorSelector()
    this.loadCurrentTabs()
    this.loadGlobalMinimumTabs()
    this.loadRuleData()
  }

  initializeElements() {
    this.form = document.getElementById("ruleForm")
    this.modalTitle = document.getElementById("modalTitle")
    this.nameInput = document.getElementById("ruleName")
    this.domainsInput = document.getElementById("ruleDomains")
    this.enabledCheckbox = document.getElementById("ruleEnabled")
    this.colorSelector = document.getElementById("colorSelector")
    this.minimumTabsInput = document.getElementById("minimumTabsInput")
    this.minimumTabsHelp = document.getElementById("minimumTabsHelp")
    this.saveButton = document.getElementById("saveButton")
    this.cancelButton = document.getElementById("cancelButton")
    this.nameError = document.getElementById("nameError")
    this.domainsError = document.getElementById("domainsError")
    this.refreshTabsBtn = document.getElementById("refreshTabsBtn")
    this.currentTabsContainer = document.getElementById("currentTabsContainer")
    this.tabsActionsContainer = document.getElementById("tabsActionsContainer")
  }

  initializeEventListeners() {
    this.form.addEventListener("submit", e => this.handleSubmit(e))
    this.cancelButton.addEventListener("click", () => this.handleCancel())
    this.nameInput.addEventListener("input", () => this.clearFieldError("name"))
    this.domainsInput.addEventListener("input", () => this.clearFieldError("domains"))

    // Real-time validation
    this.nameInput.addEventListener("blur", () => this.validateField("name"))
    this.domainsInput.addEventListener("blur", () => this.validateField("domains"))

    // Current tabs events
    this.refreshTabsBtn.addEventListener("click", () => this.loadCurrentTabs())

    // Action buttons event listeners
    this.initializeActionButtons()
  }

  /**
   * Initialize action buttons event listeners
   */
  initializeActionButtons() {
    const selectAllBtn = document.getElementById("selectAllBtn")
    const clearAllBtn = document.getElementById("clearAllBtn")
    const addSelectedBtn = document.getElementById("addSelectedBtn")

    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => this.selectAllDomains())
    }
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => this.clearAllDomains())
    }
    if (addSelectedBtn) {
      addSelectedBtn.addEventListener("click", () => this.addSelectedToTextarea())
    }
  }

  populateColorSelector() {
    this.colorSelector.innerHTML = ""

    RULE_COLORS.forEach(color => {
      const colorOption = document.createElement("div")
      colorOption.className = "color-option"
      colorOption.style.backgroundColor = color.hex
      colorOption.dataset.color = color.value
      colorOption.title = color.name

      if (color.value === this.selectedColor) {
        colorOption.classList.add("selected")
      }

      colorOption.addEventListener("click", () => this.selectColor(color.value))
      this.colorSelector.appendChild(colorOption)
    })
  }

  selectColor(colorValue) {
    this.selectedColor = colorValue

    // Update visual selection
    this.colorSelector.querySelectorAll(".color-option").forEach(option => {
      option.classList.toggle("selected", option.dataset.color === colorValue)
    })
  }

  loadRuleData() {
    // Get data passed from parent window
    const params = new URLSearchParams(window.location.search)
    this.isEdit = params.get("edit") === "true"
    this.ruleId = params.get("ruleId")

    if (this.isEdit && this.ruleId) {
      this.modalTitle.textContent = "Edit Rule"
      this.saveButton.textContent = "Update Rule"
      this.loadExistingRule()
    } else {
      this.modalTitle.textContent = "Add New Rule"
      this.saveButton.textContent = "Save Rule"
    }
  }

  async loadGlobalMinimumTabs() {
    try {
      const response = await this.sendMessage({
        action: "getMinimumTabsForGroup"
      })

      const globalMinimum = response.minimumTabs || 1
      this.minimumTabsHelp.textContent = `Leave empty to use global setting (currently: ${globalMinimum} tab${globalMinimum === 1 ? "" : "s"})`
    } catch (error) {
      console.error("Error loading global minimum tabs:", error)
      // Keep default text if loading fails
    }
  }

  async loadExistingRule() {
    try {
      const response = await this.sendMessage({
        action: "getCustomRules"
      })

      if (response && response.customRules && response.customRules[this.ruleId]) {
        this.currentRule = response.customRules[this.ruleId]
        this.populateForm(this.currentRule)
      } else {
        this.showError("Rule not found")
      }
    } catch (error) {
      console.error("Error loading rule:", error)
      this.showError("Failed to load rule data")
    }
  }

  populateForm(rule) {
    this.nameInput.value = rule.name || ""
    this.domainsInput.value = (rule.domains || []).join("\n")
    this.enabledCheckbox.checked = rule.enabled !== false
    this.selectedColor = rule.color || "blue"
    // Handle minimumTabs properly - don't use || operator since 0 is falsy
    this.minimumTabsInput.value =
      rule.minimumTabs !== null && rule.minimumTabs !== undefined ? rule.minimumTabs : ""
    this.populateColorSelector()
  }

  async handleSubmit(e) {
    e.preventDefault()
    console.log("[RulesModal] Form submitted")

    if (!this.validateForm()) {
      console.log("[RulesModal] Form validation failed")
      return
    }

    const ruleData = this.collectFormData()
    console.log("[RulesModal] Collected rule data:", ruleData)

    try {
      this.saveButton.disabled = true
      this.saveButton.textContent = "Saving..."

      const action = this.isEdit ? "updateCustomRule" : "addCustomRule"
      const message = {
        action,
        ruleData
      }

      if (this.isEdit) {
        message.ruleId = this.ruleId
      }

      console.log("[RulesModal] About to send message:", message)
      const response = await this.sendMessage(message)

      if (response && response.success) {
        console.log("[RulesModal] Rule saved successfully, closing modal")
        // Close modal and refresh parent
        window.close()
      } else {
        console.error("[RulesModal] Save failed:", response)
        this.showError(response?.error || "Failed to save rule")
      }
    } catch (error) {
      console.error("Error saving rule:", error)
      this.showError("Failed to save rule")
    } finally {
      this.saveButton.disabled = false
      this.saveButton.textContent = this.isEdit ? "Update Rule" : "Save Rule"
    }
  }

  collectFormData() {
    const domains = parseDomainsText(this.domainsInput.value)
    const minimumTabsValue = this.minimumTabsInput.value.trim()

    return {
      name: this.nameInput.value.trim(),
      domains: domains,
      color: this.selectedColor,
      enabled: this.enabledCheckbox.checked,
      priority: 1, // Default priority
      minimumTabs: minimumTabsValue ? parseInt(minimumTabsValue) : null
    }
  }

  validateForm() {
    let isValid = true

    // Validate name
    if (!this.validateField("name")) {
      isValid = false
    }

    // Validate domains
    if (!this.validateField("domains")) {
      isValid = false
    }

    return isValid
  }

  validateField(fieldName) {
    switch (fieldName) {
      case "name":
        return this.validateName()
      case "domains":
        return this.validateDomains()
      default:
        return true
    }
  }

  validateName() {
    const name = this.nameInput.value.trim()

    if (!name) {
      this.showFieldError("name", "Rule name is required")
      return false
    }

    if (name.length > 50) {
      this.showFieldError("name", "Rule name cannot exceed 50 characters")
      return false
    }

    // Check for valid characters
    const namePattern = /^[a-zA-Z0-9\s\-_()&.!?]+$/
    if (!namePattern.test(name)) {
      this.showFieldError("name", "Rule name contains invalid characters")
      return false
    }

    this.clearFieldError("name")
    return true
  }

  validateDomains() {
    const domainsText = this.domainsInput.value.trim()

    if (!domainsText) {
      this.showFieldError("domains", "At least one pattern is required")
      return false
    }

    const domains = parseDomainsText(domainsText)

    if (domains.length === 0) {
      this.showFieldError("domains", "No valid patterns found")
      return false
    }

    if (domains.length > 20) {
      this.showFieldError("domains", "Maximum 20 patterns per rule")
      return false
    }

    // Validate each pattern format (support domain, IP, and URL patterns)
    for (const pattern of domains) {
      const validation = validateRulePattern(pattern)
      if (!validation.isValid) {
        this.showFieldError("domains", `Invalid pattern: ${pattern} - ${validation.error}`)
        return false
      }
    }

    this.clearFieldError("domains")
    return true
  }

  showFieldError(fieldName, message) {
    const errorElement = fieldName === "name" ? this.nameError : this.domainsError
    errorElement.textContent = message
    errorElement.style.display = "block"

    const inputElement = fieldName === "name" ? this.nameInput : this.domainsInput
    inputElement.style.borderColor = "#e53e3e"
  }

  clearFieldError(fieldName) {
    const errorElement = fieldName === "name" ? this.nameError : this.domainsError
    errorElement.style.display = "none"

    const inputElement = fieldName === "name" ? this.nameInput : this.domainsInput
    inputElement.style.borderColor = "#e2e8f0"
  }

  showError(message) {
    // Could add a general error display area
    alert(message) // Temporary - could be improved with a better UI
  }

  handleCancel() {
    window.close()
  }

  sendMessage(message) {
    console.log("[RulesModal] Sending message:", message)
    return new Promise((resolve, reject) => {
      try {
        browserAPI.runtime.sendMessage(message, response => {
          if (browserAPI.runtime.lastError) {
            console.error("[RulesModal] Message error:", browserAPI.runtime.lastError)
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            console.log("[RulesModal] Message response:", response)
            resolve(response)
          }
        })
      } catch (error) {
        console.error("[RulesModal] Failed to send message:", error)
        reject(error)
      }
    })
  }

  /**
   * Load and display current tabs for easy domain selection
   */
  async loadCurrentTabs() {
    try {
      // Clear container and show loading
      this.currentTabsContainer.innerHTML = ""
      const loadingDiv = document.createElement("div")
      loadingDiv.className = "loading-tabs"
      loadingDiv.textContent = "Loading current tabs..."
      this.currentTabsContainer.appendChild(loadingDiv)

      // Get all tabs in the current window
      const tabs = await browserAPI.tabs.query({})

      // Extract domains and group by domain with tab counts
      const domainCounts = new Map()
      const domainTitles = new Map() // Store representative titles

      tabs.forEach(tab => {
        // Use extractDomain utility to properly handle all URL types
        // Include subdomains for better domain suggestions (e.g., "addons.mozilla.org" not just "mozilla.org")
        const domain = extractDomain(tab.url, true)

        // Skip invalid domains, system domains, and domains/IPs that don't pass validation
        if (
          !domain ||
          domain === "system" ||
          (!isValidStrictDomain(domain) && !isIPv4Address(domain))
        ) {
          return
        }

        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
        if (!domainTitles.has(domain)) {
          domainTitles.set(domain, tab.title || domain)
        }
      })

      this.currentTabs = Array.from(domainCounts.entries())
        .map(([domain, count]) => ({
          domain,
          count,
          title: domainTitles.get(domain)
        }))
        .sort((a, b) => {
          // Sort by count descending, then alphabetically
          if (a.count !== b.count) return b.count - a.count
          return a.domain.localeCompare(b.domain)
        })

      this.renderCurrentTabs()
    } catch (error) {
      console.error("Error loading current tabs:", error)
      this.currentTabsContainer.innerHTML = ""
      const errorDiv = document.createElement("div")
      errorDiv.className = "empty-tabs"
      errorDiv.textContent = "Failed to load current tabs"
      this.currentTabsContainer.appendChild(errorDiv)
    }
  }

  /**
   * Render the current tabs list
   */
  renderCurrentTabs() {
    if (this.currentTabs.length === 0) {
      this.currentTabsContainer.innerHTML = ""
      const emptyDiv = document.createElement("div")
      emptyDiv.className = "empty-tabs"
      emptyDiv.textContent = "No tabs found"
      this.currentTabsContainer.appendChild(emptyDiv)
      this.tabsActionsContainer.style.display = "none"
      return
    }

    // Clear the container
    this.currentTabsContainer.innerHTML = ""

    // Create DOM elements safely
    this.currentTabs.forEach(tab => {
      const isSelected = this.selectedDomains.has(tab.domain)

      const tabItem = document.createElement("div")
      tabItem.className = `tab-domain-item ${isSelected ? "selected" : ""}`
      tabItem.setAttribute("data-domain", tab.domain)

      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.className = "tab-domain-checkbox"
      checkbox.setAttribute("data-domain", tab.domain)
      if (isSelected) {
        checkbox.checked = true
      }

      const domainInfo = document.createElement("div")
      domainInfo.className = "tab-domain-info"

      const domainName = document.createElement("div")
      domainName.className = "tab-domain-name"
      domainName.title = tab.domain
      domainName.textContent = tab.domain

      const tabCount = document.createElement("div")
      tabCount.className = "tab-count"
      tabCount.textContent = `${tab.count} tab${tab.count === 1 ? "" : "s"}`

      domainInfo.appendChild(domainName)
      domainInfo.appendChild(tabCount)

      tabItem.appendChild(checkbox)
      tabItem.appendChild(domainInfo)

      this.currentTabsContainer.appendChild(tabItem)
    })

    this.tabsActionsContainer.style.display = "flex"

    // Add event listeners for the dynamically created elements
    this.addCurrentTabsEventListeners()
  }

  /**
   * Add event listeners for dynamically created current tabs elements
   */
  addCurrentTabsEventListeners() {
    // Add event listeners for checkboxes and domain items
    const checkboxes = this.currentTabsContainer.querySelectorAll(".tab-domain-checkbox")
    const domainItems = this.currentTabsContainer.querySelectorAll(".tab-domain-item")

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener("change", e => {
        const domain = e.target.dataset.domain
        if (domain) {
          this.toggleDomainSelection(domain)
        }
      })
    })

    domainItems.forEach(item => {
      item.addEventListener("click", e => {
        // Don't trigger if clicking on the checkbox itself
        if (e.target.type === "checkbox") return

        const domain = item.dataset.domain
        if (domain) {
          this.toggleDomainSelection(domain)
        }
      })
    })
  }

  /**
   * Toggle domain selection
   */
  toggleDomainSelection(domain) {
    if (this.selectedDomains.has(domain)) {
      this.selectedDomains.delete(domain)
    } else {
      this.selectedDomains.add(domain)
    }
    this.renderCurrentTabs()
  }

  /**
   * Select all domains
   */
  selectAllDomains() {
    this.currentTabs.forEach(tab => {
      this.selectedDomains.add(tab.domain)
    })
    this.renderCurrentTabs()
  }

  /**
   * Clear all domain selections
   */
  clearAllDomains() {
    this.selectedDomains.clear()
    this.renderCurrentTabs()
  }

  /**
   * Add selected domains to the textarea
   */
  addSelectedToTextarea() {
    if (this.selectedDomains.size === 0) {
      return
    }

    const currentDomains = parseDomainsText(this.domainsInput.value)
    const allDomains = new Set([...currentDomains, ...this.selectedDomains])

    this.domainsInput.value = Array.from(allDomains).sort().join("\n")

    // Suggest a rule name if the name field is empty
    if (!this.nameInput.value.trim() && this.selectedDomains.size > 0) {
      this.suggestRuleName()
    }

    // Clear selections after adding
    this.selectedDomains.clear()
    this.renderCurrentTabs()

    // Trigger validation
    this.validateField("domains")
  }

  /**
   * Suggest a rule name based on selected domains
   */
  suggestRuleName() {
    const domains = Array.from(this.selectedDomains)

    // Common domain patterns and suggested names
    const suggestions = {
      // Communication
      communication: [
        "discord.com",
        "slack.com",
        "teams.microsoft.com",
        "zoom.us",
        "meet.google.com",
        "skype.com"
      ],
      // Development
      development: [
        "github.com",
        "gitlab.com",
        "stackoverflow.com",
        "developer.mozilla.org",
        "codepen.io"
      ],
      // Social Media
      social: [
        "facebook.com",
        "twitter.com",
        "instagram.com",
        "linkedin.com",
        "reddit.com",
        "tiktok.com"
      ],
      // Google Services
      google: [
        "google.com",
        "gmail.com",
        "drive.google.com",
        "docs.google.com",
        "calendar.google.com"
      ],
      // Shopping
      shopping: ["amazon.com", "ebay.com", "etsy.com", "shopify.com", "walmart.com"],
      // News
      news: ["cnn.com", "bbc.com", "reuters.com", "nytimes.com", "techcrunch.com"],
      // Entertainment
      entertainment: ["youtube.com", "netflix.com", "spotify.com", "twitch.tv", "hulu.com"]
    }

    // Find the best matching category
    let bestMatch = { category: "", score: 0 }

    for (const [category, categoryDomains] of Object.entries(suggestions)) {
      const matchCount = domains.filter(domain =>
        categoryDomains.some(catDomain => domain.includes(catDomain.replace(".com", "")))
      ).length

      const score = matchCount / domains.length // Percentage of matches

      if (score > bestMatch.score && score >= 0.5) {
        // At least 50% match
        bestMatch = { category, score }
      }
    }

    if (bestMatch.category) {
      // Capitalize first letter
      const suggestion = bestMatch.category.charAt(0).toUpperCase() + bestMatch.category.slice(1)
      this.nameInput.value = suggestion
      this.nameInput.style.backgroundColor = "#f0fff4" // Light green hint

      // Remove the hint after a few seconds
      setTimeout(() => {
        this.nameInput.style.backgroundColor = ""
      }, 3000)
    }
  }
}

// Initialize the modal when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new RulesModal()
})
