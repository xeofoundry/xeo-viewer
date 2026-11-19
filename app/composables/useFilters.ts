import { watchDebounced } from '@vueuse/core'

const conditions = ref<FilterCondition[]>([])
const classes = ref<string[]>([])
const hiddenIds = shallowRef(new Set<string>())
const result = ref<{ matched: number, total: number }>()

let nextId = 0

const activeCount = computed(() => conditions.value.filter(isActiveCondition).length + classes.value.length)

function apply() {
  const scene = useViewer().value?.scene
  const index = activeCount.value ? propertyIndex.value : undefined
  const selected = new Set(classes.value)
  const hidden = new Set<string>()

  for (const [id, props] of index?.propsByObject ?? []) {
    const inClass = !selected.size || selected.has(props.get(CLASS_PROPERTY)![0]!)

    if (!inClass || !matchesConditions(props, conditions.value)) hidden.add(id)
  }

  // Re-shows only what the filter itself hid, so hiding done in the Explorer survives
  scene?.setObjectsVisible([...hidden].filter(id => !hiddenIds.value.has(id)), false)
  scene?.setObjectsVisible([...hiddenIds.value].filter(id => !hidden.has(id)), true)

  hiddenIds.value = hidden
  result.value = index && { matched: index.propsByObject.size - hidden.size, total: index.propsByObject.size }
}

watchDebounced([conditions, classes], apply, { debounce: 150, deep: true })
watch(loadedModels, apply)

function addCondition() {
  conditions.value.push({ id: ++nextId, property: '', operator: 'equals', value: '', join: 'AND' })
}

function removeCondition(id: number) {
  conditions.value = conditions.value.filter(condition => condition.id !== id)
}

function clearFilters() {
  conditions.value = []
  classes.value = []
}

export const useFilters = () => ({ conditions, classes, hiddenIds, result, activeCount, addCondition, removeCondition, clearFilters })
