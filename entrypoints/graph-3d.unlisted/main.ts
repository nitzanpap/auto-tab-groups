import ForceGraph3D from "3d-force-graph"
import { forceCollide, forceX, forceY, forceZ } from "d3-force-3d"
import * as THREE from "three"
import {
  configureControlledCamera,
  focusCameraOnTarget,
  resetCameraOverview
} from "./modules/camera"
import { LevelOfDetailManager } from "./modules/focus"
import {
  calculateGroupConstellationPositions,
  calculateOrbitalPositions,
  createOrbitalForce,
  getGroupBoundingRadius
} from "./modules/layout"
import { buildNodeThreeObject } from "./modules/nodes"
import { type AmbientAtmosphere, setupSceneAtmosphere, setupViewportResize } from "./modules/scene"
import { SidebarController } from "./modules/sidebar"
import {
  type GraphLink,
  type GraphNode,
  type RawGroup,
  type RawTab,
  TAB_GROUP_HEX_COLORS,
  type VisualizerConfig
} from "./modules/types"

interface ForceGraphInstance {
  graphData: (data?: { nodes: GraphNode[]; links: GraphLink[] }) => ForceGraphInstance & { nodes: GraphNode[]; links: GraphLink[] }
  d3Force: (name: string, force?: any) => any
  camera: () => THREE.Camera | null
  controls: () => any
  scene: () => THREE.Scene
  renderer: () => any
  cameraPosition: (pos: { x: number; y: number; z: number }, target?: { x: number; y: number; z: number }, transitionMs?: number) => void
  zoomToFit: (transitionMs?: number, padding?: number) => void
  d3AlphaTarget: (target: number) => ForceGraphInstance
  resetCountdown: () => ForceGraphInstance
  width: (w?: number) => number
  height: (h?: number) => number
}

let graphInstance: ForceGraphInstance | null = null
let allNodes: GraphNode[] = []
let allLinks: GraphLink[] = []
let rawGroupsList: RawGroup[] = []
let ambientAtmosphere: AmbientAtmosphere | null = null
let sidebarController: SidebarController | null = null
let lodManager: LevelOfDetailManager | null = null
let lastClickedNode: GraphNode | null = null

const visualizerConfig: VisualizerConfig = {
  showAllTabs: true,
  ambientParticles: true,
  density: 1.0
}

/**
 * Handle activation of a tab in browser
 */
function activateTab(tabId: number, windowId?: number): void {
  browser.runtime.sendMessage({
    action: "activateTab",
    tabId,
    windowId
  })
}

/**
 * Focus smoothly on a specific group or node by ID
 */
function focusOnNode(nodeId: string): void {
  const node = allNodes.find(n => n.id === nodeId)

  // Handle group navigation from sidebar or HUD
  if (nodeId.startsWith("group-")) {
    if (nodeId === "group-root") {
      lodManager?.setActiveFocusedGroup(null)
      sidebarController?.setSelectedNode(allNodes.find(n => n.id === "group-root") || null)
      sidebarController?.updateGroupsList(rawGroupsList, rawTabsList, null)
      focusCameraOnTarget(graphInstance, { x: 0, y: 0, z: 0 }, 320, 800)
      return
    }

    if (nodeId === "group-ungrouped") {
      const ungroupedNodes = allNodes.filter(n => n.type === "page" && (!n.rawGroupId || n.rawGroupId === -1))
      if (ungroupedNodes.length > 0) {
        let avgX = 0, avgY = 0, avgZ = 0
        for (const n of ungroupedNodes) {
          avgX += n.x ?? n.relX ?? 0
          avgY += n.y ?? n.relY ?? 0
          avgZ += n.z ?? n.relZ ?? 0
        }
        avgX /= ungroupedNodes.length
        avgY /= ungroupedNodes.length
        avgZ /= ungroupedNodes.length
        lodManager?.setActiveFocusedGroup("group-ungrouped")
        sidebarController?.setSelectedNode(ungroupedNodes[0])
        sidebarController?.updateGroupsList(rawGroupsList, rawTabsList, "group-ungrouped")
        focusCameraOnTarget(graphInstance, { x: avgX, y: avgY, z: avgZ }, 180, 800)
      }
      return
    }

    const rawId = parseInt(nodeId.replace(/^group-/, ""), 10)
    const groupTabs = allNodes.filter(n => n.type === "page" && n.rawGroupId === rawId)
    if (groupTabs.length > 0) {
      let avgX = 0, avgY = 0, avgZ = 0
      for (const n of groupTabs) {
        avgX += n.x ?? n.relX ?? 0
        avgY += n.y ?? n.relY ?? 0
        avgZ += n.z ?? n.relZ ?? 0
      }
      avgX /= groupTabs.length
      avgY /= groupTabs.length
      avgZ /= groupTabs.length
      lodManager?.setActiveFocusedGroup(nodeId)
      sidebarController?.setSelectedNode(groupTabs[0])
      sidebarController?.updateGroupsList(rawGroupsList, rawTabsList, nodeId)
      focusCameraOnTarget(graphInstance, { x: avgX, y: avgY, z: avgZ }, 180, 800)
    }
    return
  }

  if (!node || node.x === undefined || node.y === undefined || node.z === undefined) return

  lastClickedNode = node
  sidebarController?.setSelectedNode(node)

  if (node.type === "group") {
    lodManager?.setActiveFocusedGroup(node.id)
    focusCameraOnTarget(graphInstance, { x: node.x, y: node.y, z: node.z }, 320, 800)
    sidebarController?.updateGroupsList(rawGroupsList, rawTabsList, node.id)
  } else {
    focusCameraOnTarget(graphInstance, { x: node.x, y: node.y, z: node.z }, 140, 800)
  }
}

