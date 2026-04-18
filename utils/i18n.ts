/**
 * Internationalization helpers with runtime-overridable locale.
 *
 * Two translation paths:
 * 1. **Auto mode** (default) — defers to the browser's i18n API, which resolves
 *    against the user's browser UI locale. This is the WebExtensions-native
 *    behavior and also the only path that can localize manifest fields
 *    (extension name/description).
 * 2. **Override mode** — when the user picks a specific locale in the
 *    extension's language picker, we load `_locales/<lang>/messages.json`
 *    ourselves and resolve keys against that catalog. Falls back to
 *    `browser.i18n` → provided fallback → key on miss.
 *
 * HTML markup uses `data-i18n*` attributes; `applyI18nToDom()` translates them
 * in place. It can be called repeatedly (e.g. after a language change) to
 * re-translate without reloading the page.
 */

type Catalog = Record<string, string>

interface RawMessage {
  message: string
  description?: string
  placeholders?: Record<string, { content: string; example?: string }>
}

/**
 * When non-null, `t()` consults this catalog before `browser.i18n`. Reset to
 * null by calling `initI18n("auto")`.
 */
let activeCatalog: Catalog | null = null

/**
 * Locales that render right-to-left. Extend when adding more RTL languages.
 */
const RTL_LOCALES = new Set<string>(["he", "ar", "fa", "ur"])

/**
 * Loads a locale override catalog, or clears it for auto-mode. Safe to call
 * multiple times. Failure to fetch leaves the previous catalog in place if
 * any, otherwise auto-mode.
 */
export async function initI18n(locale: string): Promise<void> {
  if (locale === "auto") {
    activeCatalog = null
    return
  }

  try {
    // Cast: WXT narrows getURL to known public paths, but _locales JSON
    // files are present at runtime (browser copies public/_locales wholesale).
    const getUrl = browser.runtime.getURL as (path: string) => string
    const url = getUrl(`/_locales/${locale}/messages.json`)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status}`)
    }
    const raw = (await response.json()) as Record<string, RawMessage>
    const flattened: Catalog = {}
    for (const [key, value] of Object.entries(raw)) {
      if (value && typeof value.message === "string") {
        flattened[key] = resolveNamedPlaceholders(value.message, value.placeholders)
      }
    }
    activeCatalog = flattened
  } catch (error) {
    console.error(`[i18n] Failed to load locale "${locale}":`, error)
    activeCatalog = null
  }
}

/**
 * Resolves WebExtensions-style named placeholders (`$count$`, `$name$`, …)
 * to their positional form (`$1`, `$2`, …). Case-insensitive name match, per
 * the spec. Unknown placeholders are left intact so `applySubstitutions` can
 * still handle raw positional refs.
 */
function resolveNamedPlaceholders(
  message: string,
  placeholders: RawMessage["placeholders"]
): string {
  if (!placeholders) return message
  const lookup: Record<string, string> = {}
  for (const [name, def] of Object.entries(placeholders)) {
    if (def && typeof def.content === "string") {
      lookup[name.toLowerCase()] = def.content
    }
  }
  return message.replace(/\$([A-Za-z0-9_@]+)\$/g, (match, name: string) => {
    const replacement = lookup[name.toLowerCase()]
    return replacement ?? match
  })
}

/**
 * Resolves `$1`/`$2`/… WebExtensions-style positional substitutions.
 */
function applySubstitutions(message: string, substitutions?: string | string[]): string {
  if (!substitutions) return message
  const list = Array.isArray(substitutions) ? substitutions : [substitutions]
  return message.replace(/\$(\d+)/g, (_, index) => {
    const i = Number.parseInt(index, 10) - 1
    return list[i] ?? ""
  })
}

/**
 * Fetches a localized message by key. Consults the active override catalog
 * first, then the browser's i18n API, then the provided fallback.
 */
export function t(key: string, fallback?: string, substitutions?: string | string[]): string {
  if (activeCatalog) {
    const hit = activeCatalog[key]
    if (hit) return applySubstitutions(hit, substitutions)
  }

  try {
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
 * Returns the concrete locale that will be used for rendering. For `"auto"`,
 * consults the browser UI language. Always returns a bare language code
 * (e.g. "en", "he"), stripping any region (e.g. "en-US" → "en").
 */
export function resolveEffectiveLocale(userLocale: string): string {
  if (userLocale && userLocale !== "auto") return userLocale
  try {
    const uiLang = browser.i18n.getUILanguage?.() ?? "en"
    return uiLang.split("-")[0] || "en"
  } catch {
    return "en"
  }
}

/**
 * Sets `<html dir>` and `<html lang>` for the current document based on the
 * effective locale. Safe to call repeatedly; only touches attributes when
 * they change.
 */
export function applyDirectionToDom(effectiveLocale: string, root: Document = document): void {
  const dir = RTL_LOCALES.has(effectiveLocale) ? "rtl" : "ltr"
  const html = root.documentElement
  if (html.getAttribute("dir") !== dir) html.setAttribute("dir", dir)
  if (html.getAttribute("lang") !== effectiveLocale) html.setAttribute("lang", effectiveLocale)
}

/**
 * Walks the DOM and replaces text/attributes on elements tagged with
 * `data-i18n*` attributes. Safe to call multiple times — uses each element's
 * current text/attribute value as the fallback only on the first pass; on
 * later passes it looks up the stored original in a `data-i18n-orig*` attr
 * so re-translation keeps working after a language change.
 */
export function applyI18nToDom(root: ParentNode = document): void {
  const translateText = (el: HTMLElement, key: string | undefined) => {
    if (!key) return
    const originalAttr = "data-i18n-orig-text"
    const stored = el.getAttribute(originalAttr)
    const fallback = stored ?? el.textContent?.trim() ?? undefined
    if (stored === null && fallback) el.setAttribute(originalAttr, fallback)
    el.textContent = t(key, fallback)
  }

  const translateAttr = (el: HTMLElement, attrName: string, key: string | undefined) => {
    if (!key) return
    const originalAttr = `data-i18n-orig-${attrName}`
    const stored = el.getAttribute(originalAttr)
    const fallback = stored ?? el.getAttribute(attrName) ?? undefined
    if (stored === null && fallback) el.setAttribute(originalAttr, fallback)
    el.setAttribute(attrName, t(key, fallback))
  }

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    translateText(el, el.dataset.i18n)
  })

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach(el => {
    translateAttr(el, "title", el.getAttribute("data-i18n-title") ?? undefined)
  })

  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach(el => {
    translateAttr(el, "placeholder", el.getAttribute("data-i18n-placeholder") ?? undefined)
  })

  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach(el => {
    translateAttr(el, "aria-label", el.getAttribute("data-i18n-aria-label") ?? undefined)
  })

  root.querySelectorAll<HTMLElement>("[data-i18n-tooltip]").forEach(el => {
    translateAttr(el, "data-tooltip", el.getAttribute("data-i18n-tooltip") ?? undefined)
  })
}
