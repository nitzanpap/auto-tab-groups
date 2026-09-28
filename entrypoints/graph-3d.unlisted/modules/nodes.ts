import * as THREE from "three"
import { extractOrigin, faviconManager, getFaviconUrl } from "./favicon"
import type { GraphNode } from "./types"

export { extractOrigin, faviconManager, getFaviconUrl }

/**
 * Intelligently cleans and truncates tab titles for compact, readable 3D labels (14 chars + ...)
 */
export function formatTabTitle(rawTitle?: string, url?: string): string {
  if (!rawTitle || rawTitle.trim() === "") {
    if (url) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "")
        return host.length > 14 ? `${host.slice(0, 14)}…` : host
      } catch {
        return "Untitled Tab"
      }
    }
    return "Untitled Tab"
  }

  let title = rawTitle.trim()

  // Strip common redundant suffixes
  const suffixes = [
    " - Google Search",
    " - Google Chrome",
    " — Mozilla Firefox",
    " | GitHub",
    " - YouTube",
    " - Wikipedia",
    " · GitHub"
  ]

  for (const suf of suffixes) {
    if (title.endsWith(suf)) {
      title = title.slice(0, -suf.length).trim()
      break
    }
  }

  // Max 14 characters length cap followed by ellipsis
  const maxLength = 14
  if (title.length > maxLength) {
    return `${title.slice(0, maxLength).trimEnd()}…`
  }
  return title
}

/**
 * Creates high-DPI canvas text sprite for crisp labels with subtle frosted backdrop pill
 */
export function createTextSprite(
  text: string,
  fontSize = 20,
  textColor = "#ffffff",
  badgeColor?: string,
  countBadge?: string
): THREE.Sprite {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  const dpr = Math.min(window.devicePixelRatio || 2, 2)

  ctx.font = `600 ${fontSize}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  const textMetrics = ctx.measureText(text)
  const textWidth = Math.ceil(textMetrics.width)

  let countWidth = 0
  if (countBadge) {
    ctx.font = `600 ${Math.round(fontSize * 0.78)}px "Inter", -apple-system, sans-serif`
    countWidth = Math.ceil(ctx.measureText(countBadge).width) + 14
  }

  const padX = 12
  const padY = 6
  const gap = countBadge ? 6 : 0
  const totalWidth = textWidth + padX * 2 + countWidth + gap
  const totalHeight = fontSize + padY * 2

  canvas.width = totalWidth * dpr
  canvas.height = totalHeight * dpr
  ctx.scale(dpr, dpr)

  // Backdrop pill with dark glass effect
  const r = totalHeight / 2
  ctx.fillStyle = "rgba(10, 15, 30, 0.94)"
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(totalWidth - r, 0)
  ctx.quadraticCurveTo(totalWidth, 0, totalWidth, r)
  ctx.lineTo(totalWidth - r, totalHeight)
  ctx.quadraticCurveTo(totalWidth, totalHeight, totalWidth - r, totalHeight)
  ctx.lineTo(r, totalHeight)
  ctx.quadraticCurveTo(0, totalHeight, 0, totalHeight - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fill()

  // Crisp border with subtle glow or group accent
  ctx.strokeStyle = badgeColor || "rgba(255, 255, 255, 0.25)"
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Label text
  ctx.font = `600 ${fontSize}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.fillStyle = textColor
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(text, padX, totalHeight / 2 + 0.5)

  // Count pill badge if provided
  if (countBadge) {
    const pillHeight = Math.round(fontSize * 0.88)
    const pillY = (totalHeight - pillHeight) / 2
    const pillX = padX + textWidth + gap
    const pillR = pillHeight / 2

    ctx.fillStyle = badgeColor ? `${badgeColor}33` : "rgba(255, 255, 255, 0.12)"
    ctx.beginPath()
    ctx.moveTo(pillX + pillR, pillY)
    ctx.lineTo(pillX + countWidth - pillR, pillY)
    ctx.quadraticCurveTo(pillX + countWidth, pillY, pillX + countWidth, pillY + pillR)
    ctx.lineTo(pillX + countWidth, pillY + pillHeight - pillR)
    ctx.quadraticCurveTo(
      pillX + countWidth,
      pillY + pillHeight,
      pillX + countWidth - pillR,
      pillY + pillHeight
    )
    ctx.lineTo(pillX + pillR, pillY + pillHeight)
    ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - pillR)
    ctx.lineTo(pillX, pillY + pillR)
    ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY)
    ctx.closePath()
    ctx.fill()

    ctx.font = `600 ${Math.round(fontSize * 0.78)}px "Inter", -apple-system, sans-serif`
    ctx.fillStyle = badgeColor || "#94a3b8"
    ctx.textAlign = "center"
    ctx.fillText(countBadge, pillX + countWidth / 2, totalHeight / 2 + 0.5)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  })

  const sprite = new THREE.Sprite(material)
  const scaleFactor = 0.14
  sprite.scale.set(totalWidth * scaleFactor, totalHeight * scaleFactor, 1)
  ;(sprite as any).renderOrder = 25
  return sprite
}

/**
 * Creates circular favicon billboard sprite linked to the centralized FaviconManager cache
 */