let rawTabsList: RawTab[] = []

/**
 * Fetch open tabs & groups from extension background service
 */
async function loadGraphData(): Promise<void> {
  const container = document.getElementById("graph-container")
  if (!container) return

  try {
    const response = await browser.runtime.sendMessage({ action: "getGraphData" })
    if (!response || !response.tabs) return

    const rawTabs: RawTab[] = response.tabs
    const rawGroups: RawGroup[] = response.groups || []
    rawTabsList = rawTabs
    rawGroupsList = rawGroups

    // Update HUD counters
    const tabStats = document.getElementById("tabStats")
    if (tabStats) {
      tabStats.textContent = `${rawGroups.length} Groups • ${rawTabs.length} Tabs`
    }

    allNodes = []
    allLinks = []

    // Group tabs by parent group
    const tabsByGroup = new Map<number, RawTab[]>()
    const ungroupedTabs: RawTab[] = []

    for (const tab of rawTabs) {
      if (tab.groupId && tab.groupId !== -1) {
        const list = tabsByGroup.get(tab.groupId) || []
        list.push(tab)
        tabsByGroup.set(tab.groupId, list)
      } else {
        ungroupedTabs.push(tab)
      }
    }

    // Sort tabs into structured continuous angular sectors
    const sortedTabEntries: Array<{
      tab: RawTab
      color: string
      groupIdStr: string
      rawGroupId?: number
    }> = []

    // 1. Grouped tabs by group
    for (const group of rawGroups) {
      const gColor = TAB_GROUP_HEX_COLORS[group.color] || "#6366f1"
      const gTabs = tabsByGroup.get(group.id) || []
      for (const t of gTabs) {
        sortedTabEntries.push({
          tab: t,
          color: gColor,
          groupIdStr: `group-${group.id}`,
          rawGroupId: group.id
        })
      }
    }

    // 2. Ungrouped tabs
    for (const t of ungroupedTabs) {
      sortedTabEntries.push({
        tab: t,
        color: "#94a3b8",
        groupIdStr: "group-ungrouped",
        rawGroupId: undefined
      })
    }

    const totalCount = sortedTabEntries.length
    const rootGroupId = "group-root"
    const rootColor = rawGroups.length === 1 ? (TAB_GROUP_HEX_COLORS[rawGroups[0].color] || "#6366f1") : "#6366f1"
    const rootTitle = rawGroups.length === 1 ? (rawGroups[0].title || "Tab Space") : "Tab Space"

    // EXACTLY ONE LARGE CENTRAL SPHERE (Sun Core at 0,0,0)
    allNodes.push({
      id: rootGroupId,
      type: "group",
      name: rootTitle,
      color: rootColor,
      radius: 30,
      tabCount: totalCount,
      x: 0,
      y: 0,
      z: 0,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      fx: 0,
      fy: 0,
      fz: 0
    })

    // Calculate deterministic, spacious non-overlapping orbital positions
    const orbits = calculateOrbitalPositions(totalCount)

    // EXACTLY ONE SMALL BALL PER TAB (Connected directly to the central big sphere)
    for (let i = 0; i < sortedTabEntries.length; i++) {
      const entry = sortedTabEntries[i]
      const tab = entry.tab
      const pageNodeId = `tab-${tab.id}`
      const orb = orbits[i] || {
        radius: 180,
        angle: 0,
        tiltX: 0.12,
        tiltZ: 0.08,
        relX: 180,
        relY: 0,
        relZ: 0,
        labelDirX: 1,
        labelDirY: 0,
        labelDirZ: 0
      }

      allNodes.push({
        id: pageNodeId,
        type: "page",
        name: tab.title || "Untitled Tab",
        color: entry.color,
        radius: 9.0,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        tabId: tab.id,
        windowId: tab.windowId,
        groupId: entry.groupIdStr,
        rawGroupId: entry.rawGroupId,
        orbitalRadius: orb.radius,
        orbitalAngle: orb.angle,
        orbitalTiltX: orb.tiltX,
        orbitalTiltZ: orb.tiltZ,
        relX: orb.relX,
        relY: orb.relY,
        relZ: orb.relZ,
        labelDirX: orb.labelDirX,
        labelDirY: orb.labelDirY,
        labelDirZ: orb.labelDirZ
      })

      // Luminous thread/link connecting directly from central sun to this individual tab
      allLinks.push({
        source: rootGroupId,
        target: pageNodeId,
        color: `${entry.color}55`,
        groupId: rootGroupId
      })
    }

    // Update Sidebar groups listing
    sidebarController?.updateGroupsList(
      rawGroupsList,
      rawTabsList,
      lodManager?.getActiveFocusedGroup() || null
    )

    if (!graphInstance) {
      initGraph(container)
    } else {
      graphInstance.graphData({
        nodes: allNodes,
        links: allLinks
      })

      // Re-apply orbital force with updated nodes
      graphInstance.d3Force("orbital", createOrbitalForce(allNodes))

      resetCameraOverview(graphInstance, 1000)
    }
  } catch (err) {
    console.error("Failed to load graph data:", err)
  }
}

    // Update Sidebar groups listing
    sidebarController?.updateGroupsList(
      rawGroupsList,
      allNodes.filter(n => n.type === "group"),
      lodManager?.getActiveFocusedGroup() || null
    )

    if (!graphInstance) {
      initGraph(container)
    } else {
      graphInstance.graphData({
        nodes: allNodes,
        links: allLinks
      })

      // Re-apply custom forces with updated nodes
      graphInstance.d3Force("orbital", createOrbitalForce(allNodes))
      graphInstance.d3Force(
        "groupX",
        forceX((node: GraphNode) => {
          return node.type === "group" && node.targetX !== undefined ? node.targetX : 0
        }).strength((node: GraphNode) => (node.type === "group" ? 0.12 : 0))
      )
      graphInstance.d3Force(
        "groupY",
        forceY((node: GraphNode) => {
          return node.type === "group" && node.targetY !== undefined ? node.targetY : 0
        }).strength((node: GraphNode) => (node.type === "group" ? 0.12 : 0))
      )
      graphInstance.d3Force(
        "groupZ",
        forceZ((node: GraphNode) => {
          return node.type === "group" && node.targetZ !== undefined ? node.targetZ : 0
        }).strength((node: GraphNode) => (node.type === "group" ? 0.12 : 0))
      )

      resetCameraOverview(graphInstance, 1000)
    }
  } catch (err) {
    console.error("Failed to load graph data:", err)
  }
}

