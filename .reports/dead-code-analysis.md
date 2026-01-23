# Dead Code Analysis Report

**Generated:** 2026-01-22
**Project:** Auto Tab Groups
**Tools Used:** knip, depcheck, ts-prune

---

## Executive Summary

| Severity | Count | Action |
|----------|-------|--------|
| **SAFE** | 2 | Safe to delete immediately |
| **CAUTION** | 2 | Review before deletion |
| **DANGER** | 0 | Do not delete |

---

## SAFE - Safe to Delete

### 1. Legacy Extension Directory

**Path:** `legacy-extension/`
**Type:** Entire directory
**Reason:** Old JavaScript codebase before TypeScript/WXT migration. Contains its own `node_modules/`, `package.json`, and obsolete source files.

**Contents:**
- `src/` - Old JavaScript source code
- `node_modules/` - 303 packages (separate from main project)
- `tests/` - Old test files
- `*.zip` files - Built artifacts
- Configuration files

**Disk Space:** ~170KB source + ~9MB node_modules

### 2. Unused DevDependency: `eslint-plugin-prettier`

**File:** `package.json`
**Reason:** Not imported or used anywhere in the codebase. The ESLint config uses `eslint-config-prettier` (for disabling conflicting rules) but NOT `eslint-plugin-prettier` (for running Prettier as an ESLint rule).

---

## CAUTION - Review Before Deletion

### 1. Unused E2E Test Helpers

**File:** `tests/e2e/helpers/extension-helpers.ts`
**Exported but unused functions:**
- `openSidebar` (line 82)
- `getTabsInGroup` (line 145)
- `createTabs` (line 170)
- `getGroupByMode` (line 320)
- `waitForGroupsCollapsed` (line 442)
- `waitForGroupsExpanded` (line 453)
- `resetExtensionState` (line 502)
- `setupCleanState` (line 518)

**Recommendation:** These may be intentionally exported for future test expansion. Keep but document, or remove if no plans to use.

### 2. Exported Types Not Used Externally

**Files:** `types/messages.ts`, `types/rules.ts`, `types/storage.ts`

These are re-exported through barrel files and may be:
- Used for IDE intellisense/documentation
- Planned for future consumer use
- Part of the public API surface

**Examples:**
- `RuleColorInfo`, `RuleValidationResult`, `RulesImportResult` (rules.ts)
- `GroupColorMapping`, `CustomRulesMapping`, `StorageSchema` (storage.ts)
- All message types in `messages.ts`

**Recommendation:** Keep - these are type definitions that provide API documentation.

---

## DANGER - Do Not Delete

*No items in this category.*

The following were flagged by tools but are NOT dead code:

| Item | Why It's NOT Dead |
|------|-------------------|
| `entrypoints/*.ts` | WXT entry points - loaded by framework |
| `services/*.ts` | Imported by entry points |
| `utils/*.ts` | Exported via barrel and used |
| `wxt.config.ts` | WXT configuration - loaded by framework |
| `@types/chrome` | Provides Chrome API types for TypeScript |

---

## Missing Dependencies

### `@vitest/coverage-v8`

**File:** `vitest.config.ts`
**Issue:** Coverage is configured but `@vitest/coverage-v8` is not in `package.json`
**Recommendation:** Either:
- Install: `npm install -D @vitest/coverage-v8`
- Or remove coverage config if not needed

---

## Recommended Actions

1. ~~**Delete `legacy-extension/` directory**~~ - DEFERRED (user keeping until migration verified)
2. **Remove `eslint-plugin-prettier` from devDependencies** - DONE
3. **Review unused E2E helpers** - Document intent or remove
4. **Consider installing `@vitest/coverage-v8`** - If coverage is needed

---

## Cleanup Summary

| Action | Status | Impact |
|--------|--------|--------|
| Delete legacy-extension | DEFERRED | ~9.5 MB (pending manual removal) |
| Remove eslint-plugin-prettier | DONE | 5 packages removed |

---

## Future Maintenance

To run this analysis again:
```bash
npx knip --reporter compact
npx depcheck --json
npx ts-prune
```
