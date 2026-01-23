# Comprehensive E2E Test Implementation

## Overview

This document describes the comprehensive functional E2E tests implemented for the Auto Tab Groups extension. The tests verify actual tab grouping functionality, not just UI rendering.

## Test Architecture

### Playwright Configuration

- **Workers**: 1 (sequential execution for extension testing)
- **Headed Mode**: Required for Chrome extension testing
- **Timeout**: 60 seconds per test
- **Browser**: Chromium with extension loaded

### Test Structure

```sh
tests/e2e/
├── extension.spec.ts          # Original UI tests (4 tests)
├── tab-grouping.spec.ts       # Domain grouping tests (5 tests)
├── auto-grouping.spec.ts      # Auto-group toggle tests (4 tests)
├── custom-rules.spec.ts       # Custom rules tests (4 tests)
├── group-operations.spec.ts   # Collapse/expand tests (3 tests)
├── minimum-tabs.spec.ts       # Threshold tests (3 tests, skipped)
└── helpers/
    └── extension-helpers.ts   # Shared test utilities
```

## Test Suites

### 1. Tab Grouping by Domain (`tab-grouping.spec.ts`)

| Test                                          | Description                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `groups tabs from same domain into one group` | Creates 3 tabs to example.com, verifies all grouped together           |
| `separates tabs from different domains`       | Creates tabs to different domains, verifies separate groups            |
| `extracts domain correctly with ccSLD`        | Verifies bbc.co.uk groups as "bbc", not "co"                           |
| `does not group pinned tabs`                  | Pins a tab, verifies it stays ungrouped after manual grouping          |
| `handles subdomain mode`                      | Verifies api.github.com and docs.github.com separate in subdomain mode |

### 2. Auto-Grouping Toggle (`auto-grouping.spec.ts`)

| Test                                     | Description                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| `groups tabs automatically when enabled` | Enable auto-group, create tabs, verify grouped         |
| `does not group when disabled`           | Disable auto-group, create tabs, verify ungrouped      |
| `manual group works when disabled`       | Disable auto-group, click Group button, verify grouped |
| `ungroup all removes all groups`         | Create groups, click Ungroup All, verify no groups     |

### 3. Custom Rules (`custom-rules.spec.ts`)

| Test                                        | Description                                                        |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `rule groups matching tabs under rule name` | Create rule "Test Sites" for multiple domains, verify single group |
| `rule takes priority over domain grouping`  | Rule name used instead of domain name                              |
| `disabled rule does not apply`              | Disabled rule ignored, tabs grouped by domain                      |
| `delete rule regroups tabs by domain`       | Delete rule, tabs regroup under domain name                        |

### 4. Group Operations (`group-operations.spec.ts`)

| Test                    | Description                                   |
| ----------------------- | --------------------------------------------- |
| `collapse all groups`   | Create groups, collapse all, verify collapsed |
| `expand all groups`     | Collapse groups, expand all, verify expanded  |
| `toggle collapse state` | Toggle between collapsed and expanded states  |

### 5. Minimum Tabs Threshold (`minimum-tabs.spec.ts`) - SKIPPED

| Test                             | Description                                        |
| -------------------------------- | -------------------------------------------------- |
| `does not group below threshold` | Set threshold=3, create 2 tabs, verify not grouped |
| `groups when threshold met`      | Create 3rd tab, verify all grouped                 |
| `ungroups below threshold`       | Close tab, verify remaining ungroup                |

**Note**: These tests are skipped due to a Playwright context isolation issue. See [Known Issues](#known-issues).

## Helper Utilities

The `extension-helpers.ts` file provides 60+ utility functions:

### Browser Context Management

- `getExtensionId()` - Get extension ID from service workers
- `openPopup()` / `openSidebar()` - Open extension UI pages
- `createTab()` / `createTabs()` - Create tabs with URLs
- `closeTestTabs()` - Clean up test tabs

### Message Communication

- `sendMessage()` - Send message to background service worker
- `getTabGroups()` - Get all tab groups via popup
- `getTabs()` - Get all tabs in current window

### State Management

- `enableAutoGroup()` / `disableAutoGroup()`
- `setGroupByMode()` / `getGroupByMode()`
- `setMinimumTabs()` / `getMinimumTabs()`
- `addCustomRule()` / `deleteCustomRule()` / `updateCustomRule()`

### Wait Utilities

- `waitForGroup()` - Wait for group with specific title
- `waitForTabInGroup()` - Wait for tab to be in specific group
- `waitForNoGroups()` - Wait for all groups to be removed
- `waitForGroupCount()` - Wait for specific number of groups

### Group Operations

- `ungroupAllTabs()` / `groupAllTabs()`
- `collapseAllGroups()` / `expandAllGroups()`
- `toggleCollapseGroups()`

## Key Implementation Details

### Domain Display Names

The extension strips TLDs from domain names for group titles:

- `example.com` → `example`
- `httpbin.org` → `httpbin`
- `bbc.co.uk` → `bbc` (ccSLD handled correctly)
- `api.github.com` → `api.github` (subdomain mode)

### Test Isolation

Each test:

1. Starts with clean state (ungroup all, reset settings)
2. Creates its own tabs
3. Cleans up tabs in `afterEach`
4. Uses its own browser context per test file

### Assertions Strategy

Tests use flexible assertions to handle:

- Potential "System" groups from browser pages
- Active tab's group staying expanded during collapse operations
- Async nature of tab grouping operations

## Running Tests

```bash
# Build and run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/tab-grouping.spec.ts

# Run with UI mode for debugging
npx playwright test --ui
```

## Test Results

```log
Running 23 tests using 1 worker

  20 passed
  3 skipped (minimum-tabs tests)

Total time: ~26 seconds
```

## Known Issues

### Minimum Tabs Context Isolation Issue

The minimum-tabs tests have a Playwright context isolation issue where the browser context closes unexpectedly between `beforeEach` and the test body. This appears to be specific to how Playwright handles sequential test execution with multiple browser contexts.

**Symptoms:**

- `page.goto: Target page, context or browser has been closed`
- Occurs only in minimum-tabs.spec.ts
- Other test files before and after work correctly

**Attempted Fixes:**

1. Context validity check in beforeEach
2. Context recreation on failure
3. Error handling with retry

**Current Status:** Tests are skipped with TODO comment. The threshold functionality is partially covered by other tests.

**Potential Solutions:**

1. Use Playwright fixtures instead of module-level variables
2. Combine minimum-tabs tests into another test file
3. Investigate Playwright's test hook ordering

## Future Improvements

1. **Fix minimum-tabs tests** - Investigate context isolation issue
2. **Add visual regression tests** - Screenshot comparison for UI
3. **Performance tests** - Test grouping performance with many tabs
4. **Cross-browser testing** - Add Firefox support when MV3 is stable
5. **CI/CD integration** - Run tests in GitHub Actions
