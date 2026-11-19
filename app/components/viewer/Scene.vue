<script setup lang="ts">
import { NavCubePlugin, Viewer } from '@xeokit/xeokit-sdk'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const navCubeCanvas = useTemplateRef<HTMLCanvasElement>('navCubeCanvas')
const pivot = useTemplateRef<HTMLImageElement>('pivot')

const route = useRoute()
const { baseURL } = useRuntimeConfig().app
const viewer = useViewer()
const { loadUrl } = useModels()

onMounted(() => {
  const instance = new Viewer({ canvasElement: canvas.value!, transparent: true })

  // Only the direction matters: fitView keeps it and refits the distance to the model
  instance.camera.eye = HOME_DIRECTION

  Object.assign(instance.scene.highlightMaterial, { fill: true, fillAlpha: 0.1, edges: true, edgeAlpha: 1, edgeColor: [1, 1, 0] })

  Object.assign(instance.scene.xrayMaterial, {
    fillAlpha: 0.4,
    fillColor: [0.970588207244873, 0.7965892553329468, 0.6660899519920349],
    edges: true,
    edgeAlpha: 1,
    edgeColor: [0.529411792755127, 0.4577854573726654, 0.4100345969200134],
    edgeWidth: 1,
  })

  // With double-click fly-to on, xeokit holds every 'picked' event 250 ms to tell a click from a double click
  instance.cameraControl.doublePickFlyTo = false
  instance.cameraControl.pivotElement = pivot.value!

  new NavCubePlugin(instance, {
    canvasElement: navCubeCanvas.value!,
    color: '#ffffff',
    shadowVisible: false,
  })

  setFastNavEnabled(instance, true)

  viewer.value = instance

  const { model, metadata } = route.query

  if (typeof model === 'string') {
    loadUrl(model === 'dev' ? `${baseURL}models/otc-conference-center.xkt` : model, typeof metadata === 'string' ? metadata : undefined)
  }
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

    <!-- xeokit positions this in page coordinates and toggles its visibility while orbiting -->
    <img
      ref="pivot"
      :src="`${baseURL}camera-pivot.svg`"
      alt=""
      class="pointer-events-none invisible fixed z-40 size-8.75"
    >

    <ViewerSceneMenu />
  </div>
</template>
