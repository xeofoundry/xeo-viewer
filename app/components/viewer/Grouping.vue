<script setup lang="ts">
const { criteria, groups, clearGrouping } = useGrouping()

const rows = computed(() => {
  const flat: { key: string, node: GroupNode, depth: number }[] = []

  const walk = (nodes: GroupNode[], parentKey: string, depth: number) => nodes.forEach((node) => {
    const key = `${parentKey}/${node.label}`

    flat.push({ key, node, depth })
    walk(node.children, key, depth + 1)
  })

  walk(groups.value, '', 0)

  return flat
})

function items(current: string) {
  const option = (value: string, label = value) => ({ value, label, disabled: value !== current && criteria.value.includes(value) })

  return [
    GROUP_CRITERIA.map(criterion => option(criterion.value, criterion.label)),
    [...propertyIndex.value?.properties.keys() ?? []].map(name => option(name)),
  ]
}

const swatch = (color: RgbColor) => `rgb(${color.map(channel => Math.round(channel * 255)).join(' ')})`
</script>

<template>
  <div
    v-if="!propertyIndex"
    class="mx-auto my-4 flex max-w-62 flex-col items-center gap-2 text-center text-muted"
  >
    <UIcon
      name="i-lucide-layout-panel-top"
      class="size-8"
    />

    Load a model to group its objects
  </div>

  <div
    v-else
    class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
  >
    <div
      v-for="(criterion, index) in criteria"
      :key="index"
      class="flex shrink-0 items-end gap-2"
    >
      <UFormField
        :label="index ? 'Then by' : 'Group by'"
        class="min-w-0 flex-1"
      >
        <USelectMenu
          v-model="criteria[index]"
          :items="items(criterion)"
          value-key="value"
          placeholder="Select property"
          class="w-full"
        />
      </UFormField>

      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        aria-label="Remove"
        @click="criteria.splice(index, 1)"
      />
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <UButton
        v-if="criteria.length"
        label="Clear all"
        icon="i-lucide-trash-2"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="clearGrouping"
      />

      <UButton
        :label="criteria.length ? 'Then by' : 'Group by'"
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="ghost"
        class="ml-auto"
        @click="criteria.push('')"
      />
    </div>

    <div
      v-if="groups.length"
      class="flex flex-col gap-1 border-t border-tint/15 pt-3 text-sm"
    >
      <div class="flex items-center justify-between text-xs text-muted">
        <span class="font-semibold tracking-wide uppercase">Legend</span>

        <span>{{ groups.length }} groups</span>
      </div>

      <div
        v-for="{ key, node, depth } in rows"
        :key="key"
        class="flex items-center gap-2 py-1 pr-1"
        :style="{ paddingLeft: `${depth * 12 + 4}px` }"
      >
        <span
          class="size-3 shrink-0 rounded-sm"
          :style="node.color && { backgroundColor: swatch(node.color) }"
        />

        <span
          class="flex-1 truncate"
          :title="node.label"
        >
          {{ node.label }}
        </span>

        <span class="text-xs text-muted tabular-nums">{{ node.ids.length }}</span>
      </div>
    </div>
  </div>
</template>
