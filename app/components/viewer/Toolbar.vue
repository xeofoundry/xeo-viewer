<script setup lang="ts">
import { onKeyStroke, useKeyModifier } from '@vueuse/core'
import type { Entity } from '@xeokit/xeokit-sdk'

const { baseURL } = useRuntimeConfig().app
const viewer = useViewer()
const { showObject, hide, clearSelection } = useProperties()

const open = useOpenPanels()
const tool = useToolMode()
const { setMeasuring } = useMeasurements()
const { activeCount: filterCount } = useFilters()
const { activeCount: groupingCount } = useGrouping()

// Filters and grouping keep acting on the model after their panel closes
const badges = computed<Partial<Record<string, number>>>(() => ({ filters: filterCount.value, grouping: groupingCount.value }))

const isOrtho = ref(false)

const tools = [
  { id: 'select', label: 'Select objects', icon: 'i-lucide-mouse-pointer' },
  { id: 'hide', label: 'Hide objects', icon: 'i-lucide-eraser' },
  { id: 'measure', label: 'Measure distance', icon: 'i-lucide-ruler' },
  { id: 'slice', label: 'Slice objects', icon: 'i-lucide-scissors' },
] satisfies { id: ToolMode, label: string, icon: string }[]

const ctrl = useKeyModifier('Control')
const meta = useKeyModifier('Meta')

onKeyStroke('Escape', () => {
  clearSelection()
  tool.value = 'select'
})

watch([viewer, tool], ([instance, mode], _, onCleanup) => {
  if (!instance || (mode !== 'select' && mode !== 'hide')) return

  const { cameraControl } = instance
  let hovered: Entity | undefined

  const subscriptions = [
    cameraControl.on('hoverEnter', ({ entity }) => {
      hovered = entity
      entity.highlighted = true
    }),
    cameraControl.on('hoverOut', ({ entity }) => {
      if (entity) entity.highlighted = false
    }),
    cameraControl.on('picked', ({ entity }) => {
      if (!entity) return

      if (mode === 'hide') {
        entity.visible = false
        return
      }

      const wasSelected = entity.selected

      if (!ctrl.value && !meta.value) clearSelection()

      entity.selected = !wasSelected

      if (entity.selected) showObject(String(entity.id))
      else hide(String(entity.id))
    }),
    cameraControl.on('pickedNothing', () => {
      if (mode === 'select') clearSelection()
    }),
  ]

  onCleanup(() => {
    subscriptions.forEach(subscription => cameraControl.off(subscription))

    if (hovered && !hovered.destroyed) hovered.highlighted = false
  })
}, { immediate: true })

watch([viewer, tool], ([instance, mode], _, onCleanup) => {
  if (!instance || mode !== 'measure') return

  setMeasuring(true)
  onCleanup(() => setMeasuring(false))
}, { immediate: true })

function toggleProjection() {
  if (!viewer.value) return

  const { camera, cameraFlight } = viewer.value

  if (!isOrtho.value) {
    // Match the ortho extent to the current perspective frame, otherwise the view jumps on switch
    camera.ortho.scale = 2 * Math.max(...viewHalfExtent(viewer.value))
  }

  isOrtho.value = !isOrtho.value
  cameraFlight.flyTo({ projection: isOrtho.value ? 'ortho' : 'perspective', duration: 0.5 })
}

function viewFit() {
  if (viewer.value) fitView(viewer.value, 0.5)
}
</script>

<template>
  <header class="pointer-events-auto flex items-center gap-4 self-start rounded-[21px] bg-surface/70 p-3 text-white shadow-sm backdrop-blur-md">
    <img
      :src="`${baseURL}xeokit-logo.svg`"
      alt="xeokit"
      class="h-8"
    >

    <div class="ml-3 flex items-center gap-1">
      <UTooltip
        v-for="panel in panels"
        :key="panel.id"
        :text="panel.title"
      >
        <UChip
          :text="badges[panel.id]"
          :show="!!badges[panel.id]"
          color="neutral"
          size="3xl"
          inset
        >
          <UButton
            :icon="panel.icon"
            size="xl"
            square
            :color="open[panel.id] ? 'primary' : 'neutral'"
            :variant="open[panel.id] ? 'solid' : 'ghost'"
            :aria-label="panel.title"
            :aria-pressed="!!open[panel.id]"
            @click="open[panel.id] = !open[panel.id]"
          />
        </UChip>
      </UTooltip>
    </div>

    <USeparator
      orientation="vertical"
      class="h-7"
    />

    <div class="flex items-center gap-1">
      <UTooltip :text="isOrtho ? 'Orthographic' : 'Perspective'">
        <UButton
          :icon="isOrtho ? 'i-lucide-square' : 'i-lucide-box'"
          size="xl"
          square
          color="neutral"
          variant="ghost"
          :aria-label="isOrtho ? 'Switch to perspective' : 'Switch to orthographic'"
          @click="toggleProjection"
        />
      </UTooltip>

      <UTooltip text="View fit">
        <UButton
          icon="i-lucide-maximize-2"
          size="xl"
          square
          color="neutral"
          variant="ghost"
          aria-label="View fit"
          @click="viewFit"
        />
      </UTooltip>
    </div>

    <USeparator
      orientation="vertical"
      class="h-7"
    />

    <div class="flex items-center gap-1 rounded-lg bg-white/10">
      <UTooltip
        v-for="item in tools"
        :key="item.id"
        :text="item.label"
      >
        <UButton
          :icon="item.icon"
          size="xl"
          square
          :color="tool === item.id ? 'primary' : 'neutral'"
          :variant="tool === item.id ? 'solid' : 'ghost'"
          :aria-label="item.label"
          :aria-pressed="tool === item.id"
          @click="tool = tool === item.id ? null : item.id"
        />
      </UTooltip>
    </div>
  </header>
</template>
