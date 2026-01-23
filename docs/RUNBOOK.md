# Runbook

Operational procedures for deploying, monitoring, and troubleshooting Auto Tab Groups.

## Deployment Procedures

### Chrome Web Store

1. **Build the extension:**
   ```bash
   npm run zip:chrome
   ```

2. **Verify the build:**
   - Extract `.output/auto-tab-groups-{version}-chrome.zip`
   - Check `manifest.json` for correct version
   - Test locally before submission

3. **Submit to Chrome Web Store:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Select "Auto Tab Groups"
   - Click "Package" → "Upload new package"
   - Upload the zip file
   - Fill in release notes
   - Submit for review

### Firefox Add-ons (AMO)

1. **Build the extension:**
   ```bash
   npm run zip:firefox
   ```

2. **Verify the build:**
   - Check `.output/auto-tab-groups-{version}-firefox.zip`
   - Verify `browser_specific_settings.gecko` in manifest

3. **Submit to AMO:**
   - Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
   - Select "Auto Tab Groups"
   - Click "Upload a New Version"
   - Upload the zip file
   - Submit source code zip if required (`.output/auto-tab-groups-{version}-sources.zip`)
   - Submit for review

## Version Bumping

1. Update version in `package.json`:
   ```json
   {
     "version": "X.Y.Z"
   }
   ```

2. Rebuild the extension:
   ```bash
   npm run zip
   npm run zip:firefox
   ```

3. The version automatically propagates to the manifest.

## Common Issues and Fixes

### Build Fails with TypeScript Errors

**Symptom:** `npm run build` fails with type errors.

**Fix:**
```bash
npm run typecheck  # See detailed errors
```

Common causes:
- Missing type imports
- Incorrect `browser` namespace usage (use `Browser.tabs.Tab` not `browser.tabs.Tab`)
- Array type mismatch (use `as [number, ...number[]]` for Chrome API calls)

### Extension Not Loading in Browser

**Symptom:** Extension fails to load or shows errors.

**Fix:**
1. Check browser console for errors
2. Verify manifest.json is valid JSON
3. Check permissions are correctly specified
4. For Firefox: ensure `strict_min_version` is met

### Storage Data Not Persisting

**Symptom:** Settings reset after browser restart.

**Fix:**
1. Check `browser.storage.local` calls are awaited
2. Verify `saveAllStorage()` is called after state changes
3. Check for storage quota exceeded errors

### Tab Groups Not Creating (Firefox)

**Symptom:** Tab groups don't work in Firefox.

**Root Cause:** Firefox doesn't support `tabGroups` API yet (requires Firefox 139+).

**Fix:** The extension gracefully degrades - tab group features are skipped when `browser.tabGroups` is undefined.

### Service Worker Restarts Losing State

**Symptom:** Extension forgets state after Chrome suspends service worker.

**Architecture:** This is by design - the extension uses SSOT (Single Source of Truth) pattern:
- All state is persisted to `browser.storage.local`
- On service worker restart, state is reloaded via `ensureStateLoaded()`
- Never rely on in-memory state across restarts

## Rollback Procedures

### Chrome Web Store

1. Go to [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select "Auto Tab Groups"
3. Go to "Package" → "Versions"
4. Find the previous stable version
5. Click "Rollback" (if available) or upload the previous version zip

### Firefox Add-ons

1. Go to [Developer Hub](https://addons.mozilla.org/developers/)
2. Select "Auto Tab Groups"
3. Go to "Versions"
4. Disable the problematic version
5. Upload the previous version as a new version

### Emergency: Direct User Communication

If a critical bug is deployed:
1. Update extension description with warning
2. Post on support channels
3. Push hotfix as fast as possible

## Monitoring

### User Feedback Sources

- Chrome Web Store reviews
- Firefox Add-on reviews
- GitHub Issues: https://github.com/nitzanpap/auto-tab-groups/issues
- Feedback form (linked in extension)

### Key Metrics to Monitor

- Install/uninstall rates (store dashboards)
- User reviews and ratings
- GitHub issue volume
- Error reports from users

## Testing Checklist Before Release

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (72+ unit tests)
- [ ] `npm run lint` passes
- [ ] Manual testing in Chrome (fresh install)
- [ ] Manual testing in Firefox (fresh install)
- [ ] Test upgrade from previous version (data migration)
- [ ] Test all popup functions
- [ ] Test custom rules CRUD
- [ ] Test import/export
- [ ] Test auto-grouping
- [ ] Test sidebar (Chrome side panel / Firefox sidebar)
