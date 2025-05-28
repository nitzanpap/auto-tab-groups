# 🔖 Auto Tab Groups (Firefox Extension)

This is a lightweight Firefox extension that automatically groups open tabs by domain, with intelligent domain name handling for better organization.

> ⚠️ Requires **Firefox 138+** for `tabs.group()` support.
> ⚠️ Requires **Firefox 139+** for title and color support.

---

## 🚀 Features

- 🪄 Intelligent tab grouping by domain:
  - Automatically groups tabs by their domain
  - Smart domain name display (e.g., "github" instead of "www.github.com")
  - Special handling for IP addresses, localhost, and .local domains
- 🎨 Consistent colors for each domain group
- 🔄 Real-time grouping:
  - Automatically handles new tabs and refreshed tabs
  - Maintains existing groups without duplicates
- ⚙️ Configuration options:
  - Toggle auto-grouping (on/off)
  - Toggle only applying to new tabs (on/off)
  - Toggle grouping by subdomain (on/off)

## Planned Features

- Add a "Collapse/Expand All" button to collapse all groups (once the API supports it)
- Group tabs by custom rules (e.g., keyword, container, time opened)
- Save/Load window state, including tab groups, pinned tabs, and window position
- Allow users to auto group tabs via AI (either by providing an API key, or some sort of access to a locally running self hosted AI model)

---

## 📦 Project Structure

- `background.js`: Main background script for managing tab groups
- `services/`:
  - `TabGroupService.js`: Core tab grouping logic
  - `DomainUtils.js`: Domain name processing and formatting utilities
- `manifest.json`: Extension manifest file
- `popup/`: UI components for extension controls

---

## 🛠 Development Setup

1. Install dependencies:

```bash
npm install
```

2. Available scripts:

- `npm start`: Run the extension in Firefox for development
- `npm run build`: Build the extension and generate .xpi file
- `npm run format`: Format code using Prettier
- `npm run lint`: Run ESLint checks

### Loading for Development

1. Open Firefox and go to: `about:debugging`
2. Click **"This Firefox"** → **"Load Temporary Add-on..."**
3. Select the `manifest.json` file from the `src` directory

---

## 🧪 Usage

The extension works automatically in the background, grouping tabs by domain with intelligent name formatting. Click the extension icon in the browser toolbar to:

- Toggle automatic grouping
- Configure grouping options
- Manually trigger grouping for all tabs

---

## 🧠 How It Works

### Tab Grouping Logic

- Uses the [`browser.tabs.group()`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/group) API
- Groups tabs based on their root domain
- Maintains group consistency during tab operations (refresh, new tab, etc.)
- Intelligently formats domain names for group titles:
  - Removes TLD (e.g., ".com", ".org")
  - Removes "www" subdomain when present
  - Special handling for IP addresses and local domains

## 📚 Resources

- [MDN WebExtensions API Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [tabs.group() API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/group)

---

## 📦 Distribution

### Building for Production

1. Update version in `manifest.json`
2. Build the extension:

```bash
npm run build
```

3. The built extension will be available as an .xpi file

### Publishing to Firefox Add-ons

1. Update the version in `manifest.json`
2. Build using `npm run build`
3. Upload the .xpi file to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/en-US/developers/)

## 👨‍💻 Author

Built by [Nitzan Papini](https://github.com/nitzanpap)

## 📄 License

MIT License - see package.json for details
