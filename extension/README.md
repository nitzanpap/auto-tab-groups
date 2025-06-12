# Auto Tab Groups - Universal Extension

A cross-browser extension that automatically groups tabs by domain, supporting both Chrome and Firefox.

## 🚀 Features

- ✅ **Cross-browser compatibility** - Single codebase for Chrome and Firefox
- ✅ **Domain-based tab grouping** - Automatically groups tabs by website domain
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

Then use `web-ext run` or load in Firefox's about:debugging.

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

*Built with ❤️ for productivity and clean tab management*
