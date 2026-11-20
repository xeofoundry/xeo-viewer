<script setup lang="ts">
const { inspected } = useProperties()
const { addCondition } = useFilters()
const open = useOpenPanels()

const search = ref('')
const query = computed(() => search.value.trim().toLowerCase())

const entries = computed(() => [...inspected])

// When the selection changes only the first object stays open
const expandedKeys = ref(new Set<string>())

watch(() => entries.value.map(([key]) => key).join('|'), () => {
  expandedKeys.value = new Set(entries.value.slice(0, 1).map(([key]) => key))
}, { immediate: true })

// A filter expands everything so matches are never hidden behind a collapsed object
const isExpanded = (key: string) => !!query.value || expandedKeys.value.has(key)

function toggle(key: string) {
  const next = new Set(expandedKeys.value)

  if (!next.delete(key)) next.add(key)

  expandedKeys.value = next
}

const matches = (text: unknown) => !query.value || String(text ?? '').toLowerCase().includes(query.value)

const visibleAttributes = (object: PropertyObject) => Object.entries(object.attributes).filter(([key, value]) => matches(key) || matches(value))

// While filtering, a set survives when its name matches or it still has a matching property
function visiblePropertySets(object: PropertyObject) {
  if (!query.value) return object.propertySets

  return object.propertySets
    .map(set => matches(set.name) ? set : { ...set, properties: set.properties.filter(property => matches(property.name) || matches(property.value)) })
    .filter(set => matches(set.name) || set.properties.length)
}

const menuTarget = ref<{ property: string, value: string }>()

const menuItems = computed(() => [{
  label: 'Add to Filters',
  icon: 'i-lucide-filter',
  onSelect: () => {
    if (!menuTarget.value) return

    addCondition(menuTarget.value.property, menuTarget.value.value)
    open.value.filters = true
  },
}])

// Rows the filter index does not know keep the native menu
function onContextMenu(event: MouseEvent) {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-filter-property]')

  if (!row || !propertyIndex.value?.properties.has(row.dataset.filterProperty!)) return event.stopPropagation()

  menuTarget.value = { property: row.dataset.filterProperty!, value: row.dataset.filterValue ?? '' }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <UInput
      v-if="entries.length"
      v-model="search"
      icon="i-lucide-search"
      placeholder="Filter properties..."
      aria-label="Filter properties"
      class="shrink-0"
    />

    <UContextMenu
      :items="menuItems"
      :modal="false"
    >
      <div
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
        data-properties-scroll
        @contextmenu.capture="onContextMenu"
      >
        <div
          v-for="[key, object] in entries"
          :key="key"
        >
          <button
            type="button"
            class="mb-1 flex w-full items-center gap-2 border-b border-tint/15 pb-1 text-left"
            @click="toggle(key)"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 transition-transform duration-100"
              :class="{ 'rotate-90': isExpanded(key) }"
            />

            <span class="text-sm font-bold wrap-break-word">{{ object.name }}</span>

            <span
              v-if="object.type"
              class="shrink-0 text-xs text-muted"
            >
              {{ object.type }}
            </span>
          </button>

          <template v-if="isExpanded(key)">
            <div
              v-if="!object.propertySets.length && !Object.keys(object.attributes).length"
              class="py-3 text-center text-sm text-muted"
            >
              No properties for the selected element.
            </div>

            <table
              v-else
              class="w-full table-fixed border-collapse text-sm"
            >
              <tbody>
                <template v-if="visibleAttributes(object).length">
                  <tr>
                    <th
                      colspan="2"
                      class="bg-tint/10 px-2 py-1 text-left text-xs font-semibold tracking-wide uppercase"
                    >
                      Attributes
                    </th>
                  </tr>

                  <tr
                    v-for="[name, value] in visibleAttributes(object)"
                    :key="name"
                    class="border-b border-tint/10 hover:bg-tint/5"
                  >
                    <td class="w-2/5 px-2 py-1 align-top wrap-break-word text-muted">
                      {{ name }}
                    </td>

                    <td class="px-2 py-1 align-top font-medium wrap-break-word">
                      {{ value }}
                    </td>
                  </tr>
                </template>

                <template
                  v-for="(set, setIndex) in visiblePropertySets(object)"
                  :key="setIndex"
                >
                  <tr>
                    <th
                      colspan="2"
                      class="bg-tint/10 px-2 py-1 text-left text-xs font-semibold tracking-wide wrap-break-word uppercase"
                    >
                      {{ set.name }}
                    </th>
                  </tr>

                  <tr v-if="!set.properties.length">
                    <td
                      colspan="2"
                      class="px-2 py-1 text-muted italic"
                    >
                      No properties in this set.
                    </td>
                  </tr>

                  <tr
                    v-for="(property, propertyIndex) in set.properties"
                    :key="propertyIndex"
                    class="border-b border-tint/10 hover:bg-tint/5"
                    :data-filter-property="property.name"
                    :data-filter-value="property.value"
                  >
                    <td class="w-2/5 px-2 py-1 align-top wrap-break-word text-toned">
                      {{ property.name }}
                    </td>

                    <td class="px-2 py-1 align-top font-medium wrap-break-word">
                      {{ property.value && property.unit ? `${property.value} ${property.unit}` : property.value }}
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </template>
        </div>

        <div
          v-if="!entries.length"
          class="mx-auto my-4 flex max-w-62 flex-col items-center gap-2 text-center text-muted"
        >
          <UIcon
            name="i-lucide-file"
            class="size-8"
          />

          Please select an element in the model to display its properties
        </div>
      </div>
    </UContextMenu>
  </div>
</template>
