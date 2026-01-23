import "./style.css"
import type { RuleData, TabGroupColor } from "../../types"

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search)
const isEditMode = urlParams.get("edit") === "true"
const ruleId = urlParams.get("ruleId")

// DOM Elements
const modalTitle = document.getElementById("modalTitle") as HTMLHeadingElement
const ruleForm = document.getElementById("ruleForm") as HTMLFormElement
const ruleNameInput = document.getElementById("ruleName") as HTMLInputElement
const rulePatternsInput = document.getElementById("rulePatterns") as HTMLTextAreaElement
const ruleColorSelect = document.getElementById("ruleColor") as HTMLSelectElement
const ruleEnabledCheckbox = document.getElementById("ruleEnabled") as HTMLInputElement
const saveButton = document.getElementById("saveButton") as HTMLButtonElement
const cancelButton = document.getElementById("cancelButton") as HTMLButtonElement

// Helper function for sending messages
function sendMessage<T = Record<string, unknown>>(message: Record<string, unknown>): Promise<T> {
  return new Promise(resolve => {
    browser.runtime.sendMessage(message, resolve)
  })
}

// Load existing rule for editing
async function loadExistingRule(): Promise<void> {
  if (!isEditMode || !ruleId) return

  modalTitle.textContent = "Edit Custom Rule"
  saveButton.textContent = "Update Rule"

  try {
    const response = await sendMessage<{
      customRules?: Record<string, RuleData>
    }>({
      action: "getCustomRules"
    })

    if (response?.customRules?.[ruleId]) {
      const rule = response.customRules[ruleId]
      ruleNameInput.value = rule.name
      rulePatternsInput.value = rule.domains.join("\n")
      ruleColorSelect.value = rule.color || "blue"
      ruleEnabledCheckbox.checked = rule.enabled !== false
    }
  } catch (error) {
    console.error("Error loading rule:", error)
    alert("Failed to load rule for editing")
  }
}

// Save rule
async function saveRule(event: Event): Promise<void> {
  event.preventDefault()

  const name = ruleNameInput.value.trim()
  const patterns = rulePatternsInput.value
    .split("\n")
    .map(p => p.trim())
    .filter(p => p)
  const color = ruleColorSelect.value as TabGroupColor
  const enabled = ruleEnabledCheckbox.checked

  if (!name) {
    alert("Please enter a rule name")
    return
  }

  if (patterns.length === 0) {
    alert("Please enter at least one URL pattern")
    return
  }

  const ruleData: RuleData = {
    name,
    domains: patterns,
    color,
    enabled,
    priority: 1
  }

  try {
    let response: { success?: boolean; error?: string }

    if (isEditMode && ruleId) {
      response = await sendMessage({
        action: "updateCustomRule",
        ruleId,
        ruleData
      })
    } else {
      response = await sendMessage({
        action: "addCustomRule",
        ruleData
      })
    }

    if (response?.success) {
      window.close()
    } else {
      alert(response?.error || "Failed to save rule")
    }
  } catch (error) {
    console.error("Error saving rule:", error)
    alert(`Failed to save rule: ${(error as Error).message}`)
  }
}

// Cancel and close
function cancel(): void {
  window.close()
}

// Initialize
loadExistingRule()

// Event listeners
ruleForm.addEventListener("submit", saveRule)
cancelButton.addEventListener("click", cancel)
