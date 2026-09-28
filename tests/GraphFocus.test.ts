import { describe, expect, it } from "vitest"
import { LevelOfDetailManager } from "../entrypoints/graph-3d.unlisted/modules/focus"
import type { GraphNode, VisualizerConfig } from "../entrypoints/graph-3d.unlisted/modules/types"

describe("3D Graph Level of Detail & Focus Management", () => {
  it("should set and retrieve the active focused group", () => {
    const lod = new LevelOfDetailManager()
    expect(lod.getActiveFocusedGroup()).toBeNull()

    lod.setActiveFocusedGroup("group-100")
    expect(lod.getActiveFocusedGroup()).toBe("group-100")

    lod.setActiveFocusedGroup(null)
    expect(lod.getActiveFocusedGroup()).toBeNull()
  })

  it("should update node and label visibility appropriately based on focus state and distance", () => {
    const lod = new LevelOfDetailManager()

    const groupNode: GraphNode = {
      id: "group-1",
      type: "group",
      name: "Work Tabs",
      color: "#3b82f6",
      radius: 18,
      tabCount: 2,
      x: 0,
      y: 0,
      z: 0
    }

    const pageMat1 = { opacity: 0 }
    const labelMat1 = { opacity: 0 }
    const pageNode1: GraphNode = {
      id: "tab-10",
      type: "page",
      name: "GitHub PR",
      color: "#3b82f6",
      radius: 9.5,
      groupId: "group-1",
      x: 50,
      y: 0,
      z: 0
    }
    const pageThreeObj1 = {
      visible: false,
      scale: { set: (_x: number, _y: number, _z: number) => {} },
      userData: {
        type: "page",
        favSprite: {},
        labelSprite: { visible: false, material: labelMat1 },
        materials: [pageMat1, labelMat1]
      }
    }
    pageNode1.threeObj = pageThreeObj1 as any

    const mockCamera = {
      position: { x: 0, y: 0, z: 200 } // close distance = 200
    }

    const config: VisualizerConfig = {
      showAllTabs: false,
      ambientParticles: true,
      density: 1.0,
      layoutMode: "unified"
    }

    // Camera close to group
    lod.update(mockCamera as any, [groupNode, pageNode1], config)
    expect(pageThreeObj1.visible).toBe(true)
    expect(pageMat1.opacity).toBeCloseTo(1.0, 1)

    // Camera far from group (distance = 800)
    mockCamera.position.z = 800
    lod.update(mockCamera as any, [groupNode, pageNode1], config)
    expect(pageThreeObj1.visible).toBe(false)

    // When focused, group's tabs are fully visible regardless of camera distance
    lod.setActiveFocusedGroup("group-1")
    lod.update(mockCamera as any, [groupNode, pageNode1], config)
    expect(pageThreeObj1.visible).toBe(true)
    expect(pageMat1.opacity).toBe(1.0)
  })
})
