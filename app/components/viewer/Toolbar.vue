<script setup lang="ts">
import { onKeyStroke, useKeyModifier } from '@vueuse/core'
import type { Entity } from '@xeokit/xeokit-sdk'

const { baseURL } = useRuntimeConfig().app
const viewer = useViewer()
const { showObject, hide, clearSelection } = useProperties()

const open = useOpenPanels()
const sliceMode = useSliceMode()
const isOrtho = ref(false)
const selecting = ref(true)

const ctrl = useKeyModifier('Control')
const meta = useKeyModifier('Meta')

onKeyStroke('Escape', clearSelection)

// Slicing places a plane with the same click that selects, so the two modes never run together
watch(sliceMode, (slicing) => {
  selecting.value = !slicing
})

watch(selecting, (active) => {
  if (active) sliceMode.value = false
})

watch([viewer, selecting], ([instance, active], _, onCleanup) => {
  if (!instance || !active) return

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

      const wasSelected = entity.selected

      if (!ctrl.value && !meta.value) clearSelection()

      entity.selected = !wasSelected

      if (entity.selected) showObject(String(entity.id))
      else hide(String(entity.id))
    }),
    cameraControl.on('pickedNothing', clearSelection),
  ]

  onCleanup(() => {
    subscriptions.forEach(subscription => cameraControl.off(subscription))

    if (hovered && !hovered.destroyed) hovered.highlighted = false
  })
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
      </UTooltip>
    </div>

    <USeparator
      orientation="vertical"
      class="h-7"
    />

    <div class="flex items-center gap-1">
      <UTooltip text="Select objects">
        <UButton
          icon="i-lucide-mouse-pointer-click"
          size="xl"
          square
          :color="selecting ? 'primary' : 'neutral'"
          :variant="selecting ? 'solid' : 'ghost'"
          aria-label="Select objects"
          :aria-pressed="selecting"
          @click="selecting = !selecting"
        />
      </UTooltip>

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

      <UTooltip text="Slice objects">
        <UButton
          icon="i-lucide-scissors"
          size="xl"
          square
          :color="sliceMode ? 'primary' : 'neutral'"
          :variant="sliceMode ? 'solid' : 'ghost'"
          aria-label="Slice objects"
          :aria-pressed="sliceMode"
          @click="sliceMode = !sliceMode"
        />
      </UTooltip>
    </div>
  </header>
</template>
