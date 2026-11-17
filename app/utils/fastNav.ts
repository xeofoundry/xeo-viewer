import { FastNavPlugin, type Viewer } from '@xeokit/xeokit-sdk'

// xeovision's default "low" preset hides these types while the camera moves
const HIDDEN_TYPES = [
  'IfcFurniture',
  'IfcFurnishingElement',
  'IfcDiscreteAccessory',
  'IfcMechanicalFastener',
  'IfcShadingDevice',
  'IfcAirTerminal',
  'IfcFlowTerminal',
  'IfcFlowFitting',
  'IfcFlowController',
]

// SDK internals that FastNavPlugin toggles but its destroy() does not restore
interface FastNavInternals {
  _onStopped?: (() => void) | null
}

interface SceneInternals {
  _renderer: Record<'setEdgesEnabled' | 'setColorTextureEnabled' | 'setPBREnabled' | 'setSAOEnabled' | 'setTransparentEnabled', (enabled: boolean) => void>
  canvas: { resolutionScale: number }
}

let plugin: FastNavPlugin | undefined

function hideTypesWhileMoving({ scene, metaScene }: Viewer) {
  let hidden = HIDDEN_TYPES
    .flatMap(type => Object.keys(metaScene.metaObjectsByType[type] ?? {}))
    .filter(id => scene.objects[id]?.visible)

  scene.setObjectsVisible(hidden, false)

  // FastNav can call this twice (on stop and again from setFastNavEnabled), so it must be idempotent
  return () => {
    scene.setObjectsVisible(hidden, true)
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
