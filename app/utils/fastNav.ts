import { FastNavPlugin, type Scene, type Viewer } from '@xeokit/xeokit-sdk'

// xeovision's default "low" preset hides these types while the camera moves
const HIDDEN_TYPES = new Set([
  'IfcFurniture',
  'IfcFurnishingElement',
  'IfcDiscreteAccessory',
  'IfcMechanicalFastener',
  'IfcShadingDevice',
  'IfcAirTerminal',
  'IfcFlowTerminal',
  'IfcFlowFitting',
  'IfcFlowController',
])

// SDK internals that FastNavPlugin toggles but its destroy() does not restore
interface FastNavInternals {
  _onStopped?: (() => void) | null
}

interface SceneInternals {
  _renderer: Record<'setEdgesEnabled' | 'setColorTextureEnabled' | 'setPBREnabled' | 'setSAOEnabled' | 'setTransparentEnabled', (enabled: boolean) => void>
  canvas: { resolutionScale: number }
}

let plugin: FastNavPlugin | undefined
let silent = false
let staleListeners = false

// Like scene.on('objectVisibility'), minus the temporary hiding FastNav does on every camera move.
// Refreshing the explorer tree for it costs a pass over every mounted row, twice per move.
export function onObjectVisibility(scene: Scene, run: () => void) {
  staleListeners = true

  return scene.on('objectVisibility', () => {
    if (silent) return

    staleListeners = true
    run()
  })
}

function hideTypesWhileMoving(viewer: Viewer) {
  const { scene } = viewer

  let hidden = [...objectTypes(viewer)]
    .filter(([id, type]) => HIDDEN_TYPES.has(type) && scene.objects[id]?.visible)
    .map(([id]) => id)

  silent = true
  scene.setObjectsVisible(hidden, false)
  silent = false
  staleListeners = false

  // FastNav can call this twice (on stop and again from setFastNavEnabled), so it must be idempotent
  return () => {
    // A listener that read the scene mid-move saw these objects hidden, so it has to hear about the restore
    silent = !staleListeners
    scene.setObjectsVisible(hidden, true)
    silent = false
    hidden = []
  }
}

// FastNavPlugin has no on/off switch, so it is destroyed and recreated like in xeovision
export function setFastNavEnabled(viewer: Viewer, enabled: boolean) {
  // A previous viewer was destroyed together with its plugin
  if (plugin?.viewer !== viewer) plugin = undefined
  if (enabled === !!plugin) return

  if (enabled) {
    plugin = new FastNavPlugin(viewer, {
      hideEdges: true,
      hideSAO: true,
      hidePBR: true,
      hideColorTexture: true,
      hideTransparentObjects: true,
      scaleCanvasResolution: true,
      scaleCanvasResolutionFactor: 0.75,
      delayBeforeRestore: true,
      delayBeforeRestoreSeconds: 0.7,
      onMoved: () => hideTypesWhileMoving(viewer),
    })
    return
  }

  // Disabling mid-move would otherwise leave the low quality rendering and hidden objects in place
  const internals = plugin as unknown as FastNavInternals
  internals._onStopped?.()
  plugin?.destroy()
  plugin = undefined

  const { _renderer: renderer, canvas } = viewer.scene as unknown as SceneInternals
  renderer.setEdgesEnabled(true)
  renderer.setColorTextureEnabled(true)
  renderer.setPBREnabled(true)
  renderer.setSAOEnabled(true)
  renderer.setTransparentEnabled(true)
  canvas.resolutionScale = 1
}
