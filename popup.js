document.getElementById("group").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "group" })
})

document.getElementById("ungroup").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "ungroup" })
})
