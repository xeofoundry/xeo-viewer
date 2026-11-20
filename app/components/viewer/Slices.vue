<script setup lang="ts">
import { math, Mesh, PhongMaterial, ReadableGeometry, SectionPlanesPlugin, type PickResult, type SectionPlane } from '@xeokit/xeokit-sdk'

// Present in the SDK but missing from its typings
const { vec3PairToQuaternion } = math as unknown as { vec3PairToQuaternion: (u: number[], v: number[], dest: number[]) => number[] }

const viewer = useViewer()
const sliceMode = useSliceMode()

const adding = ref(false)
const menuOpen = ref(false)
const planes = shallowRef<SectionPlane[]>([])
const editedId = ref<string>()

let plugin: SectionPlanesPlugin | undefined
let preview: Mesh | undefined
let unsubscribe = () => {}

useSlices().register({ count: () => planes.value.length, clear })

watch(viewer, (instance) => {
  if (!instance) return

  const { scene } = instance

  makeCapsUnpickable(scene)

  plugin = new SectionPlanesPlugin(instance, { overviewVisible: false })
  preview = new Mesh(scene, {
    geometry: new ReadableGeometry(scene, {
      primitive: 'triangles',
      // Offset slightly along the surface normal so the preview does not z-fight with the hovered face
      positions: [-0.5, 0.5, -0.02, 0.5, 0.5, -0.02, -0.5, -0.5, -0.02, 0.5, -0.5, -0.02],
      indices: [0, 1, 2, 2, 1, 3],
    }),
    material: new PhongMaterial(scene, { emissive: [0.26, 0.2, 0.66], diffuse: [0.26, 0.2, 0.66], backfaces: true }),
    opacity: 0.7,
    visible: false,
    pickable: false,
    collidable: false,
    clippable: false,
  })

  refresh()
}, { immediate: true })

watch(sliceMode, (active) => {
  adding.value = active && !planes.value.length
  if (!active) showControl(undefined)
})

watch(adding, (active) => {
  if (!active) return stopAdding()
  if (!viewer.value) return

  const { scene, cameraControl } = viewer.value

  // CameraControl hover and pick events carry no surface normal, so they only drive our own pick
  const moveId = scene.input.on('mousemove', canvasPos => showPreview(pickSurface(canvasPos)))
  const pickId = cameraControl.on('picked', hit => addPlane(pickSurface(hit.canvasPos)))

  unsubscribe = () => {
    scene.input.off(moveId)
    cameraControl.off(pickId)
  }
})

onBeforeUnmount(() => {
  stopAdding()

  // Scene unmounts first and destroys the viewer together with its plugins, so this only runs on HMR
  if (viewer.value) {
    plugin?.destroy()
    preview?.destroy()
  }
})

// SectionCaps registers caps as pickable objects with no SceneModel behind them, which the pick handlers rely on.
// Mesh sets pickable from its config right after registering, so the override waits for the constructor to finish.
function makeCapsUnpickable(scene: object) {
  const internals = scene as { _registerObject?: (object: unknown) => void }
  const register = internals._registerObject?.bind(scene)

  if (!register) return

  internals._registerObject = (object) => {
    register(object)

    if (object instanceof Mesh) {
      queueMicrotask(() => {
        object.pickable = false
      })
    }
  }
}

function stopAdding() {
  unsubscribe()
  unsubscribe = () => {}
  hidePreview()
}

function pickSurface(canvasPos: number[]) {
  const hit = viewer.value?.scene.pick({ canvasPos, pickSurface: true, pickSurfaceNormal: true })

  // Only model surfaces: lines and points have no normal, and plane controls are not objects
  return hit?.entity?.isObject && hit.worldNormal ? hit : undefined
}

function showPreview(hit: PickResult | undefined) {
  if (!preview || !hit) return hidePreview()

  const { camera } = viewer.value!
  const size = camera.projection === 'ortho'
    ? camera.ortho.scale / 10
    : 0.07 * Math.hypot(...math.subVec3(camera.eye, hit.worldPos, [])) * Math.tan(camera.perspective.fov * math.DEGTORAD)

  preview.position = hit.worldPos
  preview.quaternion = vec3PairToQuaternion([0, 0, -1], hit.worldNormal, [])
  preview.scale = [size, size, size]
  preview.visible = true
}

function hidePreview() {
  if (preview) preview.visible = false
}

function addPlane(hit: PickResult | undefined) {
  if (!plugin || !hit) return

  const plane = plugin.createSectionPlane({ pos: hit.worldPos, dir: math.mulVec3Scalar(hit.worldNormal, -1, []) })

  refresh()
  showControl(plane.id)
  adding.value = false
}

function refresh() {
  planes.value = plugin ? Object.values(plugin.sectionPlanes) : []
  if (!planes.value.length) menuOpen.value = false
}

