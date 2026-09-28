declare module "3d-force-graph" {
  const ForceGraph3D: any
  export default ForceGraph3D
}

declare module "three" {
  export const LinearFilter: any
  export const AdditiveBlending: any
  export const DoubleSide: any

  export class Vector2 {
    x: number
    y: number
    constructor(x?: number, y?: number)
    set(x: number, y: number): this
  }

  export class Vector3 {
    x: number
    y: number
    z: number
    constructor(x?: number, y?: number, z?: number)
    set(x: number, y: number, z: number): this
    subVectors(a: Vector3, b: Vector3): this
    normalize(): this
    distanceTo(v: Vector3): number
  }

  export class Raycaster {
    constructor(origin?: Vector3, direction?: Vector3, near?: number, far?: number)
    setFromCamera(coords: Vector2, camera: Camera): void
    intersectObjects(
      objects: Object3D[],
      recursive?: boolean
    ): Array<{ object: Object3D; distance: number; point: Vector3 }>
  }

  export class Color {
    r: number
    g: number
    b: number
    constructor(color?: any)
    set(color: any): this
    copy(color: Color): this
  }

  export class Scene {
    add(obj: any): void
    remove(obj: any): void
  }

  export class Camera {
    position: { x: number; y: number; z: number }
    isPerspectiveCamera?: boolean
    aspect?: number
    updateProjectionMatrix(): void
  }

  export class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number)
    setXYZ(index: number, x: number, y: number, z: number): this
    needsUpdate: boolean
  }

  export class BufferGeometry {
    setAttribute(name: string, attribute: BufferAttribute): this
    getAttribute(name: string): BufferAttribute
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number)
  }

  export class TorusGeometry extends BufferGeometry {
    constructor(radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number)
  }

  export class RingGeometry extends BufferGeometry {
    constructor(innerRadius?: number, outerRadius?: number, thetaSegments?: number)
  }

  export class Material {
    transparent?: boolean
    opacity?: number
    depthWrite?: boolean
    depthTest?: boolean
    visible?: boolean
    side?: any
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: any)
    color: Color
    emissive?: Color
    emissiveIntensity?: number
    roughness?: number
    metalness?: number
  }

  export class MeshBasicMaterial extends Material {
    constructor(parameters?: any)
    color: Color
  }

  export class PointsMaterial extends Material {
    constructor(parameters?: any)
    size?: number
    vertexColors?: boolean
    blending?: any
  }

  export class SpriteMaterial extends Material {
    constructor(parameters?: any)
    map?: any
  }

  export class CanvasTexture {
    constructor(canvas: any)
    minFilter: any
    magFilter: any
    generateMipmaps?: boolean
    needsUpdate: boolean
    dispose(): void
  }

  export class Object3D {
    position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void }
    scale: { x: number; y: number; z: number; set(x: number, y: number, z: number): void }
    rotation: { x: number; y: number; z: number }
    visible: boolean
    renderOrder?: number
    userData: any
    parent?: Object3D | null
    children?: Object3D[]
    raycast?(raycaster: any, intersects: any[]): void
    traverse?(callback: (child: Object3D) => void): void
    add(obj: any): void
    remove(obj: any): void
  }

  export class Group extends Object3D {}

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material)
    geometry: BufferGeometry
    material: Material
    static prototype: Mesh
  }

  export class Points extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material)
    geometry: BufferGeometry
    material: Material
    static prototype: Points
  }

  export class Sprite extends Object3D {
    constructor(material?: SpriteMaterial)
    material: SpriteMaterial
    static prototype: Sprite
  }

  export class Light extends Object3D {}
  export class AmbientLight extends Light {
    constructor(color?: any, intensity?: number)
  }
  export class DirectionalLight extends Light {
    constructor(color?: any, intensity?: number)
  }
}

declare module "d3-force-3d" {
  export function forceCollide(radius?: number | ((node: any) => number)): any
  export function forceSimulation(nodes?: any[]): any
  export function forceLink(links?: any[]): any
  export function forceManyBody(): any
  export function forceCenter(x?: number, y?: number, z?: number): any
  export function forceRadial(radius: number, x?: number, y?: number, z?: number): any
  export function forceX(x?: number | ((node: any) => number)): any
  export function forceY(y?: number | ((node: any) => number)): any
  export function forceZ(z?: number | ((node: any) => number)): any
}
