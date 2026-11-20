<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { SceneModel } from '@xeokit/xeokit-sdk'

const viewer = useViewer()
const { models } = useModels()

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

  const subscription = onObjectVisibility(instance.scene, scheduleRefresh)

  onCleanup(() => instance.scene.off(subscription))
}, { immediate: true })

function setVisible(id: string, visible: boolean) {
  const model = sceneModel(id)

  if (model) viewer.value!.scene.setObjectsVisible(Object.keys(model.objects), visible)
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
          class="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-tint/10"
        >
          <span
            class="flex-1 truncate"
            :title="model.name"
          >
            {{ model.name }}
          </span>

          <input
            type="checkbox"
            class="shrink-0 cursor-pointer accent-primary"
            :checked="visibility[model.id] ?? true"
            :indeterminate="visibility[model.id] === 'indeterminate'"
            :aria-label="`Show ${model.name}`"
            @change="setVisible(model.id, ($event.target as HTMLInputElement).checked)"
          >
        </li>
      </ul>
    </template>

    <template #content="{ item }">
      <ViewerExplorerTree :tab="item.value as ExplorerTab" />
    </template>
  </UTabs>
</template>