function showControl(id: string | undefined) {
  plugin?.hideControl()
  if (id) plugin?.showControl(id)
  editedId.value = id
}

function setActive(plane: SectionPlane, active: boolean) {
  plane.active = active
  if (!active && plane.id === editedId.value) showControl(undefined)
  triggerRef(planes)
}

function setAllActive(active: boolean) {
  planes.value.forEach(plane => setActive(plane, active))
}

function edit(plane: SectionPlane) {
  if (plane.id === editedId.value) return showControl(undefined)

  showControl(plane.id)

  // Fly to the model bounds re-centered on the plane, so the whole cut stays in view
  const { scene, cameraFlight } = viewer.value!
  const aabb = scene.getAABB(scene.visibleObjectIds)
  const center = math.getAABB3Center(aabb)

  cameraFlight.flyTo({ aabb: aabb.map((value, i) => value + plane.pos[i % 3]! - center[i % 3]!), fitFOV: 65 })
}

function remove(plane: SectionPlane) {
  if (plane.id === editedId.value) editedId.value = undefined
  plugin?.destroySectionPlane(plane.id)
  refresh()
}

function clear() {
  plugin?.clear()
  editedId.value = undefined
  refresh()
}

// Hovering a row reveals its plane, leaving it restores the plane being edited
function peek(plane?: SectionPlane) {
  plugin?.hideControl()
  const id = plane?.id ?? editedId.value
  if (id) plugin?.showControl(id)
}
</script>

<template>
  <div
    v-if="sliceMode"
    class="flex flex-col-reverse items-center gap-2 md:flex-col"
  >
    <div class="pointer-events-auto flex items-center gap-1 rounded-[21px] bg-surface/70 p-3 text-highlighted shadow-sm backdrop-blur-md">
      <UTooltip text="Add new slice">
        <UButton
          icon="i-lucide-plus"
          size="xl"
          square
          :color="adding ? 'primary' : 'neutral'"
          :variant="adding ? 'solid' : 'ghost'"
          aria-label="Add new slice"
          :aria-pressed="adding"
          @click="adding = !adding"
        />
      </UTooltip>

      <UPopover v-model:open="menuOpen">
        <UButton
          :label="`Slices (${planes.length})`"
          trailing-icon="i-lucide-chevron-down"
          size="xl"
          color="neutral"
          variant="ghost"
          :disabled="!planes.length"
        />

        <template #content>
          <div class="flex w-64 flex-col gap-1 p-1">
            <div class="grid grid-cols-2 gap-1">
              <UButton
                label="Clear all"
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                @click="clear"
              />

              <UButton
                label="Flip all"
                icon="i-lucide-flip-horizontal-2"
                color="neutral"
                variant="ghost"
                @click="plugin?.flipSectionPlanes()"
              />

              <UButton
                label="Hide all"
                icon="i-lucide-eye-off"
                color="neutral"
                variant="ghost"
                @click="setAllActive(false)"
              />

              <UButton
                label="Show all"
                icon="i-lucide-eye"
                color="neutral"
                variant="ghost"
                @click="setAllActive(true)"
              />
            </div>

            <USeparator />

            <div
              v-for="(plane, index) in planes"
              :key="plane.id"
              class="flex items-center justify-between gap-2 rounded-md py-1 pl-2 hover:bg-tint/10"
              @mouseenter="peek(plane)"
              @mouseleave="peek()"
            >
              <UCheckbox
                :model-value="plane.active"
                :label="`Slice ${index + 1}`"
                @update:model-value="setActive(plane, !!$event)"
              />

              <div class="flex items-center">
                <UButton
                  icon="i-lucide-pencil"
                  size="sm"
                  square
                  :color="plane.id === editedId ? 'primary' : 'neutral'"
                  :variant="plane.id === editedId ? 'solid' : 'ghost'"
                  :disabled="!plane.active"
                  aria-label="Edit"
                  :aria-pressed="plane.id === editedId"
                  @click="edit(plane)"
                />

                <UButton
                  icon="i-lucide-trash-2"
                  size="sm"
                  square
                  color="neutral"
                  variant="ghost"
                  aria-label="Delete"
                  @click="remove(plane)"
                />

                <UButton
                  icon="i-lucide-flip-horizontal-2"
                  size="sm"
                  square
                  color="neutral"
                  variant="ghost"
                  :disabled="!plane.active"
                  aria-label="Flip"
                  @click="plane.flipDir()"
                />
              </div>
            </div>
          </div>
        </template>
      </UPopover>
    </div>

    <div
      v-if="adding && !planes.length"
      class="pointer-events-auto flex items-center gap-2 rounded-md bg-surface/70 px-3 py-1 text-sm text-highlighted backdrop-blur-md"
    >
      <UIcon
        name="i-lucide-info"
        class="size-4"
      />
      To add a plane, select a surface in the model
    </div>
  </div>
</template>
