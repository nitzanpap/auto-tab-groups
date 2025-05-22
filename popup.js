document.getElementById("group").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "group" })
})

document.getElementById("ungroup").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "ungroup" })
})

const autoGroupToggle = document.getElementById("autoGroupToggle")
const onlyApplyToNewTabsToggle = document.getElementById("onlyApplyToNewTabs")

// Initialize the toggle states when popup opens
chrome.runtime.sendMessage({ action: "getAutoGroupState" }, (response) => {
  if (response && response.enabled !== undefined) {
    autoGroupToggle.checked = response.enabled
  }
})

chrome.runtime.sendMessage({ action: "getOnlyApplyToNewTabs" }, (response) => {
  if (response && response.enabled !== undefined) {
    onlyApplyToNewTabsToggle.checked = response.enabled
  }
})

// Listen for toggle changes
autoGroupToggle.addEventListener("change", () => {
  const enabled = autoGroupToggle.checked
  chrome.runtime.sendMessage({
    action: "toggleAutoGroup",
    enabled: enabled,
  })
})

onlyApplyToNewTabsToggle.addEventListener("change", () => {
  const enabled = onlyApplyToNewTabsToggle.checked
  chrome.runtime.sendMessage({
    action: "toggleOnlyNewTabs",
    enabled: enabled,
  })
})
