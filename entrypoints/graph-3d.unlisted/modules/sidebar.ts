import { getFaviconUrl } from "./nodes"
import type { GraphNode, RawGroup, VisualizerConfig } from "./types"

export interface SidebarCallbacks {
  onGroupSelect: (groupId: string) => void
  onTabActivate: (tabId: number, windowId?: number) => void
  onConfigChange: (newConfig: Partial<VisualizerConfig>) => void
}

export class SidebarController {
  private drawerElem: HTMLElement | null
  private emptyStateElem: HTMLElement | null
  private inspectorContentElem: HTMLElement | null
  private inspectorBadge: HTMLElement | null
  private inspectorSubBadge: HTMLElement | null
  private inspectorFavicon: HTMLImageElement | null
  private inspectorTitle: HTMLElement | null
  private inspectorUrl: HTMLElement | null
  private btnInspectorAction: HTMLButtonElement | null
  private groupsListElem: HTMLElement | null
  private groupsCountBadge: HTMLElement | null

  private selectedNode: GraphNode | null = null
  private callbacks: SidebarCallbacks

  constructor(callbacks: SidebarCallbacks) {
    this.callbacks = callbacks

    this.drawerElem = document.getElementById("sidebarDrawer")
    this.emptyStateElem = document.getElementById("inspectorEmptyState")
    this.inspectorContentElem = document.getElementById("inspectorContent")
    this.inspectorBadge = document.getElementById("inspectorBadge")
    this.inspectorSubBadge = document.getElementById("inspectorSubBadge")
    this.inspectorFavicon = document.getElementById("inspectorFavicon") as HTMLImageElement | null
    this.inspectorTitle = document.getElementById("inspectorTitle")
    this.inspectorUrl = document.getElementById("inspectorUrl")
    this.btnInspectorAction = document.getElementById("btnInspectorAction") as HTMLButtonElement | null
    this.groupsListElem = document.getElementById("groupsList")
    this.groupsCountBadge = document.getElementById("groupsCountBadge")

    if (this.inspectorFavicon) {
      this.inspectorFavicon.addEventListener("error", () => {
        this.inspectorFavicon?.classList.add("hidden")
      })
    }

    this.bindEvents()
  }

  private bindEvents(): void {
    document.getElementById("btnToggleSidebar")?.addEventListener("click", () => {
      this.toggle()
    })

    document.getElementById("btnCloseSidebar")?.addEventListener("click", () => {
      this.close()
    })

    document.getElementById("toggleShowAllTabs")?.addEventListener("change", (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked
      this.callbacks.onConfigChange({ showAllTabs: checked })
    })

    document.getElementById("toggleAtmosphere")?.addEventListener("change", (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked
      this.callbacks.onConfigChange({ ambientParticles: checked })
    })

    this.btnInspectorAction?.addEventListener("click", () => {
      if (this.selectedNode) {
        if (this.selectedNode.type === "page" && this.selectedNode.tabId) {
          this.callbacks.onTabActivate(this.selectedNode.tabId, this.selectedNode.windowId)
        } else if (this.selectedNode.type === "group") {
          this.callbacks.onGroupSelect(this.selectedNode.id)
        }
      }
    })
  }

  public open(): void {
    this.drawerElem?.classList.remove("hidden")
  }

  public close(): void {
    this.drawerElem?.classList.add("hidden")
  }

  public toggle(): void {
    this.drawerElem?.classList.toggle("hidden")
  }

