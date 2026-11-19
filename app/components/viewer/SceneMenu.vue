<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { math, type SceneModelEntity, type Viewer } from '@xeokit/xeokit-sdk'

const viewer = useViewer()
const properties = useProperties()

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
    ],
  ]
}

// xeokit fires 'rightClick' only when the button comes up without dragging, so right-drag panning never opens the menu
watch(viewer, (instance, _, onCleanup) => {
  if (!instance) return

  const subscription = instance.cameraControl.on('rightClick', ({ event, canvasPos }) => {
    const hit = instance.scene.pick({ canvasPos })
    const target = hit?.entity?.isObject ? hit.entity as SceneModelEntity : undefined

    if (entity.value) entity.value.highlighted = false
    if (target) target.highlighted = true

    entity.value = target
    items.value = target ? objectItems(instance, target) : canvasItems(instance)
    point.value = { x: event.clientX, y: event.clientY }
    open.value = true
  })

  onCleanup(() => instance.cameraControl.off(subscription))
}, { immediate: true })

watch(open, (isOpen) => {
  if (!isOpen && entity.value) entity.value.highlighted = false
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
