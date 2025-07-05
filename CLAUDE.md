# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build Commands

```bash
# Development setup (choose browser)
npm run dev:chrome     # Sets up Chrome manifest for development
npm run dev:firefox    # Sets up Firefox manifest for development

# Build for production
npm run build:chrome   # Creates auto-tab-groups-chrome.zip
npm run build:firefox  # Creates auto-tab-groups-firefox-{version}.xpi
npm run build         # Builds for both browsers

# Clean build artifacts
npm run clean         # Removes all .zip, .xpi files and web-ext-artifacts
npm run dev:clean     # Removes development manifest.json
```

### Code Quality Commands

```bash
# Linting
npm run lint          # Run ESLint checks
npm run lint:fix      # Auto-fix ESLint issues

# Formatting
npm run format        # Format all code with Prettier
npm run format:check  # Check formatting without changes

# Combined checks
npm run code:check    # Run both lint and format:check
npm run code:fix      # Run both lint:fix and format
```

### Testing Commands

```bash
npm test              # Run all Playwright tests
npm run test:chrome   # Run tests on Chrome only
npm run test:firefox  # Run tests on Firefox only
```

## High-Level Architecture

This extension follows a **stateless, browser-as-SSOT (Single Source of Truth)** architecture where the browser's tab groups API is the authoritative source for all group state.

### Key Architectural Principles

1. **Stateless Design**: No complex in-memory state. The browser APIs are queried fresh for each operation.
2. **Event-Driven**: Service worker responds to browser tab events and user actions via messages.
3. **Cross-Browser Compatibility**: Unified codebase with browser-specific manifest files and a compatibility layer.
4. **Minimal Persistent State**: Only user settings are stored, not tab/group mappings.

### Core Components Overview

**Service Worker Flow** (`background.js`):

- Central message hub handling all extension operations
- Listens to tab events: `onUpdated`, `onCreated`, `onRemoved`, `onMoved`
- Ensures state is loaded before operations
- Delegates to services for actual logic

**Tab Grouping Logic** (`services/TabGroupService.js`):

- Stateless operations using title-based matching
- Key methods: `handleTabUpdate()`, `groupAllTabs()`, `findGroupByTitle()`
- No cached mappings - always queries browser APIs

**Custom Rules System** (`services/RulesService.js`):

- Manages user-defined grouping rules with wildcard support
- Priority-based matching (custom rules override domain grouping)
- Handles import/export functionality

**State Management** (`state/TabGroupState.js` + `config/StorageManager.js`):

- Minimal state: only settings like `autoGroupingEnabled`, `customRules`
- Persisted to `browser.storage.local`
- Loaded once per service worker lifecycle

**Cross-Browser Compatibility** (`utils/BrowserAPI.js`):

- Unified API for Chrome's `chrome.*` and Firefox's `browser.*`
- Promisifies Chrome's callback-based APIs
- Handles API availability checks

**UI Components**:

- `popup.js`: Main popup/sidebar controller
- `rules-modal.js`: Custom rules creation/editing interface
- `import-rules.js`: Dedicated import flow for rules

### Domain Processing

The extension includes sophisticated domain handling (`utils/DomainUtils.js`):

- Country code second-level domain (ccSLD) support (e.g., `example.co.uk`)
- Smart formatting (removes www, extracts meaningful domain names)
- Special handling for IP addresses, localhost, and .local domains

### Message Flow Example

1. User clicks "Group all tabs" in popup
2. `popup.js` sends message: `{action: 'groupAllTabs'}`
3. `background.js` receives message, calls `TabGroupService.groupAllTabs()`
4. `TabGroupService` queries `browser.tabs.query()` for all tabs
5. For each tab, determines group title based on domain/rules
6. Creates/updates groups using `browser.tabs.group()`
7. Returns success/failure to popup for UI update

### Testing Approach

- Uses Playwright for end-to-end testing
- Tests can run against both Chrome and Firefox
- Located in `tests/` directory
- Environment variable `BROWSER` controls which browser to test

### Key Files to Understand

1. **Entry Points**: `background.js`, `popup.js`, `rules-modal.js`
2. **Core Logic**: `services/TabGroupService.js`, `services/RulesService.js`
3. **Utilities**: `utils/BrowserAPI.js`, `utils/DomainUtils.js`
4. **State**: `state/TabGroupState.js`, `config/StorageManager.js`
5. **Manifests**: `src/manifest.chrome.json`, `src/manifest.firefox.json`