  public setSelectedNode(node: GraphNode | null): void {
    this.selectedNode = node
    if (!node) {
      this.emptyStateElem?.classList.remove("hidden")
      this.inspectorContentElem?.classList.add("hidden")
      return
    }

    this.emptyStateElem?.classList.add("hidden")
    this.inspectorContentElem?.classList.remove("hidden")

    if (this.inspectorTitle) {
      this.inspectorTitle.textContent = node.name
    }

    if (this.inspectorBadge) {
      this.inspectorBadge.textContent = node.type.toUpperCase()
      this.inspectorBadge.style.backgroundColor = node.color || "#6366f1"
    }

    if (node.type === "group") {
      if (this.inspectorSubBadge) {
        this.inspectorSubBadge.textContent = `${node.tabCount || 0} tabs`
      }
      if (this.inspectorFavicon) {
        this.inspectorFavicon.classList.add("hidden")
      }
      if (this.inspectorUrl) {
        this.inspectorUrl.textContent = `Group ID: ${node.id}`
      }
      if (this.btnInspectorAction) {
        this.btnInspectorAction.textContent = "Focus Group"
      }
    } else {
      if (this.inspectorSubBadge) {
        this.inspectorSubBadge.textContent = node.groupId ? `Belongs to group` : "Ungrouped"
      }
      if (this.inspectorFavicon) {
        const safeUrl = getFaviconUrl(node.url, node.favIconUrl, 32)
        if (safeUrl) {
          this.inspectorFavicon.src = safeUrl
          this.inspectorFavicon.classList.remove("hidden")
        } else {
          this.inspectorFavicon.classList.add("hidden")
        }
      }
      if (this.inspectorUrl) {
        this.inspectorUrl.textContent = node.url || ""
      }
      if (this.btnInspectorAction) {
        this.btnInspectorAction.textContent = "Switch to Tab"
      }
    }
  }

  public updateGroupsList(groups: RawGroup[], tabs: RawTab[], activeGroupId: string | null): void {
    if (!this.groupsListElem) return

    if (this.groupsCountBadge) {
      this.groupsCountBadge.textContent = `${groups.length}`
    }

    this.groupsListElem.innerHTML = ""

    // Count tabs per group
    const tabsCountMap = new Map<number, number>()
    let ungroupedCount = 0
    for (const t of tabs) {
      if (t.groupId && t.groupId !== -1) {
        tabsCountMap.set(t.groupId, (tabsCountMap.get(t.groupId) || 0) + 1)
      } else {
        ungroupedCount++
      }
    }

    for (const g of groups) {
      const gIdStr = `group-${g.id}`
      const item = document.createElement("div")
      item.className = `group-nav-item ${activeGroupId === gIdStr ? "active" : ""}`
      item.dataset.groupId = gIdStr

      const left = document.createElement("div")
      left.className = "group-nav-left"

      const dot = document.createElement("span")
      dot.className = "group-color-dot"
      dot.style.backgroundColor = g.color || "#6366f1"

      const name = document.createElement("span")
      name.className = "group-name"
      name.textContent = g.title || "Untitled Group"

      left.appendChild(dot)
      left.appendChild(name)

      const count = document.createElement("span")
      count.className = "group-count-pill"
      count.textContent = `${tabsCountMap.get(g.id) || 0}`

      item.appendChild(left)
      item.appendChild(count)

      item.addEventListener("click", () => {
        this.callbacks.onGroupSelect(gIdStr)
      })

      this.groupsListElem.appendChild(item)
    }

    if (ungroupedCount > 0 && groups.length > 0) {
      const ungrItem = document.createElement("div")
      ungrItem.className = `group-nav-item ${activeGroupId === "group-ungrouped" ? "active" : ""}`
      ungrItem.dataset.groupId = "group-ungrouped"

      const left = document.createElement("div")
      left.className = "group-nav-left"

      const dot = document.createElement("span")
      dot.className = "group-color-dot"
      dot.style.backgroundColor = "#94a3b8"

      const name = document.createElement("span")
      name.className = "group-name"
      name.textContent = "Ungrouped"

      left.appendChild(dot)
      left.appendChild(name)

      const count = document.createElement("span")
      count.className = "group-count-pill"
      count.textContent = `${ungroupedCount}`

      ungrItem.appendChild(left)
      ungrItem.appendChild(count)

      ungrItem.addEventListener("click", () => {
        this.callbacks.onGroupSelect("group-ungrouped")
      })

      this.groupsListElem.appendChild(ungrItem)
    }
  }
}
