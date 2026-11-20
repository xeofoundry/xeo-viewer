import { WalkMode, type WalkModeState } from '~/utils/walkMode'

const active = ref(false)
const state = reactive<WalkModeState>({ target: null, hideMode: false, moveMode: false, flying: false, snap: true, pressedKeys: [] })

let controller: WalkMode | undefined

function setWalkMode(value: boolean) {
  const viewer = useViewer().value
  if (!viewer) return

  if (controller?.viewer !== viewer) controller = new WalkMode(viewer, state, () => setWalkMode(false))

  active.value = value

  // The camera moves every frame while walking, which would keep FastNav in low quality. Disabling it first
  // also restores the objects it hid, before walk mode reads which objects are visible.
  setFastNavEnabled(viewer, !value)

  if (value) controller.activate()
  else controller.deactivate()
}

// Module-level state is safe only because the app is client-only (ssr: false)
export const useWalkMode = () => ({ active, state, setWalkMode })
