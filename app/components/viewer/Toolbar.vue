<script setup lang="ts">
const viewer = useViewer()

const open = useOpenPanels()
const sliceMode = useSliceMode()
const isOrtho = ref(false)

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
    <div class="flex items-center gap-2">
      <svg
        viewBox="0 0 132.71 96.29"
        class="h-8 w-11"
        aria-hidden="true"
      >
        <path
          fill="#7a7a7a"
          d="M36.11,67.88L0,0,29.4,17.41l19.93,1.07,18.55-9.54,32.22,19.55,14.74-5.65,17.87,26.65-23.13,12.06-10.15,19.85-34.66,14.89-10.84-26.34-17.79-2.06h-.03Z"
        />
        <path
          fill="#fff"
          d="M125.65,47.88l-12.26-18.56-.98,.34h0l-13.16,4.53-31.56-19-15.79,8.36-22.41-.67L14.77,13.53h0l-4.33-2.78,27.28,50.94,.79,1.32,18.72,2.57,9.69,23.62,15.49-6.87,13.85-5.54,9.18-19.29,20.2-9.62h.01Zm-41.85-2.54l18.92,11.67-7.37,15.48s-11.55-27.15-11.55-27.15Zm-18.36-2.69l12.35,.55-20.09,19.76-15.47-2.14,12.73-18.89,10.44,.71m15.52-.66h0v.02h0v-.02Zm40.8,4.82l-17.2,8.19-20.51-12.65,28.13-9.75,.16-.05,9.42,14.27h0Zm-40.99-6.16l-13.77-.61,1.91-21.01,27.13,16.32-15.27,5.3Zm-16.26-2.73l-10.2-12.61,11.92-6.32-1.72,18.92h0Zm-12.92-11.69l10.97,13.55-7.82-.53-21.07-13.55s17.92,.53,17.92,.53Zm-33.91-7.64l34.76,22.36-12.69,18.84L17.66,18.57h-.02Zm63.72,61.31l-13.02,5.78-8.61-20.96,20.71-20.37,13.05,30.69-12.14,4.86h0Z"
        />
      </svg>

      <span class="text-lg leading-6 font-black">
        xeokit
      </span>
    </div>

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
