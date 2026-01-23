// Import Rules Page Script
const browserAPI = typeof browser !== "undefined" ? browser : chrome

const selectFileButton = document.getElementById("selectFileButton")
const fileInput = document.getElementById("fileInput")
const importArea = document.getElementById("importArea")
const importOptions = document.getElementById("importOptions")
const importButton = document.getElementById("importButton")
const importResult = document.getElementById("importResult")
const resultMessage = document.getElementById("resultMessage")

let selectedFile = null

// Helper function for sending messages
function sendMessage(message) {
  return new Promise(resolve => {
    browserAPI.runtime.sendMessage(message, resolve)
  })
}

// File selection event handlers
selectFileButton.addEventListener("click", () => {
  console.log("[Import] Select file button clicked")
  // Clear any previous file selection
  fileInput.value = ""
  fileInput.click()
})

importArea.addEventListener("click", () => {
  console.log("[Import] Import area clicked")
  // Clear any previous file selection
  fileInput.value = ""
  fileInput.click()
})

fileInput.addEventListener("change", handleFileSelection)

// Also listen for input event as backup
fileInput.addEventListener("input", event => {
  console.log("[Import] Input event triggered")
  if (!selectedFile && event.target.files.length > 0) {
    handleFileSelection(event)
  }
})

// Handle focus events to catch cases where file dialog was dismissed
let fileDialogOpen = false

fileInput.addEventListener("click", () => {
  fileDialogOpen = true
  console.log("[Import] File dialog opened")
})

window.addEventListener("focus", () => {
  if (fileDialogOpen) {
    fileDialogOpen = false
    console.log("[Import] Window focused after file dialog")

    // Check if a file was selected after a short delay
    setTimeout(() => {
      if (fileInput.files.length > 0 && !selectedFile) {
        console.log("[Import] Found file after focus, processing...")
        handleFileSelection({ target: fileInput })
      }
    }, 100)
  }
})

// Drag and drop handlers
importArea.addEventListener("dragover", e => {
  e.preventDefault()
  importArea.classList.add("dragover")
})

importArea.addEventListener("dragleave", () => {
  importArea.classList.remove("dragover")
})

importArea.addEventListener("drop", e => {
  e.preventDefault()
  importArea.classList.remove("dragover")

  const files = e.dataTransfer.files
  if (files.length > 0) {
    handleFile(files[0])
  }
})

// File handling
function handleFileSelection(event) {
  console.log("[Import] File selection event triggered")
  console.log("[Import] Files:", event.target.files)
  console.log("[Import] Files length:", event.target.files.length)

  // Add a small delay to ensure the file is fully loaded
  setTimeout(() => {
    const file = event.target.files[0]
    if (file) {
      console.log("[Import] File selected:", file.name, file.size)
      handleFile(file)
    } else {
      console.log("[Import] No file selected")
      // Don't show error on first attempt, just wait for user to try again
    }
  }, 50) // Small delay to ensure file is ready
}

function handleFile(file) {
  console.log("[Import] Processing file:", file.name)

  if (!file.name.toLowerCase().endsWith(".json")) {
    showResult("Please select a JSON file.", "error")
    return
  }

  selectedFile = file

  // Show import options
  importOptions.style.display = "block"

  // Update UI to show selected file using safe DOM manipulation
  importArea.innerHTML = "" // Clear existing content

  const containerDiv = document.createElement("div")

  const title = document.createElement("h3")
  title.textContent = "✅ File Selected"

  const fileName = document.createElement("p")
  const fileNameStrong = document.createElement("strong")
  fileNameStrong.textContent = file.name
  fileName.appendChild(fileNameStrong)

  const fileSize = document.createElement("p")
  fileSize.textContent = `Size: ${(file.size / 1024).toFixed(1)} KB`

  const instructions = document.createElement("p")
  instructions.style.color = "#666"
  instructions.style.marginTop = "15px"
  instructions.textContent = 'Choose import options below and click "Import Rules"'

  containerDiv.appendChild(title)
  containerDiv.appendChild(fileName)
  containerDiv.appendChild(fileSize)
  containerDiv.appendChild(instructions)

  importArea.appendChild(containerDiv)
}

// Import button handler
importButton.addEventListener("click", async () => {
  if (!selectedFile) {
    showResult("Please select a file first.", "error")
    return
  }

  try {
    importButton.disabled = true
    importButton.textContent = "Importing..."

    const text = await selectedFile.text()
    const importMode = document.querySelector('input[name="importMode"]:checked').value
    const replaceExisting = importMode === "replace"

    const response = await sendMessage({
      action: "importRules",
      jsonData: text,
      replaceExisting: replaceExisting
    })

    if (response && response.success) {
      const message =
        `Import successful!\n\n` +
        `• Imported: ${response.imported} rules\n` +
        `• Skipped: ${response.skipped} rules\n` +
        (response.validationErrors.length > 0
          ? `• Errors: ${response.validationErrors.slice(0, 3).join("; ")}${
              response.validationErrors.length > 3 ? "..." : ""
            }`
          : "")

      showResult(message, "success")
    } else {
      showResult(response?.error || "Failed to import rules", "error")
    }
  } catch (error) {
    console.error("Error importing rules:", error)
    showResult("Failed to import rules: " + error.message, "error")
  } finally {
    importButton.disabled = false
    importButton.textContent = "Import Rules"
  }
})

function showResult(message, type) {
  resultMessage.textContent = message
  importResult.className = `import-result ${type}`
  importResult.style.display = "block"

  // Scroll to result
  importResult.scrollIntoView({ behavior: "smooth" })
}

// Close button handler
const closeButton = document.getElementById("closeButton")
closeButton.addEventListener("click", async () => {
  try {
    // Get the current tab and close it
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true })
    if (tabs.length > 0) {
      await browserAPI.tabs.remove(tabs[0].id)
    }
  } catch (error) {
    console.error("Error closing tab:", error)
    // Fallback to window.close()
    window.close()
  }
})

// Initialize
console.log("[Import Rules] Page initialized")
