<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { math, type SceneModelEntity, type Viewer } from '@xeokit/xeokit-sdk'

const viewer = useViewer()
const properties = useProperties()
const tool = useToolMode()
const measurements = useMeasurements()
const slices = useSlices()

const open = ref(false)
const items = shallowRef<DropdownMenuItem[][]>([])
const entity = shallowRef<SceneModelEntity>()
const point = shallowRef({ x: 0, y: 0 })

const reference = computed(() => {
  const { x, y } = point.value

  return { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) }
})

function sceneItems(instance: Viewer) {
  const { scene, cameraFlight, cameraControl } = instance

  return {
    viewFitAll: { label: 'View Fit All', onSelect: () => fitView(instance, 0.5) },
    viewFitSelected: {
      label: 'View Fit Selected',
      disabled: !scene.numSelectedObjects,
      onSelect: () => {
        const aabb = scene.getAABB(scene.selectedObjectIds)

        cameraFlight.flyTo({ aabb, duration: 0.5 })
        cameraControl.pivotPos = math.getAABB3Center(aabb)
      },
    },
    showAll: {
      label: 'Show All',
      disabled: scene.numVisibleObjects >= scene.numObjects && !scene.numXRayedObjects && !scene.numSelectedObjects,
      onSelect: () => {
        scene.setObjectsVisible(scene.objectIds, true)
        scene.setObjectsXRayed(scene.xrayedObjectIds, false)
        properties.clearSelection()
      },
    },
    hideAll: { label: 'Hide All', disabled: !scene.numVisibleObjects, onSelect: () => scene.setObjectsVisible(scene.visibleObjectIds, false) },
    selectNone: { label: 'Select None', disabled: !scene.numSelectedObjects, onSelect: properties.clearSelection },
  } satisfies Record<string, DropdownMenuItem>
}

function clearSlicesItem(): DropdownMenuItem {
  return { label: 'Clear All Slices', disabled: !slices.count(), onSelect: slices.clear }
}

function measurementsMenu(): DropdownMenuItem {
  const tools = measurements.measureTools()!
  const all = Object.values(tools.plugin.measurements) as Measurement[]

  const setAll = (update: (measurement: Measurement) => void) => () => all.forEach(update)

  return {
    label: 'Measurements',
    children: [
      { label: 'Delete All', disabled: !all.length, onSelect: () => tools.plugin.clear() },
      {
        label: tools.plugin.getAxisVisible() ? 'Hide Axis Wires' : 'Show Axis Wires',
        disabled: !all.length,
        onSelect: () => tools.plugin.setAxisVisible(!tools.plugin.getAxisVisible()),
      },
      { label: 'Show All', disabled: !all.length, onSelect: setAll(measurement => measurement.visible = true) },
      { label: 'Hide All', disabled: !all.length, onSelect: setAll(measurement => measurement.visible = false) },
      { label: 'Show All Labels', disabled: !all.length, onSelect: setAll(measurement => measurement.labelsVisible = true) },
      { label: 'Hide All Labels', disabled: !all.length, onSelect: setAll(measurement => measurement.labelsVisible = false) },
      {
        label: tools.mouseControl.snapping ? 'Disable Snapping' : 'Enable Snapping',
        onSelect: () => {
          tools.mouseControl.snapping = !tools.mouseControl.snapping
          tools.touchControl.snapping = tools.mouseControl.snapping
        },
      },
    ],
  }
}

function measuringItems(): DropdownMenuItem[] {
  const { mouseControl } = measurements.measureTools()!

  return [
    { label: 'End Editing', disabled: !measurements.editing.value, onSelect: measurements.endEdit },
    { label: 'Cancel Measurement', disabled: !mouseControl.currentMeasurement, onSelect: () => mouseControl.reset() },
  ]
}

function measurementItems(target: Measurement): DropdownMenuItem[][] {
  const { plugin, mouseControl } = measurements.measureTools()!

  const labelToggle = (name: string, key: 'xLabelEnabled' | 'yLabelEnabled' | 'zLabelEnabled' | 'lengthLabelEnabled') => ({
    label: `${target[key] && target.labelsVisible ? 'Disable' : 'Enable'} ${name} Label`,
    onSelect: () => {
      target[key] = !target[key]
    },
  })

  return [
    [
      { label: 'Delete', onSelect: () => target.destroy() },
      {
        label: target.axisVisible ? 'Hide Axis' : 'Show Axis',
        onSelect: () => {
          target.axisVisible = !target.axisVisible
        },
      },
      labelToggle('X', 'xLabelEnabled'),
      labelToggle('Y', 'yLabelEnabled'),
      labelToggle('Z', 'zLabelEnabled'),
      labelToggle('Length', 'lengthLabelEnabled'),
      {
        label: target.labelsVisible ? 'Hide All Labels' : 'Show All Labels',
        onSelect: () => {
          target.labelsVisible = !target.labelsVisible
        },
      },
      { label: 'Edit', disabled: measurements.editing.value, onSelect: () => measurements.startEdit(target) },
      { label: 'End Editing', disabled: !measurements.editing.value, onSelect: measurements.endEdit },
    ],
    [
      { label: 'Delete All', disabled: !Object.keys(plugin.measurements).length, onSelect: () => plugin.clear() },
      { label: 'Cancel Measurement', onSelect: () => mouseControl.reset() },
    ],
  ]
}

