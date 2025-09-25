# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto Tab Groups is a cross-browser extension (Chrome & Firefox) that automatically groups browser tabs by domain with custom rules support. Built with Manifest V3 for both browsers using a unified codebase.

## Essential Commands

### Development Setup

```bash
cd extension/
npm install
```

### Build Commands

```bash
npm run build:chrome     # Creates auto-tab-groups-chrome.zip
npm run build:firefox    # Creates auto-tab-groups-firefox-{version}.xpi
npm run build           # Build for both browsers
```

### Development Mode

```bash
npm run dev:chrome      # Sets up Chrome manifest, then load src/ in chrome://extensions/
npm run dev:firefox     # Sets up Firefox manifest, then load src/ in about:debugging
npm run dev:clean       # Clean up development manifest
```

### Code Quality

```bash
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix ESLint issues
npm run format          # Format with Prettier
npm run format:check    # Check Prettier formatting
npm run code:check      # Run both lint and format check
npm run code:fix        # Fix both lint and formatting
```

### Testing

```bash
npm test                # Run Playwright tests for both browsers
npm run test:chrome     # Test Chrome only
npm run test:firefox    # Test Firefox only
```

## Architecture Overview

### Core Principle: Browser as Single Source of Truth (SSOT)

The extension uses a stateless architecture where the browser's tab groups API is the authoritative source. Service workers can restart at any time, so all state is persisted to browser storage and reloaded on startup.

### Key Architecture Points

1. **Cross-Browser Compatibility**: Single codebase with browser-specific manifests (`manifest.chrome.json`, `manifest.firefox.json`)
2. **BrowserAPI Layer**: `utils/BrowserAPI.js` provides unified API across Chrome/Firefox
3. **Stateless Operations**: No complex in-memory state - always query browser for current groups
4. **Title-Based Matching**: Groups are identified by their title (domain name or custom rule name)

### Service Worker Lifecycle

Background service (`background.js`) handles:

- Loading state from storage on startup
- Message-based communication with popup/content scripts
- Tab event listeners for automatic grouping
- State must be reloaded after service worker restarts

### Tab Grouping Flow

1. Tab URL changes → Extract domain
2. Check custom rules first (priority over domain grouping)
3. Determine expected group title
4. Find existing group by title or create new one
5. Move tab to appropriate group if needed

### Key Services

- **TabGroupService**: Core grouping logic, handles tab operations
- **RulesService**: Manages custom grouping rules (multiple domains → single group)
- **StorageManager**: Handles browser storage persistence
- **DomainUtils**: Domain extraction with ccSLD support (e.g., .co.uk, .com.au)

### Custom Rules System

Rules allow grouping multiple domains under a single named group:

- Stored in browser local storage
- Priority over automatic domain grouping
- Support for minimum tabs threshold (per-rule and global)
- Import/export functionality for backup/sharing

### Important Files

- `extension/src/background.js` - Main service worker
- `extension/src/services/TabGroupService.js` - Tab grouping logic
- `extension/src/services/RulesService.js` - Custom rules management
- `extension/src/utils/BrowserAPI.js` - Cross-browser compatibility
- `extension/src/utils/DomainUtils.js` - Domain processing with ccSLD support
- `extension/src/public/popup.js` - Extension popup UI
- `extension/src/public/rules-modal.js` - Custom rules UI

## Development Notes

- Always test in both Chrome and Firefox after changes
- Service workers restart frequently - ensure state persistence works
- Use `browserAPI` global instead of direct `chrome.*` or `browser.*` calls
- Group titles must be unique - handle conflicts appropriately
- Minimum tabs threshold: Groups auto-create when threshold met, auto-disband when below
- Always run `npm run format & npm run lint` after making a change