/**
 * Initialize 3D Graph instance with controlled physics and render hooks
 */
function initGraph(container: HTMLElement): void {
  lodManager = new LevelOfDetailManager()

  const fg = (ForceGraph3D as any)()(container)
    .backgroundColor("#05070f")
    .nodeThreeObject((node: GraphNode) => buildNodeThreeObject(node))
    .nodeThreeObjectExtend(false)
    .enableNodeDrag(true)
    .onNodeDrag((node: GraphNode, translate: { x: number; y: number; z: number }) => {
      if (node.type === "page") {
        // Transfer drag motion to parent group so satellites follow synchronously
        if (node.groupId) {
          const parentGroup = allNodes.find(n => n.id === node.groupId)
          if (parentGroup) {
            parentGroup.x = (parentGroup.x || 0) + translate.x
            parentGroup.y = (parentGroup.y || 0) + translate.y
            parentGroup.z = (parentGroup.z || 0) + translate.z
            parentGroup.fx = parentGroup.x
            parentGroup.fy = parentGroup.y
            parentGroup.fz = parentGroup.z
          }
        }
        delete node.fx
        delete node.fy
        delete node.fz
      } else if (node.type === "group") {
        node.fx = node.x
        node.fy = node.y
        node.fz = node.z
      }
    })
    .onNodeDragEnd((node: GraphNode) => {
      if (node.type === "page") {
        delete node.fx
        delete node.fy
        delete node.fz
        if (node.groupId) {
          const parentGroup = allNodes.find(n => n.id === node.groupId)
          if (parentGroup) {
            delete parentGroup.fx
            delete parentGroup.fy
            delete parentGroup.fz
          }
        }
      } else if (node.type === "group") {
        delete node.fx
        delete node.fy
        delete node.fz
      }
    })
    .showNavInfo(false)
    // Slower, smooth, high-damping physics to prevent chaotic movement
    .d3VelocityDecay(0.65)
    .warmupTicks(60)
    .cooldownTicks(90)
    .linkWidth((link: GraphLink) => (link.isChainLink ? 1.6 : 1.1))
    .linkColor((link: GraphLink) => link.color || "rgba(255, 255, 255, 0.15)")
    .linkCurvature((link: GraphLink) => (link.isChainLink ? 0.05 : 0.18))
    .linkCurveRotation((link: GraphLink) => (link.isChainLink ? 0 : Math.PI * 0.12))
    .linkDirectionalParticles((link: GraphLink) => (link.isChainLink ? 1 : 2))
    .linkDirectionalParticleSpeed(0.005)
    .linkDirectionalParticleWidth((link: GraphLink) => (link.isChainLink ? 1.4 : 2.0))
    .onNodeClick((node: GraphNode) => {
      lastClickedNode = node
      sidebarController?.setSelectedNode(node)

      if (node.type === "group") {
        focusOnNode(node.id)
      } else {
        if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
          focusCameraOnTarget(graphInstance, { x: node.x, y: node.y, z: node.z }, 140, 800)
        }
      }
    })
    .onBackgroundClick(() => {
      lastClickedNode = null
      sidebarController?.setSelectedNode(null)
      lodManager?.setActiveFocusedGroup(null)
      sidebarController?.updateGroupsList(
        rawGroupsList,
        rawTabsList,
        null
      )
    })

  graphInstance = fg as ForceGraphInstance

  // Controlled Force Physics:
  // 1. Constellation attraction forces towards target positions
  graphInstance.d3Force(
    "groupX",
    forceX((node: GraphNode) => {
      return node.type === "group" && node.targetX !== undefined ? node.targetX : 0
    }).strength((node: GraphNode) => (node.type === "group" ? 0.12 : 0))
  )
  graphInstance.d3Force(
    "groupY",
    forceY((node: GraphNode) => {
      return node.type === "group" && node.targetY !== undefined ? node.targetY : 0
    }).strength((node: GraphNode) => (node.type === "group" ? 0.12 : 0))
  )
  graphInstance.d3Force(
    "groupZ",
    forceZ((node: GraphNode) => {
      return node.type === "group" && node.targetZ !== undefined ? node.targetZ : 0
    }).strength((node: GraphNode) => (node.type === "group" ? 0.12 : 0))
  )

  // 2. Repulsion between group constellations
  graphInstance.d3Force("charge")?.strength((node: GraphNode) => {
    return node.type === "group" ? -600 : -20
  })

  // 3. Collision buffer for groups to prevent overlap based on their actual bounding radii
  graphInstance.d3Force(
    "collision",
    forceCollide((node: GraphNode) => {
      if (node.type === "group") {
        return getGroupBoundingRadius(node.tabCount || 0) + 30
      }
      return 14
    })
  )

  // 4. Custom deterministic orbital ring force for satellite tabs
  graphInstance.d3Force("orbital", createOrbitalForce(allNodes))

  // 5. Bounded space constraint
  graphInstance.d3Force("boxConstraint", () => {
    const bound = 900
    for (const node of allNodes) {
      if (node.x !== undefined) node.x = Math.max(-bound, Math.min(bound, node.x))
      if (node.y !== undefined) node.y = Math.max(-bound, Math.min(bound, node.y))
      if (node.z !== undefined) node.z = Math.max(-bound, Math.min(bound, node.z))
    }
  })

  // Setup Three.js lighting and ambient particles
  const scene: THREE.Scene = graphInstance.scene()
  ambientAtmosphere = setupSceneAtmosphere(scene)

  // Configure calm, bounded camera controls
  configureControlledCamera(graphInstance)

  // Setup responsive viewport resizing
  setupViewportResize(graphInstance)

  // Double click tab on canvas to switch to it
  const domElem = container.querySelector("canvas")
  if (domElem) {
    domElem.addEventListener("dblclick", () => {
      if (lastClickedNode && lastClickedNode.type === "page" && lastClickedNode.tabId) {
        activateTab(lastClickedNode.tabId, lastClickedNode.windowId)
      }
    })
  }

  // Right-click drag on a sphere: Push/Pull forward and backward along view depth
  let activeDepthNode: GraphNode | null = null
  let startPointerY = 0
  let isDepthDragging = false

  const domCanvas = domElem || container

  domCanvas.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button === 2) {
      // Right-click: raycast to detect if clicked on a sphere
      const rect = domCanvas.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      const camera = graphInstance?.camera()
      if (!camera) return

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)

      // 1. Check group nodes first
      const groupNodes = allNodes.filter(n => n.type === "group")
      const groupRoots = groupNodes.map(g => g.threeObj).filter(Boolean) as THREE.Object3D[]
      const groupHits = raycaster.intersectObjects(groupRoots, true)

      let targetNode: GraphNode | null = null

      if (groupHits.length > 0) {
        let curr: THREE.Object3D | null = groupHits[0].object
        while (curr && !curr.userData?.nodeId) {
          curr = curr.parent || null
        }
        if (curr?.userData?.nodeId) {
          targetNode = allNodes.find(n => n.id === curr.userData.nodeId) || null
        }
      }

      // 2. If no group hit, check visible page nodes
      if (!targetNode) {
        const visiblePages = allNodes.filter(n => n.type === "page" && n.threeObj?.visible)
        const pageRoots = visiblePages.map(p => p.threeObj).filter(Boolean) as THREE.Object3D[]
        const pageHits = raycaster.intersectObjects(pageRoots, true)
        if (pageHits.length > 0) {
          let curr: THREE.Object3D | null = pageHits[0].object
          while (curr && !curr.userData?.nodeId) {
            curr = curr.parent || null
          }
          if (curr?.userData?.nodeId) {
            const pageNode = allNodes.find(n => n.id === curr.userData.nodeId)
            if (pageNode?.groupId) {
              targetNode = allNodes.find(n => n.id === pageNode.groupId) || null
            }
          }
        }
      }

      if (
        targetNode &&
        targetNode.x !== undefined &&
        targetNode.y !== undefined &&
        targetNode.z !== undefined
      ) {
        activeDepthNode = targetNode
        startPointerY = event.clientY
        isDepthDragging = true

        // Temporarily disable OrbitControls to prevent panning camera during ball depth drag
        const controls = graphInstance?.controls()
        if (controls) {
          controls.enabled = false
        }
        document.body.style.cursor = "ns-resize"
      }
    }
  })

  window.addEventListener("pointermove", (event: PointerEvent) => {
    if (
      isDepthDragging &&
      activeDepthNode &&
      activeDepthNode.x !== undefined &&
      activeDepthNode.y !== undefined &&
      activeDepthNode.z !== undefined
    ) {
      const deltaY = event.clientY - startPointerY
      startPointerY = event.clientY

      const camera = graphInstance?.camera()
      if (!camera) return

      const camPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
      const nodePos = new THREE.Vector3(activeDepthNode.x, activeDepthNode.y, activeDepthNode.z)
      const viewDir = new THREE.Vector3().subVectors(nodePos, camPos).normalize()

      // Dragging UP (deltaY < 0): push backward (+viewDir)
      // Dragging DOWN (deltaY > 0): pull forward (-viewDir)
      const step = deltaY * 1.5
      const currentDist = nodePos.distanceTo(camPos)
      const targetDist = currentDist + step

      if (targetDist > 50 && targetDist < 1600) {
        activeDepthNode.x += viewDir.x * step
        activeDepthNode.y += viewDir.y * step
        activeDepthNode.z += viewDir.z * step

        activeDepthNode.fx = activeDepthNode.x
        activeDepthNode.fy = activeDepthNode.y
        activeDepthNode.fz = activeDepthNode.z

        graphInstance?.d3AlphaTarget(0.2).resetCountdown()
      }
    }
  })

  window.addEventListener("pointerup", (event: PointerEvent) => {
    if (event.button === 2 && isDepthDragging) {
      isDepthDragging = false
      if (activeDepthNode) {
        activeDepthNode.fx = activeDepthNode.x
        activeDepthNode.fy = activeDepthNode.y
        activeDepthNode.fz = activeDepthNode.z
        activeDepthNode = null
      }
      const controls = graphInstance?.controls()
      if (controls) {
        controls.enabled = true
      }
      document.body.style.cursor = ""
      graphInstance?.d3AlphaTarget(0)
    }
  })

  // Prevent right-click context menu on canvas
  domCanvas.addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault()
  })
  container.addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault()
  })

  // Populate graph data
  graphInstance.graphData({
    nodes: allNodes,
    links: allLinks
  })

  // Per-frame render loop hook for LOD and subtle particle motion
  let lastTime = performance.now()
  const renderLoop = (time: number) => {
    requestAnimationFrame(renderLoop)

    // Ambient particle drift
    if (visualizerConfig.ambientParticles && ambientAtmosphere) {
      ambientAtmosphere.update(time)
    }

    // Animate group rings & aura
    for (const node of allNodes) {
      if (node.type === "group" && node.threeObj?.userData) {
        const ring = node.threeObj.userData.ringMesh
        if (ring) {
          ring.rotation.z = time * 0.0008
        }
      }
    }

    // Distance-based Level of Detail update
    const camera = graphInstance?.camera()
    if (camera && lodManager) {
      lodManager.update(camera, allNodes, visualizerConfig)
    }

    lastTime = time
  }
  requestAnimationFrame(renderLoop)

  // Initial camera overview
  setTimeout(() => {
    if (graphInstance) {
      resetCameraOverview(graphInstance, 1200)
    }
  }, 350)
}

