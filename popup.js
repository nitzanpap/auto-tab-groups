document.getElementById("group").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "group" })
})

document.getElementById("createTwoTabsInNewGroup").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "createTwoTabsInNewGroup" })
})

document.getElementById("ungroup").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "ungroup" })
})

// document.getElementById("save").addEventListener("click", async () => {
// })

// document.getElementById("restore").addEventListener("click", async () => {
// })
