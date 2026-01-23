import "./style.css"
import type { RuleData } from "../../types"

// DOM Elements
const dropZone = document.getElementById("dropZone") as HTMLDivElement
const selectFileButton = document.getElementById("selectFileButton") as HTMLButtonElement
const fileInput = document.getElementById("fileInput") as HTMLInputElement
const fileInfo = document.getElementById("fileInfo") as HTMLDivElement
const fileName = document.getElementById("fileName") as HTMLSpanElement
const clearFile = document.getElementById("clearFile") as HTMLButtonElement
const previewSection = document.getElementById("previewSection") as HTMLDivElement
const previewStats = document.getElementById("previewStats") as HTMLDivElement
const previewList = document.getElementById("previewList") as HTMLDivElement
const previewErrors = document.getElementById("previewErrors") as HTMLDivElement
const importOptions = document.getElementById("importOptions") as HTMLDivElement
const importButton = document.getElementById("importButton") as HTMLButtonElement
const cancelButton = document.getElementById("cancelButton") as HTMLButtonElement
const resultMessage = document.getElementById("resultMessage") as HTMLDivElement

// State
let rawJsonData: string | null = null

// Helper function for sending messages (same pattern as rules-modal)
function sendMessage<T = Record<string, unknown>>(message: Record<string, unknown>): Promise<T> {
  return new Promise(resolve => {
    browser.runtime.sendMessage(message, resolve)
  })
}

// DOM helper functions for safe rendering (no innerHTML)
function createStatElement(value: number, label: string, isWarning = false): HTMLDivElement {
  const stat = document.createElement("div")
  stat.className = isWarning ? "stat warning" : "stat"

  const statValue = document.createElement("span")
  statValue.className = "stat-value"
  statValue.textContent = String(value)

  const statLabel = document.createElement("span")
  statLabel.className = "stat-label"
  statLabel.textContent = label

  stat.appendChild(statValue)
  stat.appendChild(statLabel)

  return stat
}

function createPreviewRuleElement(rule: RuleData): HTMLDivElement {
  const ruleDiv = document.createElement("div")
  ruleDiv.className = "preview-rule"

  const nameSpan = document.createElement("span")
  nameSpan.className = "preview-rule-name"
  nameSpan.textContent = rule.name || "Unnamed"

  const domainsSpan = document.createElement("span")
  domainsSpan.className = "preview-rule-domains"
  domainsSpan.textContent = `${rule.domains?.length || 0} patterns`

  ruleDiv.appendChild(nameSpan)
  ruleDiv.appendChild(domainsSpan)

  return ruleDiv
}

function createMoreRulesElement(additionalCount: number): HTMLDivElement {
  const moreDiv = document.createElement("div")
  moreDiv.className = "preview-more"
  moreDiv.textContent = `...and ${additionalCount} more rules`
  return moreDiv
}

// File handling
function handleFile(file: File): void {
  if (!file.name.endsWith(".json")) {
    showError("Please select a JSON file")
    return
  }

  fileName.textContent = file.name
  fileInfo.style.display = "flex"
  dropZone.classList.add("has-file")

  file
    .text()
    .then(text => {
      rawJsonData = text
      parseAndPreviewRules(text)
    })
    .catch(error => {
      showError(`Error reading file: ${(error as Error).message}`)
    })
}

function parseAndPreviewRules(jsonText: string): void {
  try {
    const data = JSON.parse(jsonText) as { rules?: Record<string, RuleData> }

    if (!data.rules || typeof data.rules !== "object") {
      showError("Invalid file format: Missing 'rules' property")
      return
    }

    const parsedRules = data.rules
    const ruleCount = Object.keys(parsedRules).length

    if (ruleCount === 0) {
      showError("No rules found in file")
      return
    }

    // Show preview
    displayPreview(parsedRules)
    previewSection.style.display = "block"
    importOptions.style.display = "block"
    importButton.disabled = false
    clearError()
  } catch (error) {
    showError(`Invalid JSON: ${(error as Error).message}`)
  }
}

function displayPreview(rules: Record<string, RuleData>): void {
  const ruleArray = Object.values(rules)
  const validRules = ruleArray.filter(r => r.name && r.domains?.length > 0)
  const invalidCount = ruleArray.length - validRules.length

  // Stats - using DOM manipulation instead of innerHTML
  previewStats.replaceChildren()
  previewStats.appendChild(createStatElement(validRules.length, "Valid Rules"))

  if (invalidCount > 0) {
    previewStats.appendChild(createStatElement(invalidCount, "Invalid (will be skipped)", true))
  }

  // Rule list preview (show first 5) - using DOM manipulation
  previewList.replaceChildren()
  const previewRules = validRules.slice(0, 5)

  for (const rule of previewRules) {
    previewList.appendChild(createPreviewRuleElement(rule))
  }

  if (validRules.length > 5) {
    previewList.appendChild(createMoreRulesElement(validRules.length - 5))
  }
}

function showError(message: string): void {
  previewErrors.textContent = message
  previewErrors.style.display = "block"
  previewSection.style.display = "block"
  importButton.disabled = true
}

function clearError(): void {
  previewErrors.style.display = "none"
  previewErrors.textContent = ""
}

function resetForm(): void {
  rawJsonData = null
  fileInput.value = ""
  fileInfo.style.display = "none"
  dropZone.classList.remove("has-file")
  previewSection.style.display = "none"
  importOptions.style.display = "none"
  importButton.disabled = true
  resultMessage.style.display = "none"
  clearError()
}

async function performImport(): Promise<void> {
  if (!rawJsonData) return

  const importModeInput = document.querySelector(
    'input[name="importMode"]:checked'
  ) as HTMLInputElement | null
  const replaceExisting = importModeInput?.value === "replace"

  importButton.disabled = true
  importButton.textContent = "Importing..."

  try {
    const response = await sendMessage<{
      success?: boolean
      imported?: number
      skipped?: number
      validationErrors?: string[]
      error?: string
    }>({
      action: "importRules",
      jsonData: rawJsonData,
      replaceExisting
    })

    if (response?.success) {
      const skippedText = response.skipped ? ` (${response.skipped} skipped)` : ""
      showResult(`Successfully imported ${response.imported} rules${skippedText}`, "success")

      // Auto-close after success (with delay for user to see message)
      setTimeout(() => {
        window.close()
      }, 2000)
    } else {
      showResult(response?.error || "Import failed", "error")
      importButton.disabled = false
    }
  } catch (error) {
    showResult(`Import failed: ${(error as Error).message}`, "error")
    importButton.disabled = false
  }

  importButton.textContent = "Import Rules"
}

function showResult(message: string, type: "success" | "error"): void {
  resultMessage.textContent = message
  resultMessage.className = `result-message ${type}`
  resultMessage.style.display = "block"
}

// Drag and drop handlers
dropZone.addEventListener("dragover", e => {
  e.preventDefault()
  dropZone.classList.add("drag-over")
})

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over")
})

dropZone.addEventListener("drop", e => {
  e.preventDefault()
  dropZone.classList.remove("drag-over")

  const file = e.dataTransfer?.files[0]
  if (file) {
    handleFile(file)
  }
})

// Click to browse
selectFileButton.addEventListener("click", () => {
  fileInput.click()
})

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0]
  if (file) {
    handleFile(file)
  }
})

// Clear file
clearFile.addEventListener("click", () => {
  resetForm()
})

// Import button
importButton.addEventListener("click", performImport)

// Cancel button
cancelButton.addEventListener("click", () => {
  window.close()
})
