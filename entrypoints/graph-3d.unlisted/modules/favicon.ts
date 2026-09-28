import * as THREE from "three"

export interface FaviconCacheEntry {
  texture: THREE.CanvasTexture
  canvas?: HTMLCanvasElement
  ctx?: CanvasRenderingContext2D
  status: "loading" | "loaded" | "failed"
  origin: string
}

/**
 * Extracts a normalized website origin or domain key from a given URL
 */
export function extractOrigin(url?: string): string {
  if (!url || typeof url !== "string") return ""
  const trimmed = url.trim()
  if (!trimmed) return ""

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const parsed = new URL(trimmed)
      return `${parsed.protocol}//${parsed.hostname}`
    }
    if (trimmed.startsWith("chrome://") || trimmed.startsWith("about:") || trimmed.startsWith("edge://")) {
      const parsed = new URL(trimmed)
      return `${parsed.protocol}//${parsed.hostname || "internal"}`
    }
    if (trimmed.startsWith("chrome-extension://") || trimmed.startsWith("moz-extension://")) {
      const parsed = new URL(trimmed)
      return `${parsed.protocol}//${parsed.host}`
    }
  } catch {
    // Fallback below
  }

  // Fallback regex for non-standard or partial URLs
  const match = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([^/:]+)/i)
  return match ? match[1].toLowerCase() : trimmed
}

/**
 * Resolves a safe URL for the favicon to prevent CORS blocks and tainted canvases.
 * Direct data / blob URLs and explicit favicons are preserved, falling back to Chrome's _favicon API or Google S2.
 */
