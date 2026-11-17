<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints, useWindowSize } from '@vueuse/core'
import type { CSSProperties } from 'vue'

const props = defineProps<{
  panelId: string
  title: string
  icon: string
  defaultWidth?: number
  minHeight?: number
}>()

const emit = defineEmits<{ close: [] }>()

const desktop = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
const { height: windowHeight } = useWindowSize()

const panel = useTemplateRef<HTMLElement>('panel')

const transform = usePanelTransform({
  id: props.panelId,
  target: panel,
  area: inject(PanelAreaSizeKey, null),
  defaultWidth: props.defaultWidth,
  minHeight: props.minHeight,
})

const floating = computed(() => desktop.value && transform.isManual.value)

const style = computed<CSSProperties>(() => {
  if (floating.value) return transform.floatingStyle.value
  if (!desktop.value) return { maxHeight: `${Math.max(200, windowHeight.value - 160)}px` }

  return props.minHeight ? { minHeight: `${props.minHeight}px` } : {}
})
</script>

<template>
  <section
    ref="panel"
    :style="style"
    class="pointer-events-auto relative flex flex-col overflow-hidden rounded-[21px] bg-surface/70 text-white backdrop-blur-md"
    :class="floating ? 'shadow-xl' : ['shadow-sm', desktop ? 'max-h-max min-h-0 w-full flex-1' : 'w-full']"
    @pointerdown="floating && transform.bringToFront()"
  >
    <header
      class="flex shrink-0 items-center justify-between p-3"
      :class="{ 'cursor-grab touch-none select-none active:cursor-grabbing': desktop }"
      @pointerdown="desktop && transform.startDrag($event)"
    >
      <div class="flex items-center gap-2">
        <UIcon
          :name="icon"
          class="size-6"
        />

        <span>{{ title }}</span>
      </div>

      <UButton
        icon="i-lucide-x"
        size="xl"
        square
        color="neutral"
        variant="ghost"
        aria-label="Close"
        @click="emit('close')"
        @pointerdown.stop
      />
    </header>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4">
      <slot />
    </div>

    <div
      v-if="floating"
      class="absolute right-0 bottom-0 flex size-5 cursor-nwse-resize touch-none items-end justify-end p-1 text-slate-400/70 hover:text-white"
      title="Drag to resize · double-click to reset"
      @pointerdown="transform.startResize"
      @dblclick="transform.resetGeometry"
    >
      <svg
        viewBox="0 0 10 10"
        class="size-2.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
      >
        <path
          d="M9 1 1 9M9 5 5 9"
          stroke-linecap="round"
        />
      </svg>
    </div>
  </section>
</template>
