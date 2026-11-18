<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { models, removeModel } = useModels()
const { clearSelection } = useProperties()

const tab = ref('objects')

const items = [
  { label: 'Models', value: 'models', slot: 'models' as const },
  { label: 'Objects', value: 'objects' },
  { label: 'Classes', value: 'classes' },
  { label: 'Storeys', value: 'storeys' },
] satisfies TabsItem[]

function remove(id: string) {
  clearSelection()
  removeModel(id)
}
</script>

<template>
  <UTabs
    v-model="tab"
    :items="items"
    :unmount-on-hide="false"
    :ui="{ root: 'min-h-0 flex-1', content: 'flex min-h-0 flex-1 flex-col pt-1' }"
  >
    <template #models>
      <ul class="flex min-h-0 flex-col gap-1 overflow-y-auto text-sm">
        <li
          v-for="model in models"
          :key="model.id"
          class="flex items-center justify-between gap-2 rounded pl-1 hover:bg-white/10"
        >
          <span
            class="truncate"
            :title="model.name"
          >
            {{ model.name }}
          </span>

          <UButton
            icon="i-lucide-trash"
            size="xs"
            color="neutral"
            variant="ghost"
            :aria-label="`Remove ${model.name}`"
            @click="remove(model.id)"
          />
        </li>
      </ul>
    </template>

    <template #content="{ item }">
      <ViewerExplorerTree :tab="item.value as ExplorerTab" />
    </template>
  </UTabs>
</template>
