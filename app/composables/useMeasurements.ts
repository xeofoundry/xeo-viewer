import * as xeokit from '@xeokit/xeokit-sdk'
import { DistanceMeasurementsMouseControl, DistanceMeasurementsPlugin, DistanceMeasurementsTouchControl, PointerLens, type DistanceMeasurement, type Viewer } from '@xeokit/xeokit-sdk'

export type Measurement = DistanceMeasurement & {
  xLabelEnabled: boolean
  yLabelEnabled: boolean
  zLabelEnabled: boolean
  lengthLabelEnabled: boolean
}

type EditControl = new (measurement: DistanceMeasurement, cfg: { pointerLens?: PointerLens, snapping?: boolean }) => { deactivate: () => void }

// Present in the SDK but missing from its typings
const { DistanceMeasurementEditMouseControl, DistanceMeasurementEditTouchControl } = xeokit as unknown as Record<'DistanceMeasurementEditMouseControl' | 'DistanceMeasurementEditTouchControl', EditControl>

const touch = matchMedia('(pointer: coarse)').matches

const editing = ref(false)
const count = ref(0)
const hovered = shallowRef<Measurement>()
// The measurement whose menu is open keeps its highlight while the pointer moves into the menu
const pinned = shallowRef<Measurement>()

let tools: ReturnType<typeof createTools> | undefined
let edit: InstanceType<EditControl> | undefined

function createTools(viewer: Viewer) {
  const plugin = new DistanceMeasurementsPlugin(viewer)

  // xeokit places the lens at the bottom using its canvas' default 150px height, not the 300px it is shown at,
  // so this amount keeps the flipped lens 8px above the bottom edge
  const pointerLens = new PointerLens(viewer, {
    containerId: 'xeokit-pointer-lens',
    lensPosToggle: true,
    lensPosToggleAmount: 160,
    lensPosMarginLeft: 8,
    lensPosMarginTop: 80,
  })

  plugin.on('mouseOver', ({ measurement }) => {
    hovered.value = measurement as Measurement

    if (!editing.value) measurement.setHighlighted(true)
  })

  plugin.on('mouseLeave', ({ measurement }) => {
    hovered.value = undefined

    if (!editing.value && pinned.value !== measurement) measurement.setHighlighted(false)
  })

  // The mouse control destroys a cancelled measurement directly, which skips the plugin's measurementDestroyed event
  plugin.on('measurementCreated', (measurement) => {
    count.value++
    measurement.on('destroyed', () => count.value--)
  })

  editing.value = false
  count.value = 0

  return {
    plugin,
    pointerLens,
    mouseControl: new DistanceMeasurementsMouseControl(plugin, { pointerLens, snapping: true }),
    touchControl: new DistanceMeasurementsTouchControl(plugin, { pointerLens, snapping: true }),
  }
}

export function useMeasurements() {
  const viewer = useViewer()
  const tool = useToolMode()

  function measureTools() {
    const instance = viewer.value

    if (!instance) return undefined
    if (tools?.plugin.viewer !== instance) tools = createTools(instance)

    return tools
  }

  function setMeasuring(active: boolean) {
    const current = measureTools()

    if (!current) return

    if (active) {
      current.mouseControl.activate()

      if (touch) current.touchControl.activate()
    }
    else {
      current.mouseControl.deactivate()
      current.touchControl.deactivate()
    }
  }

  function startEdit(measurement: Measurement) {
    const current = measureTools()

    if (!current) return

    setMeasuring(false)

    const Control = touch ? DistanceMeasurementEditTouchControl : DistanceMeasurementEditMouseControl

    edit = new Control(measurement, { pointerLens: current.pointerLens, snapping: true })
    editing.value = true
  }

  function endEdit() {
    edit?.deactivate()
    edit = undefined
    editing.value = false

    if (tool.value === 'measure') setMeasuring(true)
  }

  return { editing, count, hovered, pinned, measureTools, setMeasuring, startEdit, endEdit }
}
