import type { GraphNode } from "./types"

export interface TabOrbitalPosition {
  ringIndex: number
  radius: number
  angle: number
  tiltX: number
  tiltZ: number
  relX: number
  relY: number
  relZ: number
  labelDirX: number
  labelDirY: number
  labelDirZ: number
}

/**
 * Calculates the full spatial bounding radius of a group including all orbital rings, tab nodes, and outer labels.
 */
export function getGroupBoundingRadius(tabCount: number): number {
  if (tabCount <= 0) return 60
  if (tabCount <= 8) return 240
  if (tabCount <= 20) return 380
  if (tabCount <= 36) return 520
  return 660 + Math.min(200, (tabCount - 36) * 6)
}

function computeRelCoords(radius: number, angle: number, ringZOffset = 0) {
  const rawX = radius * Math.cos(angle)
  const rawY = radius * Math.sin(angle)

  // Orient primarily on the visible camera plane (X-Y) with gentle 3D depth tilt
  const relX = rawX
  const relY = rawY * 0.95
  const relZ = rawY * 0.18 + rawX * 0.1 + ringZOffset

  // Normalized radial direction for outward label placement beside the small ball
  const len = Math.sqrt(relX * relX + relY * relY + relZ * relZ) || 1
  const labelDirX = relX / len
  const labelDirY = relY / len
  const labelDirZ = relZ / len

  return { relX, relY, relZ, labelDirX, labelDirY, labelDirZ }
}

/**
 * Calculates deterministic concentric orbital parameters for N tabs in a group/hub.
 * Generous radii (180, 320, 460) and staggered angles guarantee zero overlap between tabs and labels.
 */
export function calculateOrbitalPositions(tabCount: number): TabOrbitalPosition[] {
  const positions: TabOrbitalPosition[] = []
  if (tabCount <= 0) return positions

  // Single spacious ring for up to 8 tabs
  if (tabCount <= 8) {
    const radius = Math.max(170, 160 + tabCount * 6)
    for (let i = 0; i < tabCount; i++) {
      const angle = (i * 2 * Math.PI) / tabCount
      const coords = computeRelCoords(radius, angle, 0)
      positions.push({
        ringIndex: 0,
        radius,
        angle,
        tiltX: 0.12,
        tiltZ: 0.08,
        ...coords
      })
    }
    return positions
  }

  // Two concentric rings for 9 to 20 tabs
  if (tabCount <= 20) {
    const innerCount = Math.min(6, Math.max(4, Math.floor(tabCount * 0.35)))
    const outerCount = tabCount - innerCount

    const rInner = 180
    const rOuter = 320

    for (let i = 0; i < innerCount; i++) {
      const angle = (i * 2 * Math.PI) / innerCount
      const coords = computeRelCoords(rInner, angle, 10)
      positions.push({
        ringIndex: 0,
        radius: rInner,
        angle,
        tiltX: 0.12,
        tiltZ: 0.08,
        ...coords
      })
    }

    for (let i = 0; i < outerCount; i++) {
      // Offset outer ring angle for interlaced visual clarity and zero ray crossing
      const angle = (i * 2 * Math.PI) / outerCount + Math.PI / outerCount
      const coords = computeRelCoords(rOuter, angle, -10)
      positions.push({
        ringIndex: 1,
        radius: rOuter,
        angle,
        tiltX: 0.12,
        tiltZ: 0.08,
        ...coords
      })
    }
    return positions
  }

  // Three concentric rings for 21 to 36 tabs
  if (tabCount <= 36) {
    const ring0Count = 5
    const ring1Count = 11
    const ring2Count = tabCount - ring0Count - ring1Count

    const r0 = 180
    const r1 = 320
    const r2 = 460

    for (let i = 0; i < ring0Count; i++) {
      const angle = (i * 2 * Math.PI) / ring0Count
      const coords = computeRelCoords(r0, angle, 16)
      positions.push({ ringIndex: 0, radius: r0, angle, tiltX: 0.12, tiltZ: 0.08, ...coords })
    }

    for (let i = 0; i < ring1Count; i++) {
      const angle = (i * 2 * Math.PI) / ring1Count + Math.PI / ring1Count
      const coords = computeRelCoords(r1, angle, 0)
      positions.push({ ringIndex: 1, radius: r1, angle, tiltX: 0.12, tiltZ: 0.08, ...coords })
    }

    for (let i = 0; i < ring2Count; i++) {
      const angle = (i * 2 * Math.PI) / ring2Count + 0.35
      const coords = computeRelCoords(r2, angle, -16)
      positions.push({ ringIndex: 2, radius: r2, angle, tiltX: 0.12, tiltZ: 0.08, ...coords })
    }

    return positions
  }

  // Four concentric rings for 37+ tabs
  const r0Count = 5
  const r1Count = 10
  const r2Count = 16
  const r3Count = tabCount - r0Count - r1Count - r2Count

  const r0 = 180
  const r1 = 320
  const r2 = 460
  const r3 = 600 + Math.max(0, (r3Count - 16) * 4)

  const ringConfigs = [
    { count: r0Count, r: r0, offset: 0, z: 20 },
    { count: r1Count, r: r1, offset: Math.PI / r1Count, z: 8 },
    { count: r2Count, r: r2, offset: 0.3, z: -8 },
    { count: r3Count, r: r3, offset: 0.6, z: -20 }
  ]

  ringConfigs.forEach((cfg, ringIdx) => {
    for (let i = 0; i < cfg.count; i++) {
      const angle = (i * 2 * Math.PI) / cfg.count + cfg.offset
      const coords = computeRelCoords(cfg.r, angle, cfg.z)
      positions.push({
        ringIndex: ringIdx,
        radius: cfg.r,
        angle,
        tiltX: 0.12,
        tiltZ: 0.08,
        ...coords
      })
    }
  })

  return positions
}

