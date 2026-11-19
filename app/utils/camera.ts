import { math, type Viewer } from '@xeokit/xeokit-sdk'

// xeokit's typings declare Scene.canvas as a bare Component, without its [x, y, width, height] boundary
const canvasSize = (scene: Viewer['scene']) => (scene.canvas as unknown as { boundary: number[] }).boundary.slice(2) as [number, number]

// World-space half width and height of the view at the look point. Mirrors xeokit:
// Perspective fov is vertical (default fovAxis 'min'), Ortho scale spans the longer canvas side.
export function viewHalfExtent({ camera, scene }: Viewer): [number, number] {
  const [width, height] = canvasSize(scene)
  const aspect = width / height

  if (camera.projection === 'ortho') {
    const half = camera.ortho.scale / 2
    return aspect >= 1 ? [half, half / aspect] : [half * aspect, half]
  }

  const fovY = aspect < 1 ? camera.perspective.fov / aspect : camera.perspective.fov
  // Without a dest array, xeokit's subVec3 writes into its first argument and would corrupt camera.eye
  const halfHeight = Math.hypot(...math.subVec3(camera.eye, camera.look, [])) * Math.tan((fovY * Math.PI) / 360)

  return [halfHeight * aspect, halfHeight]
}

export const HOME_DIRECTION = [-10, 10, 17]

// Height of the toolbar band over the top of the canvas, so the model is centered in the area below it
const TOP_INSET = 72

// xeokit fits the center of the 3D bounding box, which leaves models with empty box corners visibly
// off-center, so afterwards pan until the on-screen footprint of the visible objects is centered.
// `direction` (eye minus look) turns the camera to it first, otherwise the current direction is kept.
export function fitView(viewer: Viewer, duration = 0, direction?: number[]) {
  const { camera, cameraFlight, scene } = viewer

  if (!scene.visibleObjectIds.length) return

  const start = { eye: camera.eye.slice(), look: camera.look.slice(), up: camera.up.slice(), orthoScale: camera.ortho.scale }

  if (direction) {
    camera.eye = math.addVec3(camera.look, direction, [])
    camera.up = [0, 1, 0]
  }

  cameraFlight.jumpTo({ aabb: scene.getAABB(scene.visibleObjectIds) })

  // In perspective a pan step is only exact at the look depth, so repeat it to converge on steep views
  // NDC spans 2 units over the canvas height, so half the inset in pixels is TOP_INSET / height in NDC
  const targetY = -TOP_INSET / canvasSize(scene)[1]

  for (let step = 0; step < 3; step++) {
    const [centerX, centerY] = footprintCenter(viewer)
    const [halfWidth, halfHeight] = viewHalfExtent(viewer)

    camera.pan([-centerX * halfWidth, (centerY - targetY) * halfHeight, 0])
  }

  if (duration > 0) {
    const target = { eye: camera.eye.slice(), look: camera.look.slice(), up: camera.up.slice(), orthoScale: camera.ortho.scale }

    camera.eye = start.eye
    camera.look = start.look
    camera.up = start.up
    camera.ortho.scale = start.orthoScale

    cameraFlight.flyTo({ ...target, duration })
  }
}

// Center of the screen-space bounds of all visible objects, in normalized device coordinates
function footprintCenter({ camera, scene }: Viewer): [number, number] {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const id of scene.visibleObjectIds) {
    const aabb = scene.objects[id]!.aabb

    for (const x of [aabb[0]!, aabb[3]!]) {
      for (const y of [aabb[1]!, aabb[4]!]) {
        for (const z of [aabb[2]!, aabb[5]!]) {
          const [clipX, clipY, , clipW] = math.mulMat4v4(camera.projMatrix, math.mulMat4v4(camera.viewMatrix, [x, y, z, 1]))

          minX = Math.min(minX, clipX! / clipW!)
          maxX = Math.max(maxX, clipX! / clipW!)
          minY = Math.min(minY, clipY! / clipW!)
          maxY = Math.max(maxY, clipY! / clipW!)
        }
      }
    }
  }

  return [(minX + maxX) / 2, (minY + maxY) / 2]
}
