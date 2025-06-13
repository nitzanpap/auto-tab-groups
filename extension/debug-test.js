// Debug test script for Chrome extension console
// To use: Open Chrome DevTools on the extension popup or background page and paste this code

console.log("=== AUTO TAB GROUPS DEBUG TEST ===")

// Test browserAPI availability
console.log("Testing browserAPI availability...")
console.log("globalThis.browserAPI:", globalThis.browserAPI)
console.log("typeof chrome:", typeof chrome)
console.log("typeof browser:", typeof browser)

if (typeof chrome !== "undefined") {
  console.log("Chrome API available:")
  console.log("- chrome.tabGroups:", chrome.tabGroups)
  console.log("- chrome.tabs:", chrome.tabs)
  console.log("- chrome.windows:", chrome.windows)
  console.log("- chrome.runtime.getManifest():", chrome.runtime.getManifest())
}

// Test tab groups functionality
async function testTabGroups() {
  try {
    const browserAPI = globalThis.browserAPI || chrome
    console.log("Using browserAPI:", browserAPI)

    if (!browserAPI.tabGroups) {
      console.error("tabGroups API not available!")
      return
    }

    console.log("Getting current window...")
    const currentWindow = await browserAPI.windows.getCurrent()
    console.log("Current window:", currentWindow)

    console.log("Querying tab groups...")
    const groups = await browserAPI.tabGroups.query({ windowId: currentWindow.id })
    console.log("Found groups:", groups)

    console.log("Querying all tabs...")
    const tabs = await browserAPI.tabs.query({ windowId: currentWindow.id })
    console.log("Found tabs:", tabs)

    // Test color assignment on first group if available
    if (groups.length > 0) {
      const group = groups[0]
      console.log(`Testing color assignment on group ${group.id}...`)

      try {
        await browserAPI.tabGroups.update(group.id, { color: "blue" })
        console.log("✅ Color assignment successful!")
      } catch (error) {
        console.error("❌ Color assignment failed:", error)
      }

      // Test collapse/expand
      console.log(`Testing collapse/expand on group ${group.id}...`)
      try {
        await browserAPI.tabGroups.update(group.id, { collapsed: !group.collapsed })
        console.log("✅ Collapse/expand successful!")
      } catch (error) {
        console.error("❌ Collapse/expand failed:", error)
      }
    }
  } catch (error) {
    console.error("Test failed:", error)
  }
}

// Run the test
console.log("Running tab groups test...")
testTabGroups()