/**
 * Calculates expansive 3D constellation positions for multiple group nodes,
 * preventing cluster congestion and ensuring massive clearance between clusters.
 */
export function calculateGroupConstellationPositions(
  groups: Array<{ id: string; tabCount: number }>
): Map<string, { x: number; y: number; z: number }> {
  const positions = new Map<string, { x: number; y: number; z: number }>()
  const n = groups.length
  if (n === 0) return positions

  if (n === 1) {
    positions.set(groups[0].id, { x: 0, y: 0, z: 0 })
    return positions
  }

  if (n === 2) {
    const r0 = getGroupBoundingRadius(groups[0].tabCount)
    const r1 = getGroupBoundingRadius(groups[1].tabCount)
    const dist = Math.max(380, (r0 + r1 + 160) / 2)
    positions.set(groups[0].id, { x: -dist, y: 0, z: 0 })
    positions.set(groups[1].id, { x: dist, y: 0, z: 0 })
    return positions
  }

  // 3 or more groups: distribute in a spacious 3D constellation ring with gentle depth offsets
  let totalDiameter = 0
  for (const g of groups) {
    totalDiameter += getGroupBoundingRadius(g.tabCount) * 2 + 160
  }
  const constellationRadius = Math.max(500, totalDiameter / (2 * Math.PI))

  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n
    const x = constellationRadius * Math.cos(angle)
    const y = constellationRadius * Math.sin(angle) * 0.75
    const z = Math.sin(angle * 2) * 60

    positions.set(groups[i].id, { x, y, z })
  }

  return positions
}

/**
 * Custom d3-force ticking layout that anchors tabs in their deterministic orbital rings around their parent group.
 */
export function createOrbitalForce(nodes: GraphNode[]) {
  return () => {
    // Map groups by ID for quick lookup
    const groupMap = new Map<string, GraphNode>()
    for (const node of nodes) {
      if (node.type === "group") {
        groupMap.set(node.id, node)
      }
    }

    for (const node of nodes) {
      if (node.type === "page" && node.groupId) {
        const group = groupMap.get(node.groupId)
        if (group && group.x !== undefined && group.y !== undefined && group.z !== undefined) {
          const relX = (node as any).__relX ?? node.relX
          const relY = (node as any).__relY ?? node.relY
          const relZ = (node as any).__relZ ?? node.relZ

          if (relX !== undefined && relY !== undefined && relZ !== undefined) {
            node.x = group.x + relX
            node.y = group.y + relY
            node.z = group.z + relZ
          } else {
            const radius = (node as any).__orbitalRadius ?? node.orbitalRadius ?? 180
            const angle = (node as any).__orbitalAngle ?? node.orbitalAngle ?? 0
            const rawX = radius * Math.cos(angle)
            const rawY = radius * Math.sin(angle)
            node.x = group.x + rawX
            node.y = group.y + rawY * 0.95
            node.z = group.z + rawY * 0.18 + rawX * 0.1
          }

          // Zero out physics velocities so tabs remain rigidly linked to their group
          node.vx = 0
          node.vy = 0
          node.vz = 0
        }
      }
    }
  }
}

