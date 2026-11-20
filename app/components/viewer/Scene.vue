<script setup lang="ts">
import { NavCubePlugin, Viewer } from '@xeokit/xeokit-sdk'

const props = defineProps<{ model?: string, metadata?: string, modelBuffer?: ArrayBuffer, metadataBuffer?: ArrayBuffer }>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const navCubeCanvas = useTemplateRef<HTMLCanvasElement>('navCubeCanvas')
const pivot = useTemplateRef<HTMLImageElement>('pivot')

const viewer = useViewer()
const { loadUrl, loadBuffer } = useModels()

interface NavCubeInternals {
  _repaint?: () => void
  _cubeTextureCanvas?: { _textureCanvas?: HTMLCanvasElement, setAreaHighlighted?: (areaId: number, highlighted: boolean) => void }
}

// NavCubePlugin hardcodes '60px sans-serif' for its labels, so the font setter of its own texture context adds bold.
// It relies on plugin internals and quietly does nothing if an SDK update renames them.
function boldNavCubeLabels(navCube: NavCubePlugin) {
  const { _repaint, _cubeTextureCanvas: texture } = navCube as unknown as NavCubeInternals
  const context = texture?._textureCanvas?.getContext('2d')
  const font = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font')

  if (!context || !font?.set || !texture?.setAreaHighlighted || !_repaint) return

  Object.defineProperty(context, 'font', {
    configurable: true,
    get: font.get,
    set(value: string) {
      font.set!.call(this, `bold ${value}`)
    },
  })

  texture.setAreaHighlighted(0, false)
  _repaint.call(navCube)
}

onMounted(() => {
  // Entity offsets let walk mode move objects, readable geometry lets slices draw section caps
  const instance = new Viewer({ canvasElement: canvas.value!, transparent: true, entityOffsetsEnabled: true, readableGeometryEnabled: true })

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

  boldNavCubeLabels(new NavCubePlugin(instance, {
    canvasElement: navCubeCanvas.value!,
    color: '#ffffff',
    shadowVisible: false,
  }))

  setFastNavEnabled(instance, true)

  viewer.value = instance

  if (props.model) loadUrl(props.model, props.metadata)

  watch(() => props.modelBuffer, buffer => buffer && loadBuffer(buffer, props.metadataBuffer), { immediate: true })
})

onBeforeUnmount(() => {
  viewer.value?.destroy()
  viewer.value = undefined
})
</script>

<template>
  <!-- Fixed fills the page, or the <xeo-viewer> element, whose layout containment confines fixed descendants -->
  <div class="fixed inset-0 overflow-hidden bg-linear-to-b from-scene-top to-scene-bottom">
    <!-- xeokit's wheel listeners are passive, so without this the embedding page scrolls while zooming -->
    <canvas
      ref="canvas"
      class="block size-full"
      @wheel.prevent
    />

    <!-- NavCube's fixed internal camera leaves wide margins, so render it 1.6x larger and crop to 64x64 (toolbar height) -->
    <div class="absolute top-2 right-2 size-16 overflow-hidden">
      <canvas
        ref="navCubeCanvas"
        class="absolute -top-5 -left-5 size-26"
      />
    </div>

    <!-- xeokit positions this in page coordinates and toggles its visibility while orbiting -->
    <Teleport to="body">
      <img
        ref="pivot"
        src="~/assets/camera-pivot.svg"
        alt=""
        class="pointer-events-none invisible absolute z-40 size-8.75"
      >
    </Teleport>

    <ViewerSceneMenu />
  </div>
</template>
