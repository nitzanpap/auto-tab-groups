# Contributing Guide

This document covers development workflow, available scripts, and testing procedures for Auto Tab Groups.

## Prerequisites

- Node.js 18+
- npm 9+
- Chrome or Firefox for testing

## Getting Started

```bash
# Install dependencies
npm install

# Start development mode (auto-reloads on changes)
npm run dev
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start WXT development server (default browser) |
| `npm run dev:chrome` | Start development server for Chrome |
| `npm run dev:firefox` | Start development server for Firefox |
| `npm run build` | Build production extension for Chrome |
| `npm run build:chrome` | Build production extension for Chrome |
| `npm run build:firefox` | Build production extension for Firefox |
| `npm run zip` | Build and create zip package for Chrome |
| `npm run zip:chrome` | Build and create zip package for Chrome |
| `npm run zip:firefox` | Build and create zip/xpi package for Firefox |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run end-to-end tests with Playwright |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## Development Workflow

### 1. Start Development Server

```bash
npm run dev:chrome   # For Chrome
npm run dev:firefox  # For Firefox
```

This will:
- Build the extension in development mode
- Watch for file changes and auto-rebuild
- Output to `.output/chrome-mv3-dev/` or `.output/firefox-mv3-dev/`

### 2. Load Extension in Browser

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `.output/chrome-mv3-dev/`

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in `.output/firefox-mv3-dev/`

### 3. Make Changes

The development server watches for changes and auto-rebuilds. Refresh the extension in the browser to see updates.

### 4. Run Tests

```bash
# Unit tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Project Structure

```
auto-tab-groups/
├── entrypoints/           # Extension entry points
│   ├── background.ts      # Service worker
│   ├── popup/             # Popup UI
│   ├── sidebar/           # Sidebar UI
│   └── rules-modal.unlisted/  # Rule editing modal
├── services/              # Business logic
│   ├── TabGroupService.ts
│   ├── RulesService.ts
│   └── TabGroupState.ts
├── utils/                 # Utilities
│   ├── DomainUtils.ts
│   ├── UrlPatternMatcher.ts
│   ├── Constants.ts
│   └── storage.ts
├── types/                 # TypeScript type definitions
├── tests/                 # Unit tests
├── public/                # Static assets (icons)
├── wxt.config.ts          # WXT configuration
└── package.json
```

## Testing

### Unit Tests

Unit tests are located in `tests/` and use Vitest:

```bash
npm run test           # Run all tests
npm run test -- --watch  # Watch mode
```

### End-to-End Tests

E2E tests use Playwright and require headed browser mode:

```bash
npm run test:e2e
```

## Code Quality

### Before Committing

1. Run type checking: `npm run typecheck`
2. Run linter: `npm run lint`
3. Run tests: `npm run test`
4. Format code: `npm run format`

### Coding Standards

- Use TypeScript for all new code
- Follow existing code patterns
- Add unit tests for new utilities
- Keep components small and focused

## Building for Release

```bash
# Build and zip for both browsers
npm run zip:chrome
npm run zip:firefox
```

Output files:
- `.output/auto-tab-groups-{version}-chrome.zip`
- `.output/auto-tab-groups-{version}-firefox.zip`
