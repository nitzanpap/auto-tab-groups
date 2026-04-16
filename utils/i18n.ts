/**
 * Internationalization helpers built on top of the browser.i18n API.
 *
 * Translations live in `public/_locales/<lang>/messages.json`, following the
 * WebExtension i18n spec. The browser selects the active locale automatically
 * based on the user's browser language, falling back to the default_locale
 * declared in the manifest.
 *
 * Usage:
 *   - In TypeScript: `t("popupGroupTabs", "Group Tabs")` to fetch a message
 *     with an English fallback if the key is missing.
 *   - In HTML: add `data-i18n="messageKey"` to an element to localize its
 *     text content, or `data-i18n-title="messageKey"` to localize its title
 *     attribute. Call `applyI18nToDom()` once the DOM is ready.
 */

/**
 * Fetches a localized message by key. Returns the provided fallback (or the
 * key itself) when the message is missing — useful during development and
 * for locales that are not yet translated.
 */
export function t(key: string, fallback?: string, substitutions?: string | string[]): string {
  try {
    // Cast is needed because WXT generates a narrow union from messages.json
    // but we want to allow callers to pass any key and fall back gracefully
    // if it's missing (e.g. during development when a key is not yet added).
    const getMessage = browser.i18n.getMessage as (
      key: string,
      substitutions?: string | string[]
    ) => string
    const message = getMessage(key, substitutions)
    if (message) return message
  } catch {
    // browser.i18n may be unavailable in some runtimes (e.g. tests)
  }
  return fallback ?? key
}

/**
 * Walks the DOM and replaces text/attributes on elements tagged with
 * `data-i18n*` attributes. Safe to call multiple times.
 */
export function applyI18nToDom(root: ParentNode = document): void {
  // Translate text content
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n
    if (!key) return
    const fallback = el.textContent?.trim() || undefined
    el.textContent = t(key, fallback)
  })

  // Translate `title` attributes
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title")
    if (!key) return
    const fallback = el.getAttribute("title") || undefined
    el.setAttribute("title", t(key, fallback))
  })

  // Translate `placeholder` attributes
  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder")
    if (!key) return
    const fallback = el.getAttribute("placeholder") || undefined
    el.setAttribute("placeholder", t(key, fallback))
  })

  // Translate `aria-label` / `data-tooltip` attributes
  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria-label")
    if (!key) return
    const fallback = el.getAttribute("aria-label") || undefined
    el.setAttribute("aria-label", t(key, fallback))
  })

  root.querySelectorAll<HTMLElement>("[data-i18n-tooltip]").forEach(el => {
    const key = el.getAttribute("data-i18n-tooltip")
    if (!key) return
    const fallback = el.getAttribute("data-tooltip") || undefined
    el.setAttribute("data-tooltip", t(key, fallback))
  })
}
