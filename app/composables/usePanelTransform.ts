import { useStorage, useWindowSize } from '@vueuse/core'
import type { CSSProperties, InjectionKey, Ref } from 'vue'

export interface PanelAreaSize {
  width: Ref<number>
  height: Ref<number>
}

interface PanelGeometry {
  x: number | null
  y: number | null
  width: number
  height: number | null
}

export const PanelAreaSizeKey: InjectionKey<PanelAreaSize> = Symbol('panel-area-size')

const MIN_WIDTH = 280
const MIN_HEIGHT = 160
const DRAG_THRESHOLD = 15

const geometries = useStorage<Record<string, PanelGeometry>>('panel-layout', {})

const dock = (geometry: PanelGeometry) => Object.assign(geometry, { x: null, y: null, height: null })

export const hasCustomPanelLayout = computed(() =>
  Object.values(geometries.value).some(({ x, y, height }) => x !== null || y !== null || height !== null),
)

export function resetPanelLayout() {
  Object.values(geometries.value).forEach(dock)
}

let topZIndex = 20

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function usePanelTransform(options: {
  id: string
  target: Readonly<Ref<HTMLElement | null>>
  area: PanelAreaSize | null
  defaultWidth?: number
  minHeight?: number
}) {
  const { id, target, area, defaultWidth = 360, minHeight = MIN_HEIGHT } = options

  const fallback = useWindowSize()
  const areaWidth = computed(() => area?.width.value || fallback.width.value)
  const areaHeight = computed(() => area?.height.value || fallback.height.value)

  const ensure = () => (geometries.value[id] ??= { x: null, y: null, width: defaultWidth, height: null })

  ensure()

  // The getter re-creates the entry because storage cleared in another tab drops it
  const geometry = computed({
    get: ensure,
    set: (value) => {
      geometries.value[id] = value
    },
  })

  const isManual = computed(() => geometry.value.x !== null || geometry.value.y !== null)

  const width = computed(() => clamp(geometry.value.width, MIN_WIDTH, areaWidth.value))
  const left = computed(() => clamp(geometry.value.x ?? 0, 0, areaWidth.value - width.value))
  const top = computed(() => clamp(geometry.value.y ?? 0, 0, areaHeight.value - minHeight))
  const availableHeight = computed(() => Math.max(minHeight, areaHeight.value - top.value))

  const zIndex = ref(++topZIndex)

  function bringToFront() {
    if (zIndex.value !== topZIndex) zIndex.value = ++topZIndex
  }

  const floatingStyle = computed<CSSProperties>(() => ({
    position: 'absolute',
    left: `${left.value}px`,
    top: `${top.value}px`,
    width: `${width.value}px`,
    zIndex: zIndex.value,
    ...(geometry.value.height === null
      ? { maxHeight: `${availableHeight.value}px` }
      : { height: `${clamp(geometry.value.height, minHeight, availableHeight.value)}px` }),
  }))

  let stop: (() => void) | undefined

  function endTracking() {
    stop?.()
    stop = undefined
    document.body.style.userSelect = ''
  }

  function track(onMove: (event: PointerEvent) => void) {
    endTracking()
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endTracking)
    window.addEventListener('pointercancel', endTracking)

    stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endTracking)
      window.removeEventListener('pointercancel', endTracking)
    }
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== 0) return

    bringToFront()

    const startX = event.clientX
    const startY = event.clientY
    let originLeft = left.value
    let originTop = top.value
    let detached = isManual.value

    track((moveEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY

      if (!detached) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return

        const element = target.value

        if (element) {
          geometry.value = { x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }
        }

        originLeft = left.value
        originTop = top.value
        detached = true
      }

      geometry.value.x = originLeft + dx
      geometry.value.y = originTop + dy
    })
  }

  function startResize(event: PointerEvent) {
    if (event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    const originWidth = target.value?.offsetWidth ?? width.value
    const originHeight = target.value?.offsetHeight ?? availableHeight.value

    track((moveEvent) => {
      geometry.value.width = originWidth + moveEvent.clientX - startX
      geometry.value.height = originHeight + moveEvent.clientY - startY
    })
  }

  const resetGeometry = () => dock(geometry.value)

  onScopeDispose(endTracking)

  return { isManual, floatingStyle, startDrag, startResize, resetGeometry, bringToFront }
}
