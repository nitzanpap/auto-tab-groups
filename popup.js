document.getElementById("group").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "group" })
})

document.getElementById("save").addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({})
  const snapshot = tabs.map((tab) => ({
    url: tab.url,
    pinned: tab.pinned,
  }))
  await chrome.storage.local.set({ snapshot })
})

document.getElementById("restore").addEventListener("click", async () => {
  const { snapshot } = await chrome.storage.local.get("snapshot")
  for (const tab of snapshot) {
    await chrome.tabs.create({ url: tab.url, pinned: tab.pinned })
  }
})
