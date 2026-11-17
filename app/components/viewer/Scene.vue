<script setup lang="ts">
import { NavCubePlugin, Viewer, XKTLoaderPlugin } from '@xeokit/xeokit-sdk'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const navCubeCanvas = useTemplateRef<HTMLCanvasElement>('navCubeCanvas')

const viewer = useViewer()
const loading = ref(false)

onMounted(() => {
  const instance = new Viewer({ canvasElement: canvas.value!, transparent: true })

  // Only the direction matters: fitView keeps it and refits the distance to the model
  instance.camera.eye = [-10, 7, 17]

  new NavCubePlugin(instance, {
    canvasElement: navCubeCanvas.value!,
    color: '#ffffff',
    shadowVisible: false,
  })

  setFastNavEnabled(instance, true)

  if (import.meta.dev) {
    loading.value = true

    const model = new XKTLoaderPlugin(instance).load({
      id: 'otc-conference-center',
      src: '/models/otc-conference-center.xkt',
      edges: true,
    })

    model.on('loaded', () => {
      loading.value = false
      fitView(instance)
    })
    model.on('error', () => loading.value = false)
  }

  viewer.value = instance
})

onBeforeUnmount(() => {
  viewer.value?.destroy()
  viewer.value = undefined
})
</script>

<template>
  <div class="relative h-dvh bg-linear-to-b from-[#4b4a56] to-[#28252e]">
    <canvas
      ref="canvas"
      class="block size-full"
    />

    <!-- NavCube's fixed internal camera leaves wide margins, so render it 1.6x larger and crop to 64x64 (toolbar height) -->
    <div class="absolute top-2 right-2 size-16 overflow-hidden">
      <canvas
        ref="navCubeCanvas"
        class="absolute -top-5 -left-5 size-26"
      />
    </div>

    <div
      v-if="loading"
      role="status"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div class="flex items-center gap-2 rounded-[21px] bg-surface/70 px-4 py-3 text-white shadow-sm backdrop-blur-md">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 animate-spin"
        />

        Loading model…
      </div>
    </div>
  </div>
</template>