export function createFaviconSprite(
  favIconUrl: string | undefined,
  domainFallback: string,
  radius: number,
  pageUrl?: string,
  badgeColor?: string
): THREE.Sprite {
  const origin = extractOrigin(pageUrl || favIconUrl || domainFallback)
  const texture = faviconManager.getTexture(origin, domainFallback, pageUrl, favIconUrl, badgeColor)

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  })

  const sprite = new THREE.Sprite(spriteMat)
  const spriteSize = radius * 2.3
  sprite.scale.set(spriteSize, spriteSize, 1)
  ;(sprite as any).renderOrder = 15
  return sprite
}

/**
 * Builds sleek Three.js Objects for Group (Sun core) and Tab nodes (Planetary spheres)
 */
export function buildNodeThreeObject(node: GraphNode): THREE.Object3D {
  const root = new THREE.Group()

  if (node.type === "group") {
    const radius = node.radius || 28

    // 1. Core glowing solar sun sphere
    const coreGeo = new THREE.SphereGeometry(radius * 0.85, 32, 32)
    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(node.color || "#6366f1"),
      emissive: new THREE.Color(node.color || "#6366f1"),
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.2
    })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    ;(coreMesh as any).renderOrder = 5
    root.add(coreMesh)

    // 2. Glossy frosted solar atmosphere outer shell
    const shellGeo = new THREE.SphereGeometry(radius, 32, 32)
    const shellMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(node.color || "#6366f1"),
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.55
    })
    const shellMesh = new THREE.Mesh(shellGeo, shellMat)
    ;(shellMesh as any).renderOrder = 6
    root.add(shellMesh)

    // 3. Volumetric Cluster Aura (soft boundary envelope)
    const auraGeo = new THREE.SphereGeometry(radius * 1.55, 24, 24)
    const auraMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color || "#6366f1"),
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const auraMesh = new THREE.Mesh(auraGeo, auraMat)
    ;(auraMesh as any).renderOrder = 2
    root.add(auraMesh)

    // 4. Glowing equatorial orbital accent ring
    const ringGeo = new THREE.TorusGeometry(radius * 1.35, 1.2, 16, 64)
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color || "#6366f1"),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    })
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    ringMesh.rotation.x = Math.PI * 0.35
    ringMesh.rotation.y = Math.PI * 0.1
    ;(ringMesh as any).renderOrder = 4
    root.add(ringMesh)

    // 5. Group Label Sprite with tab count badge above the sun core
    const groupLabel = createTextSprite(
      node.name,
      24,
      "#ffffff",
      node.color || "#6366f1",
      `${node.tabCount || 0}`
    )
    groupLabel.position.set(0, radius + 22, 0)
    ;(groupLabel as any).renderOrder = 25
    root.add(groupLabel)

    // Store materials and references on userData for LOD attenuation and animation
    root.userData = {
      type: "group",
      nodeId: node.id,
      labelSprite: groupLabel,
      coreMesh,
      shellMesh,
      auraMesh,
      ringMesh,
      materials: [coreMat, shellMat, auraMat, ringMat, groupLabel.material]
    }
  } else {
    // Tab Page Node: Small planetary sphere with favicon logo, glowing rim & adjacent side label
    const radius = node.radius || 9.0

    // 1. Backing 3D sphere disc for physical depth (small ball connected to line)
    const sphereGeo = new THREE.SphereGeometry(radius * 0.9, 20, 20)
    const sphereMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0a0f1d"),
      emissive: new THREE.Color(node.color || "#6366f1"),
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.2
    })
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat)
    sphereMesh.position.set(0, 0, -1)
    ;(sphereMesh as any).renderOrder = 8
    root.add(sphereMesh)

    // 2. Glowing Neon Rim Ring around the small sphere
    const rimGeo = new THREE.RingGeometry(radius * 0.95, radius * 1.18, 32)
    const rimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color || "#6366f1"),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
    const rimMesh = new THREE.Mesh(rimGeo, rimMat)
    rimMesh.position.set(0, 0, -0.5)
    ;(rimMesh as any).renderOrder = 9
    root.add(rimMesh)

    // 3. Favicon Billboard Sprite (represents site icon on the small ball)
    const domainFallback = node.url ? extractOrigin(node.url) : node.name
    const favSprite = createFaviconSprite(
      node.favIconUrl,
      domainFallback,
      radius,
      node.url,
      node.color
    )
    ;(favSprite as any).renderOrder = 15
    root.add(favSprite)

    // 4. Compact, elegant title label placed beside the small sphere
    const shortTitle = formatTabTitle(node.name, node.url)
    const labelSprite = createTextSprite(shortTitle, 18, "#f8fafc", node.color)

    // Offset label radially outward from the parent sun/group center so it sits next to the small ball
    const dirX = node.labelDirX ?? 1
    const dirY = node.labelDirY ?? 0
    const dirZ = node.labelDirZ ?? 0
    const labelDistance = radius + 22

    labelSprite.position.set(
      dirX * labelDistance,
      dirY * labelDistance,
      dirZ * labelDistance
    )
    ;(labelSprite as any).renderOrder = 25
    root.add(labelSprite)

    // Store references for LOD and interactions
    root.userData = {
      type: "page",
      nodeId: node.id,
      groupId: node.groupId,
      baseSphere: sphereMesh,
      rimMesh,
      favSprite,
      labelSprite,
      materials: [sphereMat, rimMat, favSprite.material, labelSprite.material]
    }

    // Always visible and interactive by default
    root.visible = true
  }

  node.threeObj = root
  return root
}

