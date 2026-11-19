<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

const panelArea = useTemplateRef<HTMLElement>('panelArea')
const { width, height } = useElementSize(panelArea)

provide(PanelAreaSizeKey, { width, height })

const open = useOpenPanels()

const columns = {
  left: panels.filter(panel => panel.column === 'left'),
  right: panels.filter(panel => panel.column === 'right'),
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-50 flex flex-col-reverse gap-2 p-2 md:flex-col">
    <ViewerToolbar />

    <div
      ref="panelArea"
      class="relative grid min-h-0 auto-rows-min grid-cols-12 overflow-hidden md:grow md:auto-rows-fr md:gap-2"
    >
      <div
        v-for="(columnPanels, column) in columns"
        :key="column"
        class="col-span-12 flex min-h-0 flex-col-reverse gap-2 md:col-span-4 md:flex-col 2xl:col-span-3"
        :class="{ 'md:col-start-9 2xl:col-start-10': column === 'right' }"
      >
        <ViewerPanel
          v-for="panel in columnPanels"
          v-show="open[panel.id]"
          :key="panel.id"
          :panel-id="panel.id"
          :title="panel.title"
          :icon="panel.icon"
          :default-width="panel.defaultWidth"
          :min-height="panel.minHeight"
          @close="open[panel.id] = false"
        >
          <ViewerExplorer v-if="panel.id === 'explorer'" />
          <ViewerProperties v-else-if="panel.id === 'properties'" />
          <!-- Mounted only while open, so the property index is not built until someone filters or groups -->
          <ViewerFilters v-else-if="panel.id === 'filters' && open.filters" />
          <ViewerGrouping v-else-if="panel.id === 'grouping' && open.grouping" />
        </ViewerPanel>
      </div>

      <!-- Without row-start-1, grid auto-placement would push it below the right column, which precedes it in the DOM -->
      <div class="col-span-12 flex justify-center md:col-span-4 md:col-start-5 md:row-start-1 2xl:col-span-6 2xl:col-start-4">
        <ViewerSlices />
      </div>
    </div>

    <footer class="hidden h-6 justify-end md:flex">
      <UButton
        v-if="hasCustomPanelLayout"
        icon="i-lucide-rotate-ccw"
        label="Reset layout"
        size="xs"
        color="neutral"
        variant="ghost"
        class="pointer-events-auto bg-surface text-white hover:bg-zinc-600"
        @click="resetPanelLayout"
      />
    </footer>
  </div>
</template>
