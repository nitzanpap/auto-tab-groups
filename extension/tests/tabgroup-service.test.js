/**
 * Basic validation test for the refactored TabGroupService
 * Ensures all modules load correctly and basic functionality works
 */

import { test, expect } from "@playwright/test";

const ORIGIN = "http://localhost:5174/";

// Provide chrome + browserAPI BEFORE any module evaluates.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const ev = () => ({ addListener() {}, removeListener() {} });
    const api = {
      tabs: {
        query: async () => [],
        get: async () => ({}),
        group: async () => 1,
        ungroup: async () => {},
        onUpdated: ev(),
        onActivated: ev(),
        TAB_ID_NONE: -1
      },
      tabGroups: {
        query: async () => [],
        get: async () => ({}),
        update: async () => ({}),
        onUpdated: ev(),
        TAB_GROUP_ID_NONE: -1
      },
      windows: {
        getCurrent: async () => ({ id: 1, type: "normal", focused: true }),
        getAll: async () => [{ id: 1, type: "normal", focused: true }],
        onFocusChanged: ev(),
        WINDOW_ID_CURRENT: -2
      },
      storage: { local: { get: async () => ({}), set: async () => ({}), remove: async () => {} } },
      runtime: { getURL: p => new URL(p, document.baseURI).href, getManifest: () => ({ manifest_version: 3 }), onMessage: ev() },
      action: { setBadgeText: async () => {} }
    };
    globalThis.chrome = api;
    globalThis.browserAPI = api;
  });
});

// Navigate to same-origin page, then import module there (avoids about:blank CORS on Windows)
async function importOnOrigin(page, rootRelativePath) {
  await page.goto(`${ORIGIN}tests/runner.html`);
  const err = await page.evaluate(async (p) => {
    try {
      const url = new URL(p, location.origin + "/").href; // force root-relative
      const mod = await import(url);
      window.__mod__ = mod;
      return undefined;
    } catch (e) {
      return e?.message || String(e);
    }
  }, rootRelativePath);
  expect(err).toBeUndefined();
  return page.evaluate(() => window.__mod__);
}

// --- TEST 1: service loads and has the methods we actually use here ---
test("TabGroupService modules load correctly", async ({ page }) => {
  // minimal behavior the service expects for import
  await page.addInitScript(() => {
    browserAPI.tabs.query = async () => [];
    browserAPI.tabs.get = async () => ({ id: 1, url: "https://example.com", windowId: 1 });
    browserAPI.tabGroups.query = async () => [];
    browserAPI.tabGroups.get = async () => ({ id: 1, title: "Test", color: "blue" });
    browserAPI.tabGroups.update = async () => ({});
  });

  await importOnOrigin(page, "/src/services/TabGroupService.js");

  const ok = await page.evaluate(() => {
    const svc = window.__mod__.tabGroupService || window.__mod__.default;
    if (!svc) return false;
    // Only require the methods this test suite uses
    const required = ["handleTabUpdate", "collapseInactiveGroups"];
    return required.every(m => typeof svc[m] === "function");
  });
  expect(ok).toBe(true);
});

// --- TEST 2: import existing utils/state (integration) ---
test("Existing modules load (utils/state)", async ({ page }) => {
  const paths = [
    "/src/utils/BrowserAPI.js",
    "/src/utils/DomainUtils.js",
    "/src/utils/RulesUtils.js",
    "/src/utils/UrlPatternMatcher.js",
    "/src/state/TabGroupState.js"
  ];
  for (const p of paths) {
    await importOnOrigin(page, p);
  }
});

// --- TEST 3: pinned tab logic ---
test("TabGroupService handles pinned tabs correctly", async ({ page }) => {
  await page.addInitScript(() => {
    // Make the domain count >= minimum so grouping is allowed.
    browserAPI.tabs.query = async () => [
      { id: 2, url: "https://github.com", windowId: 1, pinned: false } // the unpinned tab we’ll update
    ];

    // Return pinned/unpinned on demand
    const getHook = async (tabId) =>
      tabId === 1
        ? { id: 1, url: "https://github.com", windowId: 1, pinned: true }
        : { id: 2, url: "https://github.com", windowId: 1, pinned: false };
    browserAPI.tabs.get = getHook;
    chrome.tabs.get = getHook;

    // Observe grouping
    const groupHook = async (opts) => { window.__grouped__ = true; window.__lastGroup__ = opts; return 1; };
    browserAPI.tabs.group = groupHook;
    chrome.tabs.group = groupHook;

    browserAPI.tabGroups.query = async () => [];
    browserAPI.tabGroups.update = async () => ({});

    // Provide minimal state ops some code checks
    globalThis.tabGroupState = {
      autoGroupingEnabled: true,
      groupByMode: "domain",
      customRules: new Map(),
      // some builds ask these; always allow with 1
      getMinimumTabsForDomain: () => 1,
      getMinimumTabsGlobal: () => 1
    };
  });

  await importOnOrigin(page, "/src/services/TabGroupService.js");

  const res = await page.evaluate(async () => {
    const svc = window.__mod__.tabGroupService || window.__mod__.default;
    const r1 = await svc.handleTabUpdate(1);       // pinned
    const c1 = !!window.__grouped__;
    window.__grouped__ = false;
    const r2 = await svc.handleTabUpdate(2);       // unpinned
    const c2 = !!window.__grouped__;
    return { r1, c1, r2, c2 };
  });

  expect(res.r1).toBe(false);   // pinned not grouped
  expect(res.c1).toBe(false);   // no group() call
  expect(res.r2).toBe(true);    // unpinned grouped
  expect(res.c2).toBe(true);    // group() called
});

// --- TEST 4: collapse inactive groups behaviour ---
test("TabGroupService collapses inactive groups correctly", async ({ page }) => {
  await page.addInitScript(() => {
    // Active tab 1 in group 1
    const getHook = async (tabId) =>
      tabId === 1
        ? { id: 1, url: "https://github.com", windowId: 1, groupId: 1 }
        : { id: 2, url: "https://example.com", windowId: 1, groupId: 2 };
    browserAPI.tabs.get = getHook;
    chrome.tabs.get = getHook;

    // Three groups exist; all uncollapsed initially
    browserAPI.tabGroups.query = async () => ([
      { id: 1, title: "github",  collapsed: false },
      { id: 2, title: "example", collapsed: false },
      { id: 3, title: "test",    collapsed: false }
    ]);

    // Capture collapse updates
    window.__updates__ = [];
    const upd = async (groupId, props) => { window.__updates__.push({ groupId, props }); return { id: groupId, ...props }; };
    browserAPI.tabGroups.update = upd;
    chrome.tabGroups.update = upd;

    globalThis.tabGroupState = {
      autoGroupingEnabled: true,
      collapseInactiveGroups: true,
      groupByMode: "domain",
      customRules: new Map()
    };
  });

  await importOnOrigin(page, "/src/services/TabGroupService.js");

  const out = await page.evaluate(async () => {
    const svc = window.__mod__.tabGroupService || window.__mod__.default;
    const ok = await svc.collapseInactiveGroups(1);
    return { ok, updates: window.__updates__ };
  });

  expect(out.ok).toBe(true);
  expect(out.updates).toHaveLength(2);
  const ids = out.updates.map(u => u.groupId).sort();
  expect(ids).toEqual([2, 3]);
  expect(out.updates.every(u => u.props.collapsed === true)).toBe(true);
});
