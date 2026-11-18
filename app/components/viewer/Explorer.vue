<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { SceneModel } from '@xeokit/xeokit-sdk'

const viewer = useViewer()
const { models, removeModel } = useModels()
const { clearSelection } = useProperties()

const tab = ref('objects')

const items = [
  { label: 'Models', value: 'models', slot: 'models' as const },
  { label: 'Objects', value: 'objects' },
  { label: 'Classes', value: 'classes' },
  { label: 'Storeys', value: 'storeys' },
] satisfies TabsItem[]

const visibility = shallowRef<Record<string, boolean | 'indeterminate'>>({})

const sceneModel = (id: string) => viewer.value?.scene.models[id] as SceneModel | undefined

function refreshVisibility() {
  visibility.value = Object.fromEntries(models.value.map(({ id }) => {
    const objects = Object.values(sceneModel(id)?.objects ?? {})
    const visible = objects.filter(object => object.visible).length

    return [id, visible === objects.length || (visible > 0 && 'indeterminate')]
  }))
}

const scheduleRefresh = perFrame(refreshVisibility)

watch(models, scheduleRefresh, { immediate: true })

watch(viewer, (instance, _, onCleanup) => {
  if (!instance) return

  const subscription = instance.scene.on('objectVisibility', scheduleRefresh)

  onCleanup(() => instance.scene.off(subscription))
}, { immediate: true })

function setVisible(id: string, visible: boolean) {
  const model = sceneModel(id)

  if (model) viewer.value!.scene.setObjectsVisible(Object.keys(model.objects), visible)
}

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
          class="flex items-center gap-2 rounded pl-1 hover:bg-white/10"
        >
          <input
            type="checkbox"
            class="shrink-0 cursor-pointer accent-violet-400"
            :checked="visibility[model.id] ?? true"
            :indeterminate="visibility[model.id] === 'indeterminate'"
            :aria-label="`Show ${model.name}`"
            @change="setVisible(model.id, ($event.target as HTMLInputElement).checked)"
          >

          <span
            class="flex-1 truncate"
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
