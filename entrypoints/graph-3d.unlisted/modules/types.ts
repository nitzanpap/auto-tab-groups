import type * as THREE from "three"

export type TabGroupColor =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | "orange"

export const TAB_GROUP_HEX_COLORS: Record<string, string> = {
  grey: "#94a3b8",
  blue: "#3b82f6",
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
  pink: "#ec4899",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316"
}

export interface RawTab {
  id: number
  groupId: number
  title: string
  url: string
  favIconUrl: string
  windowId: number
  active: boolean
  pinned: boolean
}

export interface RawGroup {
  id: number
  title: string
  color: string
  collapsed: boolean
  windowId: number
}

export interface GraphNode {
  id: string
  type: "group" | "page"
  name: string
  color: string
  radius: number
  tabCount?: number
  url?: string
  favIconUrl?: string
  tabId?: number
  windowId?: number
  groupId?: string
  rawGroupId?: number
  ringIndex?: number
  ringAngle?: number
  clusterRadius?: number
  orbitalRadius?: number
  orbitalAngle?: number
  orbitalTiltX?: number
  orbitalTiltZ?: number
  relX?: number
  relY?: number
  relZ?: number
  labelDirX?: number
  labelDirY?: number
  labelDirZ?: number
  targetX?: number
  targetY?: number
  targetZ?: number
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
  vx?: number
  vy?: number
  vz?: number
  threeObj?: THREE.Object3D
}

export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  color: string
  groupId: string
  isChainLink?: boolean
}

export interface VisualizerConfig {
  showAllTabs: boolean
  ambientParticles: boolean
  density: number
}
