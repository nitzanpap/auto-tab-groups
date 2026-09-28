import * as THREE from "three"

export class AmbientAtmosphere {
  private points: THREE.Points | null = null
  private positions: Float32Array | null = null
  private originalPositions: Float32Array | null = null
  private isVisible = true

  constructor(scene: THREE.Scene, particleCount = 220) {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    const color1 = new THREE.Color("#38bdf8") // Soft sky blue
    const color2 = new THREE.Color("#818cf8") // Soft indigo
    const color3 = new THREE.Color("#94a3b8") // Soft slate

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Distribute in a spherical/ellipsoid cloud
      const radius = 300 + Math.random() * 500
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)

      positions[i] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i + 1] = (radius * Math.sin(phi) * Math.sin(theta)) * 0.7
      positions[i + 2] = radius * Math.cos(phi)

      const mixedColor = new THREE.Color()
      const rand = Math.random()
      if (rand < 0.33) {
        mixedColor.copy(color1)
      } else if (rand < 0.66) {
        mixedColor.copy(color2)
      } else {
        mixedColor.copy(color3)
      }

      colors[i] = mixedColor.r
      colors[i + 1] = mixedColor.g
      colors[i + 2] = mixedColor.b
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.points = new THREE.Points(geometry, material)
    this.positions = positions
    this.originalPositions = new Float32Array(positions)
    scene.add(this.points)
  }

  public update(time: number): void {
    if (!this.points || !this.positions || !this.originalPositions || !this.isVisible) return

    const posAttr = this.points.geometry.getAttribute("position") as THREE.BufferAttribute
    const count = this.positions.length / 3

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const origX = this.originalPositions[idx]
      const origY = this.originalPositions[idx + 1]
      const origZ = this.originalPositions[idx + 2]

      // Subtle harmonic drift
      const wave = Math.sin(time * 0.0006 + i * 0.5) * 8
      posAttr.setXYZ(i, origX + wave, origY + Math.cos(time * 0.0004 + i) * 6, origZ + Math.sin(time * 0.0005 + i) * 8)
    }

    posAttr.needsUpdate = true
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible
    if (this.points) {
      this.points.visible = visible
    }
  }
}

/**
 * Configure lighting and scene atmosphere
 */
export function setupSceneAtmosphere(scene: THREE.Scene): AmbientAtmosphere {
  // Ambient fill light (cool dark tint)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75)
  scene.add(ambientLight)

  // Primary directional key light
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9)
  keyLight.position.set(200, 300, 250)
  scene.add(keyLight)

  // Secondary cool rim/fill light
  const fillLight = new THREE.DirectionalLight(0x6366f1, 0.5)
  fillLight.position.set(-250, -200, -200)
  scene.add(fillLight)

  // Ambient micro particle field
  return new AmbientAtmosphere(scene, 220)
}

/**
 * Handle viewport resize and sync with Three.js renderer and camera
 */
export function setupViewportResize(graphInstance: any): () => void {
  const handleResize = () => {
    if (!graphInstance) return
    const width = window.innerWidth
    const height = window.innerHeight

    graphInstance.width(width)
    graphInstance.height(height)

    const camera = graphInstance.camera()
    if (camera && camera.isPerspectiveCamera) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const renderer = graphInstance.renderer()
    if (renderer) {
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    }
  }

  window.addEventListener("resize", handleResize)
  return () => window.removeEventListener("resize", handleResize)
}
