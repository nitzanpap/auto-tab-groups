export interface CameraControlsConfig {
  rotateSpeed?: number
  zoomSpeed?: number
  panSpeed?: number
  dampingFactor?: number
  minDistance?: number
  maxDistance?: number
  minPolarAngle?: number
  maxPolarAngle?: number
}

export const DEFAULT_CAMERA_CONFIG: CameraControlsConfig = {
  rotateSpeed: 0.35,
  zoomSpeed: 0.5,
  panSpeed: 0.3,
  dampingFactor: 0.08,
  minDistance: 80,
  maxDistance: 2800,
  minPolarAngle: Math.PI * 0.1,
  maxPolarAngle: Math.PI * 0.9
}

/**
 * Configure 3D Force Graph OrbitControls to be calm, smooth, and bounded
 */
export function configureControlledCamera(graphInstance: any, config: CameraControlsConfig = DEFAULT_CAMERA_CONFIG): void {
  const controls = graphInstance.controls()
  if (!controls) return

  controls.enableDamping = true
  controls.dampingFactor = config.dampingFactor ?? 0.08
  controls.rotateSpeed = config.rotateSpeed ?? 0.35
  controls.zoomSpeed = config.zoomSpeed ?? 0.5
  controls.panSpeed = config.panSpeed ?? 0.3

  controls.minDistance = config.minDistance ?? 80
  controls.maxDistance = config.maxDistance ?? 2800

  controls.minPolarAngle = config.minPolarAngle ?? Math.PI * 0.1
  controls.maxPolarAngle = config.maxPolarAngle ?? Math.PI * 0.9

  // Slower auto-rotation when enabled
  controls.autoRotateSpeed = 0.4
}

/**
 * Smoothly animate the camera to focus on a target position
 */
export function focusCameraOnTarget(
  graphInstance: any,
  target: { x: number; y: number; z: number },
  distanceOffset = 240,
  duration = 800
): void {
  if (!graphInstance) return

  // Position camera at an offset along the normal direction, slightly above
  const camPos = {
    x: target.x * 1.15,
    y: target.y * 1.15 + 40,
    z: target.z + distanceOffset
  }

  graphInstance.cameraPosition(camPos, target, duration)
}

/**
 * Reset camera smoothly to the global overview
 */
export function resetCameraOverview(graphInstance: any, duration = 800): void {
  if (!graphInstance) return
  graphInstance.zoomToFit(duration, 80)
}

