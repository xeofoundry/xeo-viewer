import type { Viewer } from '@xeokit/xeokit-sdk'
import { WalkMode, type WalkModeState } from '~/utils/walkMode'

const active = ref(false)
const state = reactive<WalkModeState>({ target: null, hideMode: false, moveMode: false, inspectMode: false, flying: false, snap: true, pressedKeys: [] })

let controller: WalkMode | undefined

function createController(viewer: Viewer) {
  const { showObject, clearSelection } = useProperties()
  const open = useOpenPanels()

  return new WalkMode(viewer, state, {
    onExit: () => setWalkMode(false),
    onInspectMode: (inspecting) => {
      if (!inspecting) clearSelection()
      open.value.properties = inspecting
    },
    onInspectPick: (entityId) => {
      const entity = viewer.scene.objects[entityId]
      if (!entity) return

      clearSelection()
      entity.selected = true
      showObject(entityId)
    },
  })
}

function setWalkMode(value: boolean) {
  const viewer = useViewer().value
  if (!viewer) return

  if (controller?.viewer !== viewer) controller = createController(viewer)

  active.value = value

  // The camera moves every frame while walking, which would keep FastNav in low quality. Disabling it first
  // also restores the objects it hid, before walk mode reads which objects are visible.
  setFastNavEnabled(viewer, !value)

  if (value) controller.activate()
  else controller.deactivate()
}

// Module-level state is safe only because the app is client-only (ssr: false)
export const useWalkMode = () => ({ active, state, setWalkMode })
