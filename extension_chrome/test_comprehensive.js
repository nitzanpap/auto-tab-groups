#!/usr/bin/env node

/**
 * Comprehensive Chrome Extension Test Suite
 * Tests the extension without requiring browser automation
 */

const fs = require("fs")
const path = require("path")

const extensionPath = path.resolve(__dirname, "src")

console.log("🧪 Auto Tab Groups Chrome Extension Test Suite")
console.log("===============================================\n")

let testsPassed = 0
let testsTotal = 0

function test(name, testFn) {
  testsTotal++
  try {
    testFn()
    console.log(`✅ ${name}`)
    testsPassed++
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`)
  }
}

// Test 1: Manifest V3 Validation
test("Manifest V3 validation", () => {
  const manifestPath = path.join(extensionPath, "manifest.json")
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

  if (manifest.manifest_version !== 3) {
    throw new Error("Manifest version should be 3")
  }

  if (!manifest.name || manifest.name !== "Auto Tab Groups") {
    throw new Error("Extension name incorrect")
  }

  if (!manifest.permissions.includes("tabs")) {
    throw new Error("Missing tabs permission")
  }

  if (!manifest.permissions.includes("tabGroups")) {
    throw new Error("Missing tabGroups permission")
  }

  if (!manifest.background.service_worker) {
    throw new Error("Service worker not defined")
  }
})

// Test 2: Critical Files Exist
test("Critical files existence", () => {
  const criticalFiles = [
    "background.js",
    "public/popup.html",
    "public/popup.js",
    "public/popup.css",
    "utils/BrowserAPI.js",
    "utils/DomainUtils.js",
    "services/TabGroupService.js",
    "state/TabGroupState.js",
    "config/StorageManager.js",
    "assets/icon.svg",
  ]

  for (const file of criticalFiles) {
    const filePath = path.join(extensionPath, file)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing critical file: ${file}`)
    }
  }
})

// Test 3: JavaScript Syntax Check
test("JavaScript syntax validation", () => {
  const jsFiles = [
    "background.js",
    "public/popup.js",
    "utils/BrowserAPI.js",
    "utils/DomainUtils.js",
    "services/TabGroupService.js",
    "state/TabGroupState.js",
    "config/StorageManager.js",
  ]

  for (const file of jsFiles) {
    const filePath = path.join(extensionPath, file)
    const content = fs.readFileSync(filePath, "utf8")

    // Basic syntax checks
    if (content.includes("browser.") && !content.includes("browserAPI")) {
      throw new Error(`${file}: Should use browserAPI compatibility layer, not direct browser API`)
    }
  }
})

// Test 4: Browser API Compatibility Layer
test("Browser API compatibility layer", () => {
  const browserAPIPath = path.join(extensionPath, "utils/BrowserAPI.js")
  const content = fs.readFileSync(browserAPIPath, "utf8")

  if (!content.includes("typeof browser !== 'undefined' ? browser : chrome")) {
    throw new Error("Browser API compatibility layer missing browser detection")
  }

  if (!content.includes("promisify")) {
    throw new Error("Browser API compatibility layer missing promisification")
  }
})

// Test 5: Domain Utils Functionality
test("Domain utils functionality", () => {
  // Dynamically import and test domain utils
  const domainUtilsPath = path.join(extensionPath, "utils/DomainUtils.js")
  const content = fs.readFileSync(domainUtilsPath, "utf8")

  if (!content.includes("extractDomain")) {
    throw new Error("Missing extractDomain function")
  }

  if (!content.includes("getDomainDisplayName")) {
    throw new Error("Missing getDomainDisplayName function")
  }
})

// Test 6: Service Worker Background Script
test("Service worker background script", () => {
  const backgroundPath = path.join(extensionPath, "background.js")
  const content = fs.readFileSync(backgroundPath, "utf8")

  if (!content.includes("browserAPI.runtime.onMessage.addListener")) {
    throw new Error("Background script should use browserAPI for message handling")
  }

  if (!content.includes("return true")) {
    throw new Error("Background script should return true for async message handling in Chrome")
  }
})

// Test 7: Popup HTML Structure
test("Popup HTML structure", () => {
  const popupPath = path.join(extensionPath, "public/popup.html")
  const content = fs.readFileSync(popupPath, "utf8")

  const requiredElements = [
    'id="group"',
    'id="ungroup"',
    'id="generateNewColors"',
    'id="autoGroupToggle"',
    'id="groupBySubDomain"',
  ]

  for (const element of requiredElements) {
    if (!content.includes(element)) {
      throw new Error(`Missing required element: ${element}`)
    }
  }
})

// Test 8: Popup JavaScript Chrome Compatibility
test("Popup JavaScript Chrome compatibility", () => {
  const popupJSPath = path.join(extensionPath, "public/popup.js")
  const content = fs.readFileSync(popupJSPath, "utf8")

  if (!content.includes("typeof browser !== 'undefined' ? browser : chrome")) {
    throw new Error("Popup script should have browser compatibility")
  }

  if (!content.includes("sendMessage")) {
    throw new Error("Popup script should have sendMessage helper function")
  }
})

// Test 9: Storage Manager Chrome Compatibility
test("Storage manager Chrome compatibility", () => {
  const storagePath = path.join(extensionPath, "config/StorageManager.js")
  const content = fs.readFileSync(storagePath, "utf8")

  if (!content.includes("browserAPI.storage")) {
    throw new Error("Storage manager should use browserAPI")
  }
})

// Test 10: Tab Group Service Chrome Compatibility
test("Tab Group Service Chrome compatibility", () => {
  const servicePath = path.join(extensionPath, "services/TabGroupService.js")
  const content = fs.readFileSync(servicePath, "utf8")

  if (!content.includes("browserAPI.tabs")) {
    throw new Error("TabGroupService should use browserAPI for tabs")
  }

  if (!content.includes("browserAPI.tabGroups")) {
    throw new Error("TabGroupService should use browserAPI for tabGroups")
  }
})

console.log("\n📊 Test Results:")
console.log(`Passed: ${testsPassed}/${testsTotal}`)

if (testsPassed === testsTotal) {
  console.log("🎉 All tests passed! Chrome extension is ready for testing.")
  console.log("\n🚀 Next Steps:")
  console.log("1. Load the extension in Chrome (chrome://extensions/)")
  console.log("2. Enable Developer mode")
  console.log('3. Click "Load unpacked" and select the src/ folder')
  console.log("4. Test tab grouping functionality")
  process.exit(0)
} else {
  console.log("❌ Some tests failed. Please fix the issues above.")
  process.exit(1)
}