/**
 * Setup HUD toolbar controls and search
 */
function setupHudControls(): void {
  // Reset Camera View
  document.getElementById("btnResetView")?.addEventListener("click", () => {
    lodManager?.setActiveFocusedGroup(null)
    sidebarController?.setSelectedNode(null)
    sidebarController?.updateGroupsList(
      rawGroupsList,
      allNodes.filter(n => n.type === "group"),
      null
    )
    if (graphInstance) {
      resetCameraOverview(graphInstance, 1000)
    }
  })

  // Search input & clearing
  const searchInput = document.getElementById("graphSearch") as HTMLInputElement | null
  const clearSearchBtn = document.getElementById("btnClearSearch")

  searchInput?.addEventListener("input", (e: Event) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase().trim()
    if (clearSearchBtn) {
      clearSearchBtn.classList.toggle("hidden", query.length === 0)
    }

    if (!query || !graphInstance) return

    const matched = allNodes.find(
      n => n.name.toLowerCase().includes(query) || (n.url && n.url.toLowerCase().includes(query))
    )

    if (matched) {
      focusOnNode(matched.id)
    }
  })

  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = ""
      clearSearchBtn.classList.add("hidden")
      searchInput.focus()
    }
  })

  // AI Semantic Grouping button
  document
    .getElementById("btnSmartGroup")
    ?.addEventListener("click", async function (this: HTMLButtonElement) {
      this.disabled = true
      const origHtml = this.innerHTML
      this.innerHTML = `<span class="btn-icon">⏳</span> Grouping...`

      try {
        await browser.runtime.sendMessage({ action: "smartGroupTabs" })
        await loadGraphData()
      } catch (err) {
        console.error("AI Smart Grouping failed:", err)
      } finally {
        this.disabled = false
        this.innerHTML = origHtml
      }
    })
}

// Lifecycle bootstrap
document.addEventListener("DOMContentLoaded", () => {
  // Initialize sidebar controller
  sidebarController = new SidebarController({
    onGroupSelect: groupId => {
      focusOnNode(groupId)
    },
    onTabActivate: (tabId, windowId) => {
      activateTab(tabId, windowId)
    },
    onConfigChange: newConfig => {
      Object.assign(visualizerConfig, newConfig)
      if (newConfig.ambientParticles !== undefined && ambientAtmosphere) {
        ambientAtmosphere.setVisible(newConfig.ambientParticles)
      }
    }
  })

  setupHudControls()
  loadGraphData()

  // Browser Tabs runtime sync
  browser.tabs?.onCreated?.addListener(() => loadGraphData())
  browser.tabs?.onRemoved?.addListener(() => loadGraphData())
  browser.tabs?.onUpdated?.addListener(() => loadGraphData())
})