export function getFaviconUrl(pageUrl?: string, favIconUrl?: string, size = 64): string | null {
  // 1. Direct data: or blob: favicons are self-contained and safest
  if (
    favIconUrl &&
    (favIconUrl.startsWith("data:") ||
      favIconUrl.startsWith("blob:") ||
      favIconUrl.startsWith("chrome-extension://") ||
      favIconUrl.startsWith("moz-extension://"))
  ) {
    return favIconUrl
  }

  // 2. In Chrome extension context, use Chrome's internal _favicon API if supported
  if (
    pageUrl &&
    (pageUrl.startsWith("http://") ||
      pageUrl.startsWith("https://") ||
      pageUrl.startsWith("chrome://"))
  ) {
    try {
      const getURL =
        typeof chrome !== "undefined" && chrome?.runtime?.getURL
          ? chrome.runtime.getURL.bind(chrome.runtime)
          : typeof browser !== "undefined" && (browser as any)?.runtime?.getURL
            ? (browser as any).runtime.getURL.bind((browser as any).runtime)
            : null

      if (getURL) {
        const u = new URL(getURL("/_favicon/"))
        u.searchParams.set("pageUrl", pageUrl)
        u.searchParams.set("size", size.toString())
        return u.toString()
      }
    } catch {
      // Fallback below
    }
  }

  // 3. Direct valid http/https favIconUrl
  if (
    favIconUrl &&
    (favIconUrl.startsWith("http://") || favIconUrl.startsWith("https://"))
  ) {
    return favIconUrl
  }

  // 4. Fallback to Google S2 favicon service for public websites if pageUrl is available
  if (pageUrl && (pageUrl.startsWith("http://") || pageUrl.startsWith("https://"))) {
    try {
      const hostname = new URL(pageUrl).hostname
      if (hostname && !hostname.includes("localhost") && !hostname.startsWith("127.")) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`
      }
    } catch {
      // Fallback to null
    }
  }

  return null
}

export class FaviconManager {
  private cache = new Map<string, FaviconCacheEntry>()
  private inFlightLoads = new Map<string, Promise<void>>()

  /**
   * Draws a crisp circular monogram fallback icon on a canvas
   */
  public drawFallback(
    ctx: CanvasRenderingContext2D,
    domainFallback: string,
    badgeColor = "#6366f1"
  ): void {
    const size = 128
    ctx.clearRect(0, 0, size, size)

    // Outer subtle glow / background circle
    ctx.beginPath()
    ctx.arc(64, 64, 58, 0, Math.PI * 2)
    ctx.fillStyle = "#0f172a"
    ctx.fill()

    // Outer ring with badge accent color
    ctx.strokeStyle = badgeColor || "rgba(255, 255, 255, 0.35)"
    ctx.lineWidth = 5
    ctx.stroke()

    // Inner subtle fill circle
    ctx.beginPath()
    ctx.arc(64, 64, 48, 0, Math.PI * 2)
    ctx.fillStyle = "#1e293b"
    ctx.fill()

    // Clean stylized monogram letter
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 46px Inter, -apple-system, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    let char = "📄"
    if (domainFallback && domainFallback.trim().length > 0) {
      const clean = domainFallback.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").trim()
      if (clean.length > 0) {
        char = clean[0].toUpperCase()
      }
    }
    ctx.fillText(char, 64, 66)
  }

  /**
   * Draws a successfully loaded favicon image onto the circular badge
   */
  public drawFaviconImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    badgeColor = "#6366f1"
  ): void {
    const size = 128
    ctx.clearRect(0, 0, size, size)

    // Outer base circle
    ctx.beginPath()
    ctx.arc(64, 64, 60, 0, Math.PI * 2)
    ctx.fillStyle = "#0f172a"
    ctx.fill()

    // Highlighted colored border matching group
    ctx.strokeStyle = badgeColor || "rgba(255, 255, 255, 0.45)"
    ctx.lineWidth = 5
    ctx.stroke()

    // Inner background circle for contrast
    ctx.beginPath()
    ctx.arc(64, 64, 48, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()

    // Clipped circular icon image
    ctx.save()
    ctx.beginPath()
    ctx.arc(64, 64, 46, 0, Math.PI * 2)
    ctx.clip()

    // Center image cleanly inside inner circle
    const iconSize = 74
    const offset = (size - iconSize) / 2
    ctx.drawImage(img, offset, offset, iconSize, iconSize)
    ctx.restore()
  }

  /**
   * Retrieves or creates a cached Three.js CanvasTexture for a website origin.
   * Multiple tabs from the same origin share a single texture and single network load.
   */
  public getTexture(
    origin: string,
    domainFallback: string,
    pageUrl?: string,
    favIconUrl?: string,
    badgeColor = "#6366f1"
  ): THREE.CanvasTexture {
    const cacheKey = origin || domainFallback || "default-origin"

    const existing = this.cache.get(cacheKey)
    if (existing) {
      return existing.texture
    }

    let canvas: HTMLCanvasElement | undefined
    let ctx: CanvasRenderingContext2D | undefined

    if (typeof document !== "undefined") {
      canvas = document.createElement("canvas")
      canvas.width = 128
      canvas.height = 128
      ctx = canvas.getContext("2d") || undefined
    }

    const texture = new THREE.CanvasTexture(canvas || {})
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false

    const entry: FaviconCacheEntry = {
      texture,
      canvas,
      ctx,
      status: "loading",
      origin: cacheKey
    }

    this.cache.set(cacheKey, entry)

    // Render immediate crisp fallback monogram so the node is never blank while loading
    if (ctx) {
      this.drawFallback(ctx, domainFallback, badgeColor)
      texture.needsUpdate = true
    }

    // Initiate single asynchronous load for this origin
    if (typeof Image !== "undefined" && ctx) {
      this.loadFavicon(cacheKey, domainFallback, pageUrl, favIconUrl, badgeColor)
    }

    return texture
  }

  private async loadFavicon(
    cacheKey: string,
    domainFallback: string,
    pageUrl?: string,
    favIconUrl?: string,
    badgeColor = "#6366f1"
  ): Promise<void> {
    if (this.inFlightLoads.has(cacheKey)) {
      return this.inFlightLoads.get(cacheKey)
    }

    const loadPromise = new Promise<void>(resolve => {
      const entry = this.cache.get(cacheKey)
      if (!entry || !entry.ctx) {
        resolve()
        return
      }

      const safeUrl = getFaviconUrl(pageUrl, favIconUrl, 64)
      if (!safeUrl) {
        entry.status = "failed"
        this.drawFallback(entry.ctx, domainFallback, badgeColor)
        entry.texture.needsUpdate = true
        resolve()
        return
      }

      const img = new Image()
      // Only set crossOrigin on remote HTTP/HTTPS endpoints to prevent chrome-extension:// CORS failure
      if (safeUrl.startsWith("http://") || safeUrl.startsWith("https://")) {
        img.crossOrigin = "anonymous"
      }

      img.onload = () => {
        if (entry.ctx) {
          this.drawFaviconImage(entry.ctx, img, badgeColor)
          entry.status = "loaded"
          entry.texture.needsUpdate = true
        }
        resolve()
      }

      img.onerror = () => {
        // If Chrome _favicon or primary URL fails, try secondary S2 or fallback to monogram
        if (pageUrl && !safeUrl.includes("google.com/s2/favicons")) {
          try {
            const host = new URL(pageUrl).hostname
            if (host && !host.includes("localhost") && !host.startsWith("127.")) {
              const fallbackImg = new Image()
              fallbackImg.crossOrigin = "anonymous"
              fallbackImg.onload = () => {
                if (entry.ctx) {
                  this.drawFaviconImage(entry.ctx, fallbackImg, badgeColor)
                  entry.status = "loaded"
                  entry.texture.needsUpdate = true
                }
                resolve()
              }
              fallbackImg.onerror = () => {
                entry.status = "failed"
                if (entry.ctx) {
                  this.drawFallback(entry.ctx, domainFallback, badgeColor)
                  entry.texture.needsUpdate = true
                }
                resolve()
              }
              fallbackImg.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
              return
            }
          } catch {
            // Ignore
          }
        }

        entry.status = "failed"
        if (entry.ctx) {
          this.drawFallback(entry.ctx, domainFallback, badgeColor)
          entry.texture.needsUpdate = true
        }
        resolve()
      }

      img.src = safeUrl
    })

    this.inFlightLoads.set(cacheKey, loadPromise)
    try {
      await loadPromise
    } finally {
      this.inFlightLoads.delete(cacheKey)
    }
  }

  public clearCache(): void {
    for (const entry of this.cache.values()) {
      entry.texture.dispose()
    }
    this.cache.clear()
    this.inFlightLoads.clear()
  }
}

export const faviconManager = new FaviconManager()
