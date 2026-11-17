<script setup lang="ts">
import { NavCubePlugin, Viewer, XKTLoaderPlugin } from '@xeokit/xeokit-sdk'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const navCubeCanvas = useTemplateRef<HTMLCanvasElement>('navCubeCanvas')

const viewer = useViewer()

onMounted(() => {
  const instance = new Viewer({ canvasElement: canvas.value!, transparent: true })

  // Only the direction matters: fitView keeps it and refits the distance to the model
  instance.camera.eye = [-10, 7, 17]

  new NavCubePlugin(instance, {
    canvasElement: navCubeCanvas.value!,
    color: '#ffffff',
    shadowVisible: false,
  })

  if (import.meta.dev) {
    const model = new XKTLoaderPlugin(instance).load({
      id: 'otc-conference-center',
      src: '/models/otc-conference-center.xkt',
      edges: true,
    })

    model.on('loaded', () => fitView(instance))
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
  </div>
</template>
