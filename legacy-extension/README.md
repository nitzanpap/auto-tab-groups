# Auto Tab Groups - Universal Extension

A cross-browser extension that automatically groups tabs by domain & custom rules, supporting both Chrome and Firefox.

## Bugs / Issues / Feature Requests

Please report any issues or feature requests using our [feedback form](https://docs.google.com/forms/d/e/1FAIpQLScdrbrDYZaTXEcpj7KQD6oGpv_TQ1iMIV19DeUxNlIO5sSUtg/viewform?usp=dialog).

If you like this extension, please consider rating it 5 stars ⭐ :)

## 🚀 Features

- ✅ **Cross-browser compatibility** - Single codebase for Chrome and Firefox
- ✅ **Domain-based tab grouping** - Automatically groups tabs by website domain/subdomain
- ✅ **Custom rules** - Create named groups that combine multiple domains
- ✅ **Minimum tabs threshold** - Set how many tabs are needed before creating a group (global and per-rule)
- ✅ **Export/Import rules** - Backup and restore your custom tab grouping rules
- ✅ **Smart domain display** - Shows clean domain names (e.g., "github" instead of "github.com")
- ✅ **Color management** - Persistent group colors across browser sessions
- ✅ **Collapse/expand controls** - Manage tab group visibility
- ✅ **Configuration options** - Auto-grouping, subdomain handling, etc.
- ✅ **Side panel support** - Chrome side panel and Firefox sidebar
- ✅ **Modern UI** - Clean, responsive interface

## 🏗️ Architecture

### Cross-Browser Compatibility

The extension uses a unified codebase with browser-specific builds:

- **Single source code** in `src/` folder
- **Browser detection** via `BrowserAPI.js` compatibility layer
- **Manifest V3** for both Chrome and Firefox (unified architecture)
- **Browser-specific features** handled gracefully (e.g., Chrome's side_panel vs Firefox's sidebar_action)

### Key Components

    ```
    src/
    ├── manifest.chrome.json    # Chrome Manifest V3
    ├── manifest.firefox.json   # Firefox Manifest V3
    ├── background.js           # Service worker (both browsers)
    ├── utils/
    │   ├── BrowserAPI.js      # Cross-browser compatibility layer
    │   └── DomainUtils.js     # Domain processing utilities
    ├── config/
    │   └── StorageManager.js  # Cross-browser storage handling
    ├── services/
    │   └── TabGroupService.js # Tab grouping logic
    ├── state/
    │   └── TabGroupState.js   # State management
    ├── public/
    │   ├── popup.html         # Extension popup
    │   ├── popup.js           # Popup logic
    │   ├── popup.css          # Styling
    │   └── sidebar.html       # Side panel/sidebar
    └── assets/
        ├── icon16.png         # Icons (PNG for compatibility)
        ├── icon48.png
        └── icon128.png
    ```

## 🛠️ Development

### Prerequisites

    ```bash
    npm install
    ```

### Building

#### Build for Chrome

    ```bash
    npm run build:chrome
    ```

Creates: `auto-tab-groups-chrome.zip`

#### Build for Firefox

    ```bash
    npm run build:firefox
    ```

Creates: `auto-tab-groups-firefox.xpi`

#### Build for both browsers

    ```bash
    npm run build
    ```

### Development Mode

#### Chrome Development

    ```bash
    npm run dev:chrome
    ```

Then load the `src/` folder in Chrome's extension manager.

#### Firefox Development

    ```bash
    npm run dev:firefox
    ```

Then use `web-ext run`, or load in the `manifest.json` file in Firefox's about:debugging.

### Testing

    ```bash
    # Test both browsers
    npm test

    # Test specific browser
    npm run test:chrome
    npm run test:firefox
    ```

## 📦 Installation

### Chrome

1. Download `auto-tab-groups-chrome.zip`
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select extracted folder

### Firefox

1. Download `auto-tab-groups-firefox.xpi`
2. Go to `about:addons`
3. Click gear icon → "Install Add-on From File"
4. Select the `.xpi` file

## 🔧 Browser Differences Handled

| Feature | Chrome | Firefox | Solution |
|---------|--------|---------|----------|
| Manifest | V3 | V3 | Unified architecture |
| Background | Service Worker | Background Scripts | ES modules support |
| APIs | `chrome.*` | `browser.*` | Unified browserAPI object |
| Storage | Callback-based | Promise-based | Promisified Chrome APIs |
| Tab Groups | Native support | Native support | Both browsers support tabGroups API |
| Side Panel | `side_panel` | `sidebar_action` | Browser-specific manifest keys |
| Icons | PNG required | SVG/PNG supported | PNG format (universal) |

