/**
 * Rules Modal JavaScript for managing custom tab grouping rules
 */

// Browser API compatibility
const browserAPI = typeof browser !== "undefined" ? browser : chrome

// Color definitions (copied from RulesUtils to avoid import issues)
const RULE_COLORS = [
  { name: "Blue", value: "blue", hex: "#4285f4" },
  { name: "Red", value: "red", hex: "#ea4335" },
  { name: "Yellow", value: "yellow", hex: "#fbbc04" },
  { name: "Green", value: "green", hex: "#34a853" },
  { name: "Pink", value: "pink", hex: "#ff6d9d" },
  { name: "Purple", value: "purple", hex: "#9c27b0" },
  { name: "Cyan", value: "cyan", hex: "#00acc1" },
  { name: "Orange", value: "orange", hex: "#ff9800" },
]

// Utility functions
function parseDomainsText(domainsText) {
  if (!domainsText || typeof domainsText !== "string") {
    return []
  }

  return domainsText
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0)
    .filter((domain, index, arr) => arr.indexOf(domain) === index) // Remove duplicates
}

class RulesModal {
  constructor() {
    this.isEdit = false
    this.ruleId = null
    this.currentRule = null
    this.selectedColor = "blue"

    this.initializeElements()
    this.initializeEventListeners()
    this.populateColorSelector()
    this.loadRuleData()
  }

  initializeElements() {
    this.form = document.getElementById("ruleForm")
    this.modalTitle = document.getElementById("modalTitle")
    this.nameInput = document.getElementById("ruleName")
    this.domainsInput = document.getElementById("ruleDomains")
    this.enabledCheckbox = document.getElementById("ruleEnabled")
    this.colorSelector = document.getElementById("colorSelector")
    this.saveButton = document.getElementById("saveButton")
    this.cancelButton = document.getElementById("cancelButton")
    this.nameError = document.getElementById("nameError")
    this.domainsError = document.getElementById("domainsError")
  }

  initializeEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e))
    this.cancelButton.addEventListener("click", () => this.handleCancel())
    this.nameInput.addEventListener("input", () => this.clearFieldError("name"))
    this.domainsInput.addEventListener("input", () => this.clearFieldError("domains"))

    // Real-time validation
    this.nameInput.addEventListener("blur", () => this.validateField("name"))
    this.domainsInput.addEventListener("blur", () => this.validateField("domains"))
  }

  populateColorSelector() {
    this.colorSelector.innerHTML = ""

    RULE_COLORS.forEach((color) => {
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
    this.colorSelector.querySelectorAll(".color-option").forEach((option) => {
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

  async loadExistingRule() {
    try {
      const response = await this.sendMessage({
        action: "getCustomRules",
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
    this.populateColorSelector()
  }

  async handleSubmit(e) {
    e.preventDefault()

    if (!this.validateForm()) {
      return
    }

    const ruleData = this.collectFormData()

    try {
      this.saveButton.disabled = true
      this.saveButton.textContent = "Saving..."

      const action = this.isEdit ? "updateCustomRule" : "addCustomRule"
      const message = {
        action,
        ruleData,
      }

      if (this.isEdit) {
        message.ruleId = this.ruleId
      }

      const response = await this.sendMessage(message)

      if (response && response.success) {
        // Close modal and refresh parent
        window.close()
      } else {
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

    return {
      name: this.nameInput.value.trim(),
      domains: domains,
      color: this.selectedColor,
      enabled: this.enabledCheckbox.checked,
      priority: 1, // Default priority
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
      this.showFieldError("domains", "At least one domain is required")
      return false
    }

    const domains = parseDomainsText(domainsText)

    if (domains.length === 0) {
      this.showFieldError("domains", "No valid domains found")
      return false
    }

    if (domains.length > 20) {
      this.showFieldError("domains", "Maximum 20 domains per rule")
      return false
    }

    // Validate each domain format
    const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    for (const domain of domains) {
      if (!domainPattern.test(domain)) {
        this.showFieldError("domains", `Invalid domain format: ${domain}`)
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
    return new Promise((resolve) => {
      browserAPI.runtime.sendMessage(message, resolve)
    })
  }
}

// Initialize the modal when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new RulesModal()
})
