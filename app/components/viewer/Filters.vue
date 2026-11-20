<script setup lang="ts">
const { conditions, classes, result, addCondition, removeCondition, clearFilters } = useFilters()

// Narrowed to the selected classes, so only properties and values they have are offered
const properties = computed(() => {
  const index = propertyIndex.value

  if (!index || !classes.value.length) return index?.properties

  const selected = new Set(classes.value)

  return summarizeProperties([...index.propsByObject.values()].filter(props => selected.has(props.get(CLASS_PROPERTY)![0]!)))
})

const allClassesSelected = computed(() => !!classes.value.length && classes.value.length === propertyIndex.value?.classes.length)

const propertyNames = computed(() => [...properties.value?.keys() ?? []])

const operators = (property: string) => OPERATORS_BY_TYPE[properties.value?.get(property)?.dataType ?? 'string']

function setProperty(condition: FilterCondition, property: string) {
  condition.property = property
  condition.value = ''

  if (!operators(property).includes(condition.operator)) condition.operator = operators(property)[0]!
}

watch(properties, (available) => {
  for (const condition of conditions.value) {
    if (available && condition.property && !available.has(condition.property)) setProperty(condition, '')
  }
})
</script>

<template>
  <div
    v-if="!properties"
    class="mx-auto my-4 flex max-w-62 flex-col items-center gap-2 text-center text-muted"
  >
    <UIcon
      name="i-lucide-filter"
      class="size-8"
    />

    Load a model to filter its objects by their properties
  </div>

  <div
    v-else
    class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
  >
    <USelectMenu
      v-model="classes"
      :items="propertyIndex?.classes"
      multiple
      placeholder="Filter by class"
      aria-label="Filter by class"
      class="w-full shrink-0"
    >
      <template #content-bottom>
        <UButton
          :label="allClassesSelected ? 'Deselect all' : 'Select all'"
          :icon="allClassesSelected ? 'i-lucide-square' : 'i-lucide-check-check'"
          size="sm"
          color="neutral"
          variant="ghost"
          class="m-1"
          @click="classes = allClassesSelected ? [] : [...propertyIndex?.classes ?? []]"
        />
      </template>
    </USelectMenu>

    <template
      v-for="(condition, index) in conditions"
      :key="condition.id"
    >
      <div
        v-if="index > 0"
        class="flex items-center gap-2"
      >
        <USeparator class="flex-1" />

        <UButton
          v-for="join in ['AND', 'OR'] as const"
          :key="join"
          :label="join"
          size="xs"
          :color="condition.join === join ? 'primary' : 'neutral'"
          :variant="condition.join === join ? 'solid' : 'ghost'"
          :aria-pressed="condition.join === join"
          @click="condition.join = join"
        />

        <USeparator class="flex-1" />
      </div>

      <div class="flex shrink-0 items-start gap-2">
        <div class="grid min-w-0 flex-1 grid-cols-2 gap-2">
          <USelectMenu
            :model-value="condition.property"
            :items="propertyNames"
            placeholder="Property"
            aria-label="Property"
            virtualize
            @update:model-value="setProperty(condition, $event)"
          />

          <USelect
            v-model="condition.operator"
            :items="operators(condition.property).map(value => ({ value, label: OPERATOR_LABELS[value] }))"
            aria-label="Operator"
            :content="{ bodyLock: false }"
          />

          <UInputMenu
            v-if="needsValue(condition.operator)"
            v-model="condition.value"
            mode="autocomplete"
            :items="properties.get(condition.property)?.values"
            placeholder="Value"
            aria-label="Value"
            autocomplete="off"
            open-on-focus
            clear
            virtualize
            :disabled="!condition.property"
            class="col-span-2"
            @clear="condition.value = ''"
          />
        </div>

        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          aria-label="Remove condition"
          @click="removeCondition(condition.id)"
        />
      </div>
    </template>

    <div class="flex shrink-0 items-center gap-2">
      <UButton
        v-if="conditions.length || classes.length"
        label="Clear all"
        icon="i-lucide-trash-2"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="clearFilters"
      />

      <span
        v-if="result"
        class="text-xs text-muted"
      >
        Matched {{ result.matched }} of {{ result.total }}
      </span>

      <UButton
        label="Add condition"
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="ghost"
        class="ml-auto"
        @click="addCondition()"
      />
    </div>
  </div>
</template>