## 🔧 Custom Rules Feature

### Overview

Custom rules allow you to create named tab groups that combine multiple domains under a single group. This gives you more control over how your tabs are organized beyond simple domain-based grouping.

### How It Works

1. **Priority System**: Custom rules take priority over domain-based grouping
2. **Fallback**: Domains not covered by custom rules still use automatic domain grouping
3. **Real-time**: Changes to rules immediately re-group existing tabs

### Example Use Cases

- **Communication**: Group `discord.com`, `teams.microsoft.com`, `slack.com` under "Communication"
- **Development**: Group `github.com`, `stackoverflow.com`, `docs.google.com` under "Dev Tools"
- **Social Media**: Group `twitter.com`, `facebook.com`, `instagram.com` under "Social"

### Using Custom Rules

1. Open the extension popup
2. Click "🔧 Custom Rules" to expand the section
3. Click "➕ Add New Rule" to create your first rule
4. Enter a group name (or let the system suggest one)
5. **Quick add from current tabs**: Select domains from your currently open tabs instead of typing them manually
6. Choose a color and save

### Technical Details

- **Rule Storage**: Rules are stored in browser local storage
- **Domain Matching**: Currently supports exact domain matching
- **Performance**: Rules are cached for fast matching
- **Validation**: Comprehensive validation for rule names and domains
- **Limits**: Maximum 20 domains per rule, 50 character rule names

## 🔢 Minimum Tabs Threshold

The minimum tabs threshold feature allows you to control when tab groups are created. Instead of grouping tabs immediately, you can require a minimum number of tabs from the same domain before a group is formed. This helps reduce clutter from single-tab groups.

### How Minimum Tabs Works

1. **Global Setting**: Set a default minimum (e.g., 2 tabs) that applies to all domains
2. **Per-Rule Override**: Each custom rule can have its own minimum that overrides the global setting
3. **Automatic Management**: Groups are automatically created when the threshold is met and disbanded when tabs drop below the minimum

### Configuration (Global and Per-Rule)

#### Global Minimum

1. Open the extension popup
2. Find "Minimum tabs to form group" setting
3. Set your preferred minimum (1-10 tabs)
4. All domains without custom rules will use this setting

#### Per-Rule Minimum

1. When creating or editing a custom rule
2. Set "Minimum tabs to form group" for that specific rule
3. Leave empty to use the global setting
4. Example: Set "Extensions" rule to 1 tab, but keep global at 3 tabs

### Example Scenarios (Global and Per-Rule)

- **Global = 3, No custom rules**: Need 3 github.com tabs before they group
- **Global = 2, "Work" rule = 1**: Work sites group immediately, others need 2 tabs
- **Global = 1, "Social Media" rule = 5**: Most sites group immediately, but social media sites need 5 tabs to reduce distractions

### Technical Details (Global and Per-Rule)

- **Range**: 1-10 tabs (1 effectively disables the feature)
- **Auto-ungroup**: When a group falls below its minimum, tabs are automatically ungrouped
- **Storage**: Settings persist across browser sessions
- **Import/Export**: Minimum values are included when exporting/importing rules

## 📖 Documentation

- **[Tab Group Creation Flow](TAB_GROUP_CREATION_FLOW.md)** - How browser tab groups actually work
- **[Simplified Architecture](SIMPLIFIED_ARCHITECTURE.md)** - Overview of the stateless, browser-as-SSOT approach
- **[API Fix Summary](TAB_GROUPS_API_FIX.md)** - Details on tab group API compatibility fixes
- **[Refactoring Complete](REFACTORING_FIX_COMPLETE.md)** - Summary of architecture improvements

## 🐛 Troubleshooting

### Common Issues

1. **Icons not showing**: Ensure PNG icons are present in `assets/` folder
2. **Storage errors**: Check that BrowserAPI.js is properly loaded
3. **Service worker issues**: Verify async initialization in background.js

### Debug Mode

Enable debug logging by opening the extension popup and checking browser console.

## 📊 Testing Status

All major functionality tested across:

- ✅ Chrome (Manifest V3)
- ✅ Firefox (Manifest V2)
- ✅ Tab grouping
- ✅ Storage persistence
- ✅ Cross-browser API compatibility
- ✅ Icon display
- ✅ Popup functionality

## 🎯 Next Steps

1. **Chrome Web Store** submission
2. **Firefox Add-ons** (AMO) submission
3. **User feedback** collection
4. **Feature enhancements** based on usage

---

## *Built with ❤️ for productivity and clean tab management*
