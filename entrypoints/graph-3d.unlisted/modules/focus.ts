import * as THREE from "three"
import type { GraphNode, VisualizerConfig } from "./types"

export class LevelOfDetailManager {
  private activeFocusedGroupId: string | null = null

  public setActiveFocusedGroup(groupId: string | null): void {
    this.activeFocusedGroupId = groupId
  }

  public getActiveFocusedGroup(): string | null {
    return this.activeFocusedGroupId
  }

  /**
   * Update LOD visibility, scale, and smooth opacity for all nodes based on camera proximity
   */
  public update(camera: THREE.Camera, nodes: GraphNode[], config: VisualizerConfig): void {
    if (!camera) return

    const camPos = camera.position

    // Build map of group positions and distances
    const groupDistances = new Map<string, number>()
    for (const node of nodes) {
      if (
        node.type === "group" &&
        node.x !== undefined &&
        node.y !== undefined &&
        node.z !== undefined
      ) {
        const dx = camPos.x - node.x
        const dy = camPos.y - node.y
        const dz = camPos.z - node.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        groupDistances.set(node.id, dist)

        // Group distance attenuation
        if (node.threeObj) {
          const userData = node.threeObj.userData
          const isFocused = this.activeFocusedGroupId === node.id

          // If a specific group is focused, dim others slightly to highlight the active group
          let targetGroupOpacity = 1.0
          if (this.activeFocusedGroupId && !isFocused) {
            targetGroupOpacity = 0.4
          } else if (dist > 600) {
            targetGroupOpacity = Math.max(0.45, 1.0 - (dist - 600) / 500)
          }

          if (userData && userData.materials) {
            for (const mat of userData.materials) {
              if ("opacity" in mat) {
                mat.opacity = targetGroupOpacity
              }
            }
          }
        }
      }
    }

    // Update tab nodes based on their parent group distance or override
    for (const node of nodes) {
      if (node.type === "page" && node.threeObj) {
        const obj = node.threeObj
        const userData = obj.userData

        if (config.showAllTabs) {
          obj.visible = true
          obj.scale.set(1, 1, 1)
          if (userData?.favSprite) {
            userData.favSprite.raycast = THREE.Sprite.prototype.raycast
          }
          if (userData?.labelSprite) {
            userData.labelSprite.visible = true
            if ("opacity" in userData.labelSprite.material) {
              userData.labelSprite.material.opacity = 1.0
            }
          }
          if (userData && userData.materials) {
            for (const mat of userData.materials) {
              if ("opacity" in mat) mat.opacity = 1.0
            }
          }
          continue
        }

        const isParentFocused = node.groupId && this.activeFocusedGroupId === node.groupId
        const parentDist = (node.groupId && groupDistances.get(node.groupId)) || 450

        // Distance thresholds:
        // dist <= 300: full opacity 1.0
        // 300 < dist <= 600: smooth fade
        // dist > 600: hidden
        let alpha = 0

        if (isParentFocused) {
          alpha = 1.0
        } else if (parentDist <= 300) {
          alpha = 1.0
        } else if (parentDist <= 600) {
          alpha = (600 - parentDist) / 300
        } else {
          alpha = 0
        }

        if (alpha <= 0.02) {
          obj.visible = false
          if (userData?.favSprite) {
            userData.favSprite.raycast = () => {}
          }
        } else {
          obj.visible = true
          if (userData?.favSprite) {
            userData.favSprite.raycast = THREE.Sprite.prototype.raycast
          }

          // Keep scale solid so text and favicons remain legible
          const scale = 0.92 + 0.08 * alpha
          obj.scale.set(scale, scale, 1)

          // Smoothly fade labels slightly faster at distance to eliminate clutter
          const labelAlpha = Math.max(0, Math.min(1, (alpha - 0.2) / 0.8))
          if (userData?.labelSprite) {
            userData.labelSprite.visible = labelAlpha > 0.05
            if ("opacity" in userData.labelSprite.material) {
              userData.labelSprite.material.opacity = labelAlpha
            }
          }

          if (userData && userData.materials) {
            for (const mat of userData.materials) {
              if ("opacity" in mat && mat !== userData?.labelSprite?.material) {
                mat.opacity = alpha
              }
            }
          }
        }
      }
    }
  }
}