function objectItems(instance: Viewer, target: SceneModelEntity): DropdownMenuItem[][] {
  const { scene, cameraFlight } = instance
  const shared = sceneItems(instance)

  function isolate() {
    properties.clearSelection()
    scene.setObjectsHighlighted(scene.highlightedObjectIds, false)

    return subtreeObjectIds(instance, target)
  }

  function select() {
    target.selected = true
    properties.showObject(target.id)
  }

  return [
    ...tool.value === 'measure' ? [measuringItems()] : [],
    [{ label: 'Inspect Properties', onSelect: select }],
    [
      {
        label: 'View / Show',
        children: [
          { label: 'View Fit', onSelect: () => cameraFlight.flyTo({ aabb: target.aabb, duration: 0.5 }) },
          shared.viewFitAll,
          shared.viewFitSelected,
          shared.showAll,
        ],
      },
      {
        label: 'Hide',
        children: [
          {
            label: 'Hide',
            disabled: !target.visible,
            onSelect: () => {
              target.visible = false
            },
          },
          {
            label: 'Hide Others',
            onSelect: () => {
              scene.setObjectsVisible(scene.visibleObjectIds, false)
              scene.setObjectsXRayed(scene.xrayedObjectIds, false)
              scene.setObjectsVisible(isolate(), true)
            },
          },
          shared.hideAll,
        ],
      },
      {
        label: 'X-Ray',
        children: [
          {
            label: 'X-Ray',
            disabled: target.xrayed,
            onSelect: () => {
              target.xrayed = true
            },
          },
          {
            label: 'Undo X-Ray',
            disabled: !target.xrayed,
            onSelect: () => {
              target.xrayed = false
            },
          },
          {
            label: 'X-Ray Others',
            onSelect: () => {
              scene.setObjectsVisible(scene.objectIds, true)
              scene.setObjectsXRayed(scene.objectIds, true)
              scene.setObjectsXRayed(isolate(), false)
            },
          },
          { label: 'Reset X-Ray', disabled: !scene.numXRayedObjects, onSelect: () => scene.setObjectsXRayed(scene.xrayedObjectIds, false) },
        ],
      },
      {
        label: 'Select',
        children: [
          { label: 'Select', disabled: target.selected, onSelect: select },
          {
            label: 'Undo Select',
            disabled: !target.selected,
            onSelect: () => {
              target.selected = false
              properties.hide(target.id)
            },
          },
          shared.selectNone,
        ],
      },
    ],
    [clearSlicesItem(), measurementsMenu()],
  ]
}

function canvasItems(instance: Viewer): DropdownMenuItem[][] {
  const { scene } = instance
  const shared = sceneItems(instance)

  return [
    [shared.hideAll, shared.showAll],
    [
      { label: 'View', children: [shared.viewFitSelected, shared.viewFitAll] },
      {
        label: 'X-Ray',
        children: [
          { label: 'X-Ray All', disabled: scene.numXRayedObjects >= scene.numObjects, onSelect: () => scene.setObjectsXRayed(scene.objectIds, true) },
          { label: 'X-Ray None', disabled: !scene.numXRayedObjects, onSelect: () => scene.setObjectsXRayed(scene.xrayedObjectIds, false) },
        ],
      },
    ],
    [
      shared.selectNone,
      {
        label: 'Reset View',
        onSelect: () => {
          scene.setObjectsXRayed(scene.xrayedObjectIds, false)
          scene.setObjectsHighlighted(scene.highlightedObjectIds, false)
          scene.setObjectsVisible(scene.objectIds, true)
          properties.clearSelection()
          fitView(instance, 0.5, HOME_DIRECTION)
        },
      },
      clearSlicesItem(),
      measurementsMenu(),
    ],
  ]
}

function release() {
  if (entity.value) entity.value.highlighted = false
  measurements.pinned.value?.setHighlighted(false)

  entity.value = undefined
  measurements.pinned.value = undefined
}

function show(event: MouseEvent, menu: DropdownMenuItem[][]) {
  items.value = menu
  point.value = { x: event.clientX, y: event.clientY }
  open.value = true
}

watch(viewer, (instance, _, onCleanup) => {
  if (!instance) return

  const { plugin } = measurements.measureTools()!

  // xeokit fires 'rightClick' only when the button comes up without dragging, so right-drag panning never opens the menu
  const rightClick = instance.cameraControl.on('rightClick', ({ event, canvasPos }) => {
    if (measurements.hovered.value) return

    const hit = instance.scene.pick({ canvasPos })
    const target = hit?.entity?.isObject ? hit.entity as SceneModelEntity : undefined

    release()

    if (target) target.highlighted = true

    entity.value = target
    show(event, target ? objectItems(instance, target) : canvasItems(instance))
  })

  const measurementMenu = plugin.on('contextMenu', ({ event, measurement }) => {
    event.preventDefault()
    release()

    measurement.setHighlighted(true)
    measurements.pinned.value = measurement as Measurement
    show(event, measurementItems(measurement as Measurement))
  })

  onCleanup(() => {
    instance.cameraControl.off(rightClick)
    plugin.off(measurementMenu)
  })
}, { immediate: true })

watch(open, (isOpen) => {
  if (!isOpen) release()
})
</script>

<template>
  <UDropdownMenu
    v-model:open="open"
    :items="items"
    :modal="false"
    :content="{ reference, side: 'right', align: 'start' }"
  />
</template>
