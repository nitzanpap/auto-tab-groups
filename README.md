# 🔖 Auto Tab Groups (Firefox Extension)

This is a lightweight Firefox extension that automatically groups open tabs by domain.

> ⚠️ Requires **Firefox 138+** for `tabs.group()` support.
> ⚠️ Requires **Firefox 139+** for title and color support.

---

## 🚀 Features

<!-- Allows grouping tabs by domain, auto-grouping -->

- 🪄 Group tabs automatically by domain name.
- 🎨 Consistent colors for each domain.
- 🔄 Toggle auto-grouping (on/off).
- 🔄 Toggle only applying to new tabs (on/off).
- 🔄 Toggle grouping by subdomain (on/off).

## Planned Features

- Add a "Collapse/Expand All" button to collapse all groups (once the API supports it).

Pending on [the upcoming version 139](https://blog.mozilla.org/addons/2025/04/30/webextensions-support-for-tab-groups/)

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

## 🧩 Ideas for Future Features

- Group tabs by custom rules (e.g., keyword, container, time opened)
- Save/Load window state, including tab groups, pinned tabs, and window position.
- Allow users to auto group tabs via AI (either by providing an API key, or some sort of access to a locally running self hosted AI model)

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

## How to run

1. Install the extension in Firefox

```bash
web-ext run
```

## How to upload to Firefox

1. Make sure to update the `manifest.json` file with the correct new version.
2. Build the extension (see [How to build](#how-to-build))
3. Rename the built suffix of the built file from `.zip` to `.xpi`.
4. Upload the extension to the Firefox addons site `https://addons.mozilla.org/en-US/developers/addon/<your-extension-name>`

## 👨‍💻 Author

Built by [Nitzan Papini](https://github.com/nitzanpap)
