# 🔖 Auto Tab Grouper (Firefox Extension)

This is a lightweight Firefox extension that automatically groups open tabs by domain and lets you save or restore snapshots of your tabs.

> ⚠️ Requires **Firefox 138+** for `tabs.group()` support.

---

## 🚀 Features

- ✅ Group tabs automatically by domain name.
- 💾 Save the current set of tabs (snapshot).
- ♻️ Restore tabs from a saved snapshot.

---

## 📦 Project Structure

- `background.js`: Main background script for managing tab groups and saving/restoring snapshots.
- `content.js`: Content script for detecting tab changes and updating groups.
- `manifest.json`: Extension manifest file.
- `popup.html`: UI for saving and restoring snapshots.

---

## 🛠 Installation (Temporary for Development)

1. Open Firefox and go to: `about:debugging`
2. Click **"This Firefox"** → **"Load Temporary Add-on..."**
3. Select the `manifest.json` file inside this project folder

---

## 🧪 Usage

Click the extension icon in the browser toolbar to open the popup. You’ll see three buttons:

- **Group Tabs**: Automatically groups all open tabs by their domain.

---

## 🧠 How It Works

### Tab Grouping

The extension uses the new [`browser.tabs.group()`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/group) API to group tabs that share the same domain name.

## 📚 Resources

- [MDN WebExtensions API Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [tabs.group() API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/group)

---

## Planned Features

- Add a name to the group (once the API supports it).
- Consistently add colors to each group (once the API supports it).
- Add a "Collapse/Expand All" button to collapse all groups (once the API supports it).

Pending on [the upcoming version 139](https://blog.mozilla.org/addons/2025/04/30/webextensions-support-for-tab-groups/)

## 🧩 Ideas for Future Features

- Group tabs by custom rules (e.g., keyword, container, time opened)
- Support multiple named snapshots
- Automatically group new tabs on creation
- Export/import snapshots

---

## 📦 How to build

1. Install the `web-ext` CLI

```bash
npm install -g web-ext
```

2. Make sure to update the `manifest.json` file with the correct version (once you are ready to publish)

3. Build the extension

```bash
web-ext build
```

4. Install the extension in Firefox

```bash
web-ext run
```

## 👨‍💻 Author

Built by [Nitzan Papini](https://github.com/nitzanpap)
