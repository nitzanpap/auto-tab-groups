document.getElementById("group").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "group" })
})

document.getElementById("ungroup").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "ungroup" })
})

// Get the toggle element
const autoGroupToggle = document.getElementById("autoGroupToggle")

// Initialize the toggle state when popup opens
chrome.runtime.sendMessage({ action: "getAutoGroupState" }, (response) => {
  if (response && response.enabled !== undefined) {
    autoGroupToggle.checked = response.enabled
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
