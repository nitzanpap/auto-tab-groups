# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto Tab Groups is a cross-browser extension (Chrome & Firefox) that automatically groups browser tabs by domain with custom rules support. Built with WXT framework and TypeScript, targeting Manifest V3 for both browsers.

## Essential Commands

### Development Setup

```bash
bun install
```

### Build Commands

```bash
bun run build           # Build for both browsers
bun run build:chrome    # Build for Chrome (.output/chrome-mv3/)
bun run build:firefox   # Build for Firefox (.output/firefox-mv3/)
bun run zip             # Create distribution zips
bun run zip:chrome      # Create Chrome zip
bun run zip:firefox     # Create Firefox zip
```

### Development Mode

```bash
bun run dev             # Start WXT dev server (default browser)
bun run dev:chrome      # Start Chrome dev with hot reload
bun run dev:firefox     # Start Firefox dev with hot reload (uses MV2)
```

### Code Quality

```bash
bun run lint            # Run Biome linter
bun run lint:fix        # Auto-fix Biome linting issues
bun run format          # Format with Biome
bun run format:check    # Check Biome formatting
bun run typecheck       # Run TypeScript type checking
bun run code:check      # Run Biome check and typecheck
bun run code:fix        # Fix lint and formatting issues with Biome
```

### Testing

```bash
bun test                # Run Vitest unit tests
bun run test:e2e        # Build and run Playwright E2E tests
```

## Architecture Overview

### Core Principle: Browser as Single Source of Truth (SSOT)

The extension uses a stateless architecture where the browser's tab groups API is the authoritative source. Service workers can restart at any time, so all state is persisted to browser storage and reloaded on startup.

### Project Structure (WXT)

```tree
/
├── wxt.config.ts           # WXT configuration with browser-specific manifests
├── entrypoints/            # Extension entry points
│   ├── background.ts       # Service worker
│   ├── popup/              # Popup UI
│   ├── sidebar/            # Sidebar UI (Chrome side panel, Firefox sidebar)
│   └── rules-modal.unlisted/  # Rules editor modal
├── services/               # Business logic
│   ├── TabGroupService.ts  # Core tab grouping logic
│   ├── RulesService.ts     # Custom rules management
│   └── TabGroupState.ts    # State management
├── utils/                  # Utilities
│   ├── DomainUtils.ts      # Domain extraction with ccSLD support
│   ├── UrlPatternMatcher.ts # URL pattern matching
│   ├── RulesUtils.ts       # Rule validation helpers
│   ├── Constants.ts        # Tab group colors
│   └── storage.ts          # WXT storage utilities
├── types/                  # TypeScript types
│   ├── rules.ts            # CustomRule, TabGroupColor types
│   ├── storage.ts          # Storage schema types
│   └── messages.ts         # Message types for background communication
├── public/                 # Static assets (icons)
└── tests/                  # Tests
    ├── *.test.ts           # Vitest unit tests
    └── e2e/                # Playwright E2E tests
```

### Key Architecture Points

1. **WXT Framework**: Modern extension framework with TypeScript, hot reload, and unified manifest
2. **Browser Compatibility**: WXT handles browser-specific manifest generation automatically
3. **Stateless Operations**: No complex in-memory state - always query browser for current groups
4. **Title-Based Matching**: Groups are identified by their title (domain name or custom rule name)

### Service Worker Lifecycle

Background service (`entrypoints/background.ts`) handles:

- Loading state from storage on startup via `ensureStateLoaded()`
- Message-based communication with popup/sidebar
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
- **TabGroupState**: In-memory state synchronized with browser storage
- **DomainUtils**: Domain extraction with ccSLD support (e.g., .co.uk, .com.au)
- **UrlPatternMatcher**: URL pattern matching for rules

### Custom Rules System

Rules allow grouping multiple domains under a single named group:

- Stored in browser local storage
- Priority over automatic domain grouping
- Support for minimum tabs threshold (per-rule and global)
- Import/export functionality for backup/sharing

### Important Files

- `entrypoints/background.ts` - Main service worker
- `services/TabGroupService.ts` - Tab grouping logic
- `services/RulesService.ts` - Custom rules management
- `utils/DomainUtils.ts` - Domain processing with ccSLD support
- `utils/UrlPatternMatcher.ts` - URL pattern matching
- `entrypoints/popup/main.ts` - Extension popup UI
- `entrypoints/rules-modal.unlisted/main.ts` - Custom rules UI
- `wxt.config.ts` - WXT and manifest configuration

## Development Notes

- Always test in both Chrome and Firefox after changes
- Service workers restart frequently - ensure state persistence works
- Use `browser` global (provided by WXT) for cross-browser API calls
- Group titles must be unique - handle conflicts appropriately
- Minimum tabs threshold: Groups auto-create when threshold met, auto-disband when below
- Always run `bun run code:check` after making changes
- Firefox dev mode uses MV2 for hot reload support; production builds use MV3

## Firefox MV3 Dev Mode Limitation

Firefox MV3 dev mode doesn't support hot reload due to a [Mozilla bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1864284). The `dev:firefox` script uses `--mv2` flag for hot reload. Production builds (`build:firefox`) use MV3.
