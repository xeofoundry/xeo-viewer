import { math, type Viewer } from '@xeokit/xeokit-sdk'

// World-space half width and height of the view at the look point. Mirrors xeokit:
// Perspective fov is vertical (default fovAxis 'min'), Ortho scale spans the longer canvas side.
export function viewHalfExtent({ camera, scene }: Viewer): [number, number] {
  const aspect = scene.canvas.boundary[2]! / scene.canvas.boundary[3]!

  if (camera.projection === 'ortho') {
    const half = camera.ortho.scale / 2
    return aspect >= 1 ? [half, half / aspect] : [half * aspect, half]
  }

  const fovY = aspect < 1 ? camera.perspective.fov / aspect : camera.perspective.fov
  // Without a dest array, xeokit's subVec3 writes into its first argument and would corrupt camera.eye
  const halfHeight = Math.hypot(...math.subVec3(camera.eye, camera.look, [])) * Math.tan((fovY * Math.PI) / 360)

  return [halfHeight * aspect, halfHeight]
}

// xeokit fits the center of the 3D bounding box, which leaves models with empty box corners visibly
// off-center, so afterwards pan until the on-screen footprint of the visible objects is centered.
export function fitView(viewer: Viewer, duration = 0) {
  const { camera, cameraFlight, scene } = viewer

  if (!scene.visibleObjectIds.length) return

  const start = { eye: camera.eye.slice(), look: camera.look.slice(), up: camera.up.slice(), orthoScale: camera.ortho.scale }

  cameraFlight.jumpTo({ aabb: scene.getAABB(scene.visibleObjectIds) })

  // In perspective a pan step is only exact at the look depth, so repeat it to converge on steep views
  for (let step = 0; step < 3; step++) {
    const [centerX, centerY] = footprintCenter(viewer)
    const [halfWidth, halfHeight] = viewHalfExtent(viewer)

    camera.pan([-centerX * halfWidth, centerY * halfHeight, 0])
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
