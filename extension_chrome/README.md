# Auto Tab Groups - Chrome Extension

This is the Chrome-compatible version of the Auto Tab Groups extension, built with Manifest V3.

## Key Differences from Firefox Version

### Manifest V3 Compatibility

- Uses `service_worker` instead of background scripts
- Updated permissions model
- Side panel instead of sidebar action
- Promise-based APIs with compatibility layer

### Browser API Compatibility

- Includes `BrowserAPI.js` compatibility layer to handle differences between Chrome and Firefox APIs
- Chrome uses `chrome.*` APIs while Firefox uses `browser.*` APIs
- Service worker architecture for background processing

### Features

- ✅ Domain-based tab grouping
- ✅ Smart domain display names
- ✅ Color management with persistence
- ✅ Collapse/expand group controls
- ✅ Configuration options (auto-grouping, subdomain handling, etc.)
- ✅ Side panel support

## Development

### Building the Extension

```bash
npm run build
```

This creates a ZIP file ready for Chrome Web Store or local installation.

### Loading in Chrome for Development

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `src` folder of this extension

### Testing

The extension should work identically to the Firefox version, with automatic tab grouping by domain.

## Installation

### From Chrome Web Store

*(Not yet published)*

### Manual Installation

1. Download the latest release
2. Unzip the file
3. Load unpacked extension in Chrome developer mode

## Browser Requirements

- **Chrome 88+** for full tab groups API support
- **Chrome 95+** recommended for best experience

## Architecture

```
src/
├── manifest.json          # Chrome MV3 manifest
├── background.js          # Service worker (main logic)
├── utils/
│   ├── BrowserAPI.js      # Cross-browser compatibility layer
│   └── DomainUtils.js     # Domain processing utilities
├── services/
│   └── TabGroupService.js # Core tab grouping logic
├── state/
│   └── TabGroupState.js   # State management
├── config/
│   └── StorageManager.js  # Storage operations
├── public/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js          # Popup logic (Chrome-compatible)
│   ├── popup.css         # Popup styling
│   └── sidebar.html      # Side panel UI
└── assets/
    └── icon.svg          # Extension icon
```

## Contributing

This Chrome version should maintain feature parity with the Firefox version. When making changes:

1. Update both Firefox and Chrome versions
2. Test cross-browser compatibility
3. Ensure the `BrowserAPI.js` compatibility layer handles any new APIs
4. Update documentation for both versions
