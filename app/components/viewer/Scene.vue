<script setup lang="ts">
import { NavCubePlugin, Viewer, XKTLoaderPlugin } from '@xeokit/xeokit-sdk'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const navCubeCanvas = useTemplateRef<HTMLCanvasElement>('navCubeCanvas')

let viewer: Viewer | undefined

onMounted(() => {
  viewer = new Viewer({ canvasElement: canvas.value!, transparent: true })

  // Only the direction matters: jumpTo keeps it and refits the distance to the model
  viewer.camera.eye = [-10, 7, 17]

  new NavCubePlugin(viewer, {
    canvasElement: navCubeCanvas.value!,
    color: '#ffffff',
    shadowVisible: false,
  })

  if (import.meta.dev) {
    const model = new XKTLoaderPlugin(viewer).load({
      id: 'otc-conference-center',
      src: '/models/otc-conference-center.xkt',
      edges: true,
    })

    model.on('loaded', () => viewer?.cameraFlight.jumpTo(model))
  }
})

onBeforeUnmount(() => viewer?.destroy())
</script>

<template>
  <div class="relative h-dvh bg-linear-to-b from-[#4b4a56] to-[#28252e]">
    <canvas
      ref="canvas"
      class="block size-full"
    />

    <!-- NavCube's fixed internal camera leaves wide margins, so render it 1.6x larger and crop to 70x70 -->
    <div class="absolute top-2 right-2 size-[70px] overflow-hidden">
      <canvas
        ref="navCubeCanvas"
        class="absolute -top-[21px] -left-[21px] size-[112px]"
      />
    </div>
  </div>
</template>
